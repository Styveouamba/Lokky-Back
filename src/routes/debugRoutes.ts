import express, { Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import Subscription from '../models/Subscription';
import User from '../models/userModel';

const router = express.Router();

/**
 * Manually activate subscription (DEBUG ONLY)
 * POST /api/debug/activate-subscription
 */
router.post('/activate-subscription', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    console.log('[Debug] Manually activating subscription for user:', userId);

    // Find pending subscription
    const subscription = await Subscription.findOne({
      userId,
      status: 'pending',
    }).sort({ createdAt: -1 });

    if (!subscription) {
      res.status(404).json({ message: 'No pending subscription found' });
      return;
    }

    // Activate subscription
    subscription.status = 'trial';
    subscription.startDate = new Date();
    await subscription.save();

    // Update user premium fields
    await User.findByIdAndUpdate(userId, {
      'premium.isActive': true,
      'premium.plan': subscription.plan,
      'premium.since': new Date(),
      'premium.expiresAt': subscription.endDate,
    });

    console.log('[Debug] Subscription activated:', subscription._id);

    res.status(200).json({
      message: 'Subscription activated successfully',
      subscription,
    });
  } catch (error: any) {
    console.error('[Debug] Error activating subscription:', error);
    res.status(500).json({
      message: 'Failed to activate subscription',
      error: error.message,
    });
  }
});

/**
 * Check all subscriptions for user (DEBUG ONLY)
 * GET /api/debug/my-subscriptions
 */
router.get('/my-subscriptions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const subscriptions = await Subscription.find({ userId }).sort({ createdAt: -1 });
    const user = await User.findById(userId).select('premium');

    res.status(200).json({
      subscriptions,
      userPremium: user?.premium,
    });
  } catch (error: any) {
    console.error('[Debug] Error getting subscriptions:', error);
    res.status(500).json({
      message: 'Failed to get subscriptions',
      error: error.message,
    });
  }
});

export default router;
