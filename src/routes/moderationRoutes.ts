import express from 'express';
import {
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  checkModerationStatus,
  reportUser,
  reportActivity,
} from '../controllers/moderationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// Récupérer les notifications admin
router.get('/notifications', getAdminNotifications);

// Marquer une notification comme lue
router.patch('/notifications/:notificationId/read', markNotificationAsRead);

// Marquer toutes les notifications comme lues
router.patch('/notifications/read-all', markAllNotificationsAsRead);

// Vérifier le statut de modération
router.get('/status', checkModerationStatus);

// Signaler un utilisateur
router.post('/report/user', reportUser);

// Signaler une activité
router.post('/report/activity', reportActivity);

export default router;
