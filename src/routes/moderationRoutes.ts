import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { checkModerationStatus } from '../middleware/rateLimitMiddleware';
import * as moderationController from '../controllers/moderationController';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);
router.use(checkModerationStatus);

// Signalements
router.post('/report/user', moderationController.reportUser);
router.post('/report/activity', moderationController.reportActivity);

// Blocages
router.post('/block', moderationController.blockUser);
router.delete('/block/:userId', moderationController.unblockUser);
router.get('/blocked', moderationController.getBlockedUsers);
router.get('/block/:userId/check', moderationController.checkIfBlocked);

export default router;
