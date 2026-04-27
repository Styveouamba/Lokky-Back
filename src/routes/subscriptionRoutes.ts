import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  initiatePurchase,
  getSubscriptionStatus,
  cancelSubscription,
  getSubscriptionHistory,
} from '../controllers/subscriptionController';

const router = express.Router();

// All subscription routes require authentication
router.post('/initiate', authMiddleware, initiatePurchase);
router.get('/status', authMiddleware, getSubscriptionStatus);
router.post('/cancel', authMiddleware, cancelSubscription);
router.get('/history', authMiddleware, getSubscriptionHistory);

export default router;
