import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import Subscription from '../models/Subscription';
import Redis from 'ioredis';

// Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Cache configuration
const CACHE_PREFIX = 'premium:';
const CACHE_TTL = 300; // 5 minutes in seconds

interface PremiumStatus {
  isPremium: boolean;
  plan: string | null;
  expiresAt: Date | null;
}

/**
 * Check premium status with Redis caching
 */
export const checkPremiumStatus = async (
  userId: string
): Promise<PremiumStatus> => {
  const cacheKey = `${CACHE_PREFIX}${userId}`;

  try {
    // Try to get from cache
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      console.log('[Premium] Cache hit for user:', userId);
      return JSON.parse(cached);
    }

    console.log('[Premium] Cache miss for user:', userId);
  } catch (error) {
    console.error('[Premium] Redis error (falling back to database):', error);
  }

  // Query database
  const subscription = await Subscription.findOne({
    userId,
    status: { $in: ['trial', 'active'] },
  });

  const status: PremiumStatus = {
    isPremium: !!subscription,
    plan: subscription?.plan || null,
    expiresAt: subscription?.endDate || null,
  };

  // Cache the result
  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(status));
    console.log('[Premium] Cached status for user:', userId);
  } catch (error) {
    console.error('[Premium] Failed to cache status:', error);
  }

  return status;
};

/**
 * Middleware to require premium subscription
 */
export const requirePremium = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    console.log('[Premium] Checking premium access for user:', userId);

    const status = await checkPremiumStatus(userId);

    if (!status.isPremium) {
      console.log('[Premium] ❌ Access denied - user is not premium');
      res.status(403).json({
        message: 'Premium subscription required to access this feature',
        isPremium: false,
      });
      return;
    }

    console.log('[Premium] ✅ Access granted - user is premium');
    next();
  } catch (error: any) {
    console.error('[Premium] Error checking premium status:', error);
    res.status(500).json({
      message: 'Failed to verify premium status',
      error: error.message,
    });
  }
};

/**
 * Invalidate premium cache for a user
 */
export const invalidatePremiumCache = async (userId: string): Promise<void> => {
  const cacheKey = `${CACHE_PREFIX}${userId}`;

  try {
    await redis.del(cacheKey);
    console.log('[Premium] Cache invalidated for user:', userId);
  } catch (error) {
    console.error('[Premium] Failed to invalidate cache:', error);
  }
};

export default {
  checkPremiumStatus,
  requirePremium,
  invalidatePremiumCache,
};
