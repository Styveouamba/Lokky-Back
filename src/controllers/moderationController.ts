import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import AdminNotification from '../models/adminNotificationModel';
import User from '../models/userModel';
import Block from '../models/blockModel';

// Vérifier si deux utilisateurs sont bloqués mutuellement
export const areUsersBlocked = async (userId1: string, userId2: string): Promise<boolean> => {
  try {
    const block = await Block.findOne({
      $or: [
        { blocker: userId1, blocked: userId2 },
        { blocker: userId2, blocked: userId1 },
      ],
    });

    return !!block;
  } catch (error) {
    console.error('Check users blocked error:', error);
    return false;
  }
};

// Récupérer les notifications admin de l'utilisateur
export const getAdminNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const notifications = await AdminNotification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des notifications' });
  }
};

// Marquer une notification comme lue
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const notification = await AdminNotification.findOne({
      _id: notificationId,
      user: userId,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }

    notification.read = true;
    await notification.save();

    res.json({ message: 'Notification marquée comme lue' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour' });
  }
};

// Marquer toutes les notifications comme lues
export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    await AdminNotification.updateMany(
      { user: userId, read: false },
      { read: true }
    );

    res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour' });
  }
};

// Vérifier le statut de modération de l'utilisateur
export const checkModerationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const user = await User.findById(userId).select('moderation');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const status = user.moderation?.status || 'active';
    const suspendedUntil = user.moderation?.suspendedUntil;

    // Vérifier si la suspension est expirée
    if (status === 'suspended' && suspendedUntil && new Date() > suspendedUntil) {
      user.moderation = {
        status: 'active',
        suspendedUntil: undefined,
        warningCount: user.moderation?.warningCount || 0,
        reportCount: user.moderation?.reportCount || 0,
        lastWarningAt: user.moderation?.lastWarningAt,
      };
      await user.save();

      return res.json({
        status: 'active',
        message: 'Votre suspension a expiré. Votre compte est maintenant actif.',
      });
    }

    res.json({
      status,
      suspendedUntil,
      warningCount: user.moderation?.warningCount || 0,
    });
  } catch (error) {
    console.error('Check moderation status error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification du statut' });
  }
};

// Signaler un utilisateur
export const reportUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { userId: reportedUserId, reason, description } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: 'Données manquantes' });
    }

    // Vérifier que l'utilisateur ne se signale pas lui-même
    if (userId === reportedUserId) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous signaler vous-même' });
    }

    // Vérifier que l'utilisateur signalé existe
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Importer le modèle Report
    const Report = (await import('../models/reportModel')).default;

    // Vérifier si l'utilisateur a déjà signalé cet utilisateur récemment (dans les 24h)
    const existingReport = await Report.findOne({
      reporter: userId,
      reportedUser: reportedUserId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (existingReport) {
      return res.status(400).json({ message: 'Vous avez déjà signalé cet utilisateur récemment' });
    }

    // Créer le signalement
    const report = new Report({
      reporter: userId,
      reportedUser: reportedUserId,
      reportType: 'user',
      reason,
      description,
      status: 'pending',
    });

    await report.save();

    // Incrémenter le compteur de signalements de l'utilisateur signalé
    if (!reportedUser.moderation) {
      reportedUser.moderation = {
        status: 'active',
        warningCount: 0,
        reportCount: 1,
      };
    } else {
      reportedUser.moderation.reportCount = (reportedUser.moderation.reportCount || 0) + 1;
    }
    await reportedUser.save();

    res.status(201).json({ message: 'Signalement créé avec succès', report });
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({ message: 'Erreur lors de la création du signalement' });
  }
};

// Signaler une activité
export const reportActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { activityId, reason, description } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    if (!activityId || !reason) {
      return res.status(400).json({ message: 'Données manquantes' });
    }

    // Vérifier que l'activité existe
    const Activity = (await import('../models/activityModel')).default;
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activité non trouvée' });
    }

    // Importer le modèle Report
    const Report = (await import('../models/reportModel')).default;

    // Vérifier si l'utilisateur a déjà signalé cette activité récemment (dans les 24h)
    const existingReport = await Report.findOne({
      reporter: userId,
      reportedActivity: activityId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (existingReport) {
      return res.status(400).json({ message: 'Vous avez déjà signalé cette activité récemment' });
    }

    // Créer le signalement
    const report = new Report({
      reporter: userId,
      reportedActivity: activityId,
      reportType: 'activity',
      reason,
      description,
      status: 'pending',
    });

    await report.save();

    res.status(201).json({ message: 'Signalement créé avec succès', report });
  } catch (error) {
    console.error('Report activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la création du signalement' });
  }
};
