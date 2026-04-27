import { Request, Response } from 'express';
import { verifyWebhookSignature } from '../utils/webhookVerification';
import Transaction from '../models/Transaction';
import Subscription from '../models/Subscription';
import User from '../models/userModel';
import { sendPushNotificationToUser } from '../services/notificationService';
import Redis from 'ioredis';

// Redis client for cache invalidation
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const CACHE_PREFIX = 'premium:';

/**
 * Invalidate premium cache for a user
 */
const invalidatePremiumCache = async (userId: string): Promise<void> => {
  const cacheKey = `${CACHE_PREFIX}${userId}`;
  try {
    await redis.del(cacheKey);
    console.log('[Premium] Cache invalidated for user:', userId);
  } catch (error) {
    console.error('[Premium] Failed to invalidate cache:', error);
  }
};

/**
 * Process transaction after webhook validation
 */
const processTransaction = async (
  transaction: any,
  webhookPayload: any,
  res: Response
): Promise<void> => {
  // NabooPay V2 format: transaction_status peut être "paid", "pending", "failed", "completed"
  const { transaction_status, paid_at } = webhookPayload;

  try {
    // Check if webhook already processed (idempotency)
    if (transaction.webhookReceived) {
      console.log('[Webhook] Webhook already processed, returning 200 OK');
      res.status(200).json({ received: true, message: 'Already processed' });
      return;
    }

    // Update transaction
    // NabooPay utilise "paid" pour les paiements réussis
    const isSuccess = transaction_status === 'paid' || transaction_status === 'completed';
    transaction.status = isSuccess ? 'completed' : 'failed';
    transaction.nabooStatus = transaction_status;
    transaction.nabooResponse = webhookPayload;
    transaction.webhookReceived = true;
    transaction.webhookReceivedAt = new Date();

    if (!isSuccess) {
      await transaction.save();

      // Update subscription to expired
      await Subscription.findByIdAndUpdate(transaction.subscriptionId, {
        status: 'expired',
      });

      console.log('[Webhook] Payment not completed, status:', transaction_status);

      // Send failure notification
      await sendPushNotificationToUser(
        transaction.userId.toString(),
        'Échec du paiement',
        'Le paiement de votre abonnement a échoué. Veuillez réessayer.',
        { type: 'payment_failed', status: transaction_status }
      );

      res.status(200).json({ received: true });
      return;
    }

    console.log('[Webhook] Payment successful, activating subscription...');

    await transaction.save();

    // Activate subscription
    const subscription = await Subscription.findById(transaction.subscriptionId);
    if (!subscription) {
      console.error('[Webhook] Subscription not found:', transaction.subscriptionId);
      res.status(404).json({ message: 'Subscription not found' });
      return;
    }

    subscription.status = 'trial';
    subscription.startDate = new Date();
    await subscription.save();

    console.log('[Webhook] Subscription activated:', subscription._id);

    // Update user premium fields
    await User.findByIdAndUpdate(subscription.userId, {
      'premium.isActive': true,
      'premium.plan': subscription.plan,
      'premium.since': new Date(),
      'premium.expiresAt': subscription.endDate,
    });

    // Invalidate Redis cache
    await invalidatePremiumCache(subscription.userId.toString());

    // Send success notification
    await sendPushNotificationToUser(
      subscription.userId.toString(),
      'Bienvenue dans Lokky Premium! 🎉',
      `Votre période d'essai de 7 jours a commencé. Profitez de toutes les fonctionnalités premium!`,
      { type: 'subscription_activated' }
    );

    console.log('[Webhook] ✅ Payment processed successfully');
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error in processTransaction:', error);
    res.status(500).json({
      message: 'Failed to process transaction',
      error: error.message,
    });
  }
};

/**
 * Handle NabooPay payment webhook
 * POST /api/webhooks/naboo-payment
 */
export const handleNabooPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('[Webhook] Received NabooPay webhook');
    console.log('[Webhook] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[Webhook] Body:', JSON.stringify(req.body, null, 2));

    // Extract signature from X-Signature header (NabooPay standard)
    const signature = req.headers['x-signature'] as string;
    
    console.log('[Webhook] Signature found:', signature ? 'Yes' : 'No');
    if (signature) {
      console.log('[Webhook] Signature value:', signature);
    }
    
    // Pour la vérification de signature, utiliser le JSON compact (sans espaces)
    // NabooPay génère la signature avec JSON.stringify(payload) sans espaces
    const rawBody = JSON.stringify(req.body);

    const skipSignatureVerification = process.env.NODE_ENV === 'development';

    if (!skipSignatureVerification) {
      // Verify webhook signature in production
      if (!signature) {
        console.error('[Webhook] ❌ No signature provided');
        res.status(401).json({ message: 'Missing webhook signature' });
        return;
      }

      const isValid = verifyWebhookSignature(rawBody, signature);
      
      if (!isValid) {
        console.error('[Webhook] ❌ Invalid signature - potential security threat');
        res.status(401).json({ message: 'Invalid webhook signature' });
        return;
      }
      
      console.log('[Webhook] ✅ Signature verified');
    } else {
      console.log('[Webhook] ⚠️ Skipping signature verification (development mode)');
      if (signature) {
        // En mode dev, tester quand même la signature pour debug
        console.log('[Webhook] Testing signature in dev mode...');
        const isValid = verifyWebhookSignature(rawBody, signature);
        console.log('[Webhook] Signature test result:', isValid ? 'Valid' : 'Invalid');
      }
    }

    // Parse webhook payload - NabooPay V2 format
    const {
      order_id,
      transaction_status,
      amount,
      currency,
      customer,
      selected_payment_method,
      paid_at,
      created_at,
      updated_at,
    } = req.body;

    console.log('[Webhook] Processing payment:', {
      order_id,
      transaction_status,
      amount,
      currency,
      customer,
      selected_payment_method,
      paid_at,
    });

    if (!order_id) {
      console.error('[Webhook] No order_id found in webhook payload');
      res.status(400).json({ message: 'Missing order_id' });
      return;
    }

    // Find transaction by nabooTransactionId (order_id from NabooPay)
    const transaction = await Transaction.findOne({
      nabooTransactionId: order_id,
    });

    if (!transaction) {
      console.error('[Webhook] Transaction not found:', order_id);
      console.log('[Webhook] Searching by pending status...');
      
      // Essayer de trouver une transaction pending récente
      const recentTransaction = await Transaction.findOne({
        status: 'pending',
        amount: amount,
      }).sort({ createdAt: -1 });
      
      if (recentTransaction) {
        console.log('[Webhook] Found pending transaction by amount:', recentTransaction._id);
        // Mettre à jour le nabooTransactionId
        recentTransaction.nabooTransactionId = order_id;
        await recentTransaction.save();
        // Continuer avec cette transaction
        return processTransaction(recentTransaction, req.body, res);
      }
      
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    return processTransaction(transaction, req.body, res);
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error);
    res.status(500).json({
      message: 'Failed to process webhook',
      error: error.message,
    });
  }
};

export default {
  handleNabooPayment,
};
