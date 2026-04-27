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
 * Handle NabooPay payment webhook
 * POST /api/webhooks/naboo-payment
 */
export const handleNabooPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('[Webhook] Received NabooPay webhook');

    // Extract signature from headers
    const signature = req.headers['x-naboo-signature'] as string;
    
    // Get raw body as string for signature verification
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature);
    
    if (!isValid) {
      console.error('[Webhook] ❌ Invalid signature - potential security threat');
      res.status(401).json({ message: 'Invalid webhook signature' });
      return;
    }

    // Parse webhook payload
    const {
      transaction_id,
      status,
      amount,
      currency,
      metadata,
      failure_reason,
    } = req.body;

    console.log('[Webhook] Processing payment:', {
      transaction_id,
      status,
      amount,
      currency,
    });

    // Find transaction
    const transaction = await Transaction.findOne({
      nabooTransactionId: transaction_id,
    });

    if (!transaction) {
      console.error('[Webhook] Transaction not found:', transaction_id);
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    // Check if webhook already processed (idempotency)
    if (transaction.webhookReceived) {
      console.log('[Webhook] Webhook already processed, returning 200 OK');
      res.status(200).json({ received: true, message: 'Already processed' });
      return;
    }

    // Update transaction
    transaction.status = status === 'success' ? 'completed' : 'failed';
    transaction.nabooStatus = status;
    transaction.nabooResponse = req.body;
    transaction.webhookReceived = true;
    transaction.webhookReceivedAt = new Date();

    if (status !== 'success') {
      transaction.failureReason = failure_reason;
      await transaction.save();

      // Update subscription to expired
      await Subscription.findByIdAndUpdate(transaction.subscriptionId, {
        status: 'expired',
      });

      console.log('[Webhook] Payment failed:', failure_reason);

      // Send failure notification
      await sendPushNotificationToUser(
        transaction.userId.toString(),
        'Échec du paiement',
        'Le paiement de votre abonnement a échoué. Veuillez réessayer.',
        { type: 'payment_failed', reason: failure_reason }
      );

      res.status(200).json({ received: true });
      return;
    }

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
