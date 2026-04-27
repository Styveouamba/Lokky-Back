import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Subscription from '../models/Subscription';
import Transaction from '../models/Transaction';
import User from '../models/userModel';
import { initializePayment } from '../services/nabooPayService';
import { sendPushNotificationToUser } from '../services/notificationService';

// Pricing configuration
const PRICING: Record<'monthly' | 'annual', { amount: number; currency: string; days: number }> = {
  monthly: { amount: 100, currency: 'XOF', days: 30 },
  annual: { amount: 100, currency: 'XOF', days: 365 },
};

const TRIAL_DAYS = 7;

/**
 * Calculate end date based on plan
 */
const calculateEndDate = (plan: 'monthly' | 'annual', startDate: Date): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + PRICING[plan].days);
  return endDate;
};

/**
 * Add days to a date
 */
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Initiate subscription purchase
 * POST /api/subscriptions/initiate
 */
export const initiatePurchase = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { plan, paymentMethod } = req.body;
    const userId = req.userId;

    console.log('[Subscription] Initiating purchase:', { userId, plan, paymentMethod });

    // Validate input
    if (!plan || !['monthly', 'annual'].includes(plan)) {
      res.status(400).json({ message: 'Invalid plan. Must be monthly or annual' });
      return;
    }

    const typedPlan = plan as 'monthly' | 'annual';

    if (!paymentMethod || !['wave', 'orange_money', 'visa'].includes(paymentMethod)) {
      res.status(400).json({
        message: 'Invalid payment method. Must be wave, orange_money, or visa',
      });
      return;
    }

    // Check for existing active/trial subscription
    const existingSubscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] },
    });

    if (existingSubscription) {
      res.status(400).json({
        message: 'You already have an active subscription',
        subscription: existingSubscription,
      });
      return;
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Calculate pricing and dates
    const { amount, currency } = PRICING[typedPlan];
    const startDate = new Date();
    const trialEndDate = addDays(startDate, TRIAL_DAYS);
    const endDate = calculateEndDate(typedPlan, trialEndDate);

    // Create pending subscription
    const subscription = await Subscription.create({
      userId,
      plan: typedPlan,
      status: 'pending',
      amount,
      currency,
      paymentMethod,
      autoRenew: true,
      startDate,
      endDate,
      trialEndDate,
    });

    console.log('[Subscription] Created pending subscription:', subscription._id);

    // Initialize NabooPay payment
    const nabooResponse = await initializePayment(
      amount,
      currency,
      paymentMethod,
      user.email,
      user.name,
      subscription._id.toString(),
      userId!,
      typedPlan
    );

    // Create pending transaction
    await Transaction.create({
      userId,
      subscriptionId: subscription._id,
      nabooTransactionId: nabooResponse.order_id,
      amount,
      currency,
      paymentMethod,
      status: 'pending',
      webhookReceived: false,
      metadata: {
        plan: typedPlan,
        isRenewal: false,
        isTrial: true,
      },
    });

    // Update subscription with NabooPay transaction ID
    subscription.nabooTransactionId = nabooResponse.order_id;
    await subscription.save();

    console.log('[Subscription] Payment initialized:', nabooResponse.order_id);

    res.status(200).json({
      paymentUrl: nabooResponse.checkout_url,
      transactionId: nabooResponse.order_id,
      subscriptionId: subscription._id,
    });
  } catch (error: any) {
    console.error('[Subscription] Error initiating purchase:', error);
    console.error('[Subscription] Error stack:', error.stack);
    res.status(500).json({
      message: 'Failed to initiate subscription purchase',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Get subscription status
 * GET /api/subscriptions/status
 */
export const getSubscriptionStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    console.log('[Subscription] Getting status for user:', userId);

    // Find active or trial subscription
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['trial', 'active'] },
    });

    console.log('[Subscription] Found subscription:', subscription ? {
      id: subscription._id,
      status: subscription.status,
      plan: subscription.plan,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
    } : 'none');

    const isPremium = !!subscription;

    // Build features list
    const features = isPremium
      ? [
          'Mise en avant des activités',
          'Galerie photo',
          'Suivi des vues de profil',
          'Activités récurrentes',
          'Badge Premium',
        ]
      : [];

    // Calculate trial info
    let trialInfo = null;
    if (subscription && subscription.status === 'trial' && subscription.trialEndDate) {
      const now = new Date();
      const daysRemaining = Math.ceil(
        (subscription.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      trialInfo = {
        daysRemaining: Math.max(0, daysRemaining),
        endDate: subscription.trialEndDate,
      };
    }

    res.status(200).json({
      subscription,
      isPremium,
      features,
      trial: trialInfo,
    });
  } catch (error: any) {
    console.error('[Subscription] Error getting status:', error);
    res.status(500).json({
      message: 'Failed to get subscription status',
      error: error.message,
    });
  }
};

/**
 * Cancel subscription
 * POST /api/subscriptions/cancel
 */
export const cancelSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { reason } = req.body;

    console.log('[Subscription] Cancelling subscription for user:', userId);

    // Find active subscription
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['trial', 'active'] },
    });

    if (!subscription) {
      res.status(404).json({ message: 'No active subscription found' });
      return;
    }

    // Set autoRenew to false and record cancellation
    subscription.autoRenew = false;
    subscription.cancelledAt = new Date();
    if (reason) {
      subscription.cancellationReason = reason;
    }
    await subscription.save();

    console.log('[Subscription] Subscription cancelled:', subscription._id);

    // Send push notification
    await sendPushNotificationToUser(
      userId!,
      'Abonnement annulé',
      'Votre abonnement a été annulé. Vous conservez l\'accès premium jusqu\'au ' +
        subscription.endDate.toLocaleDateString('fr-FR'),
      { type: 'subscription_cancelled' }
    );

    res.status(200).json({
      message: 'Subscription cancelled successfully',
      subscription,
    });
  } catch (error: any) {
    console.error('[Subscription] Error cancelling subscription:', error);
    res.status(500).json({
      message: 'Failed to cancel subscription',
      error: error.message,
    });
  }
};

/**
 * Get subscription history
 * GET /api/subscriptions/history
 */
export const getSubscriptionHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 20);

    console.log('[Subscription] Getting history for user:', userId, { page, limit });

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Query transactions with pagination
    const [transactions, total] = await Promise.all([
      Transaction.find({ userId })
        .populate('subscriptionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments({ userId }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      transactions,
      pagination: {
        total,
        pages: totalPages,
        currentPage: page,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('[Subscription] Error getting history:', error);
    res.status(500).json({
      message: 'Failed to get subscription history',
      error: error.message,
    });
  }
};

export default {
  initiatePurchase,
  getSubscriptionStatus,
  cancelSubscription,
  getSubscriptionHistory,
};
