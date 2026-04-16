import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/adminMiddleware';
import {
  getStats,
  getWeeklyStats,
  getMonthlyStats,
  getCategoryStats,
  getGeographicStats,
  getTopCities,
  getRecentActivity,
  getActivityDetails,
  getUsers,
  getActivities,
  getReports,
  suspendUser,
  banUser,
  reactivateUser,
  warnUser,
  sendNotificationToUser,
  deleteActivity,
  processReport,
  getReputationMetrics,
  getMessageMetrics,
  getAdvancedActivityMetrics,
} from '../controllers/adminController';

const router = express.Router();

// Toutes les routes admin nécessitent l'authentification et le rôle admin
router.use(authMiddleware);
router.use(isAdmin);

// Statistiques
router.get('/stats', getStats);
router.get('/stats/weekly', getWeeklyStats);
router.get('/stats/monthly', getMonthlyStats);
router.get('/stats/categories', getCategoryStats);
router.get('/stats/geographic', getGeographicStats);
router.get('/stats/cities', getTopCities);
router.get('/stats/recent', getRecentActivity);
router.get('/stats/reputation', getReputationMetrics);
router.get('/stats/messages', getMessageMetrics);
router.get('/stats/activities-advanced', getAdvancedActivityMetrics);

// Gestion des utilisateurs
router.get('/users', getUsers);
router.patch('/users/:userId/suspend', suspendUser);
router.patch('/users/:userId/ban', banUser);
router.patch('/users/:userId/reactivate', reactivateUser);
router.patch('/users/:userId/warn', warnUser);
router.post('/users/:userId/notify', sendNotificationToUser);

// Gestion des activités
router.get('/activities', getActivities);
router.get('/activities/:activityId', getActivityDetails);
router.delete('/activities/:activityId', deleteActivity);

// Gestion des signalements
router.get('/reports', getReports);
router.patch('/reports/:reportId/process', processReport);

// Test des notifications intelligentes
router.post('/test/discovery-notifications', async (req, res) => {
  try {
    const { sendDiscoveryNotifications } = await import('../services/smartNotificationService');
    await sendDiscoveryNotifications();
    res.json({ message: 'Discovery notifications sent successfully' });
  } catch (error: any) {
    console.error('Error sending discovery notifications:', error);
    res.status(500).json({ message: 'Error sending notifications', error: error.message });
  }
});

export default router;
