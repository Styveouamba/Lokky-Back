import express from 'express';
import {
  getMyAchievements,
  getUnseenAchievementsController,
  markAsSeen,
  markAllAsSeen,
} from '../controllers/achievementController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// GET /achievements - Récupérer tous les achievements
router.get('/', getMyAchievements);

// GET /achievements/unseen - Récupérer les achievements non vus
router.get('/unseen', getUnseenAchievementsController);

// PUT /achievements/:achievementId/seen - Marquer un achievement comme vu
router.put('/:achievementId/seen', markAsSeen);

// PUT /achievements/seen-all - Marquer tous les achievements comme vus
router.put('/seen-all', markAllAsSeen);

export default router;
