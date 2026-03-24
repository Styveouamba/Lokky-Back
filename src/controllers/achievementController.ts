import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  getUserAchievements,
  getUnseenAchievements,
  markAchievementAsSeen,
  markAllAchievementsAsSeen,
} from '../services/achievementService';

/**
 * Récupère tous les achievements d'un utilisateur
 */
export const getMyAchievements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Non autorisé' });
      return;
    }

    const achievements = await getUserAchievements(userId);

    res.status(200).json(achievements);
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Récupère les achievements non vus
 */
export const getUnseenAchievementsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Non autorisé' });
      return;
    }

    const achievements = await getUnseenAchievements(userId);

    res.status(200).json(achievements);
  } catch (error) {
    console.error('Get unseen achievements error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Marque un achievement comme vu
 */
export const markAsSeen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { achievementId } = req.params;

    await markAchievementAsSeen(achievementId);

    res.status(200).json({ message: 'Achievement marqué comme vu' });
  } catch (error) {
    console.error('Mark achievement as seen error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Marque tous les achievements comme vus
 */
export const markAllAsSeen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Non autorisé' });
      return;
    }

    await markAllAchievementsAsSeen(userId);

    res.status(200).json({ message: 'Tous les achievements marqués comme vus' });
  } catch (error) {
    console.error('Mark all achievements as seen error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
