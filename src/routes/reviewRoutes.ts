import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as reviewController from '../controllers/reviewController';

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// Créer un avis
router.post('/', reviewController.createReview);

// Récupérer les avis d'une activité
router.get('/activity/:activityId', reviewController.getActivityReviews);

// Vérifier si l'utilisateur a déjà noté une activité
router.get('/activity/:activityId/check', reviewController.checkUserReview);

// Récupérer les activités en attente d'avis
router.get('/pending', reviewController.getPendingReviews);

export default router;
