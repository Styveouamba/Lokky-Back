import { Response } from 'express';
import Report from '../models/reportModel';
import Block from '../models/blockModel';
import User from '../models/userModel';
import Activity from '../models/activityModel';
import { AuthRequest } from '../middleware/authMiddleware';

// Signaler un utilisateur
export const reportUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, reason, description } = req.body;

    if (!userId || !reason) {
      res.status(400).json({ message: 'Champs obligatoires manquants' });
      return;
    }

    // Vérifier que l'utilisateur ne se signale pas lui-même
    if (userId === req.userId) {
      res.status(400).json({ message: 'Vous ne pouvez pas vous signaler vous-même' });
      return;
    }

    // Vérifier que l'utilisateur existe
    const reportedUser = await User.findById(userId);
    if (!reportedUser) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // Vérifier si un signalement existe déjà
    const existingReport = await Report.findOne({
      reporter: req.userId,
      reportedUser: userId,
      status: 'pending',
    });

    if (existingReport) {
      res.status(400).json({ message: 'Vous avez déjà signalé cet utilisateur' });
      return;
    }

    // Créer le signalement
    const report = await Report.create({
      reporter: req.userId,
      reportedUser: userId,
      reportType: 'user',
      reason,
      description,
      status: 'pending',
    });

    // Incrémenter le compteur de signalements de l'utilisateur
    await User.findByIdAndUpdate(userId, {
      $inc: { 'moderation.reportCount': 1 },
    });

    res.status(201).json({ 
      message: 'Signalement envoyé. Notre équipe va l\'examiner.',
      report 
    });
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({ message: 'Erreur lors du signalement' });
  }
};

// Signaler une activité
export const reportActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { activityId, reason, description } = req.body;

    if (!activityId || !reason) {
      res.status(400).json({ message: 'Champs obligatoires manquants' });
      return;
    }

    // Vérifier que l'activité existe
    const activity = await Activity.findById(activityId);
    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    // Vérifier si un signalement existe déjà
    const existingReport = await Report.findOne({
      reporter: req.userId,
      reportedActivity: activityId,
      status: 'pending',
    });

    if (existingReport) {
      res.status(400).json({ message: 'Vous avez déjà signalé cette activité' });
      return;
    }

    // Créer le signalement
    const report = await Report.create({
      reporter: req.userId,
      reportedActivity: activityId,
      reportedUser: activity.createdBy,
      reportType: 'activity',
      reason,
      description,
      status: 'pending',
    });

    res.status(201).json({ 
      message: 'Signalement envoyé. Notre équipe va l\'examiner.',
      report 
    });
  } catch (error) {
    console.error('Report activity error:', error);
    res.status(500).json({ message: 'Erreur lors du signalement' });
  }
};

// Bloquer un utilisateur
export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, conversationId } = req.body;

    if (!userId) {
      res.status(400).json({ message: 'ID utilisateur manquant' });
      return;
    }

    // Vérifier que l'utilisateur ne se bloque pas lui-même
    if (userId === req.userId) {
      res.status(400).json({ message: 'Vous ne pouvez pas vous bloquer vous-même' });
      return;
    }

    // Vérifier que l'utilisateur existe
    const blockedUser = await User.findById(userId);
    if (!blockedUser) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // Créer le blocage (ou ignorer si existe déjà grâce à l'index unique)
    try {
      await Block.create({
        blocker: req.userId,
        blocked: userId,
      });

      // Si un conversationId est fourni, créer un message système
      if (conversationId) {
        const Conversation = (await import('../models/conversationModel')).default;
        const Message = (await import('../models/messageModel')).default;
        
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          await Message.create({
            conversation: conversationId,
            sender: req.userId,
            content: 'Cet utilisateur a été bloqué. Vous ne pouvez plus échanger de messages.',
            isSystemMessage: true,
            systemMessageType: 'user_blocked',
            read: false,
          });
        }
      }
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(400).json({ message: 'Utilisateur déjà bloqué' });
        return;
      }
      throw error;
    }

    res.json({ message: 'Utilisateur bloqué avec succès' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Erreur lors du blocage' });
  }
};

// Débloquer un utilisateur
export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const result = await Block.findOneAndDelete({
      blocker: req.userId,
      blocked: userId,
    });

    if (!result) {
      res.status(404).json({ message: 'Blocage non trouvé' });
      return;
    }

    res.json({ message: 'Utilisateur débloqué avec succès' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Erreur lors du déblocage' });
  }
};

// Récupérer la liste des utilisateurs bloqués
export const getBlockedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blocks = await Block.find({ blocker: req.userId })
      .populate('blocked', 'name avatar')
      .sort({ createdAt: -1 });

    res.json(blocks);
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération' });
  }
};

// Vérifier si un utilisateur est bloqué
export const checkIfBlocked = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const block = await Block.findOne({
      blocker: req.userId,
      blocked: userId,
    });

    res.json({ isBlocked: !!block });
  } catch (error) {
    console.error('Check if blocked error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification' });
  }
};

// Helper: Vérifier si deux utilisateurs se sont bloqués mutuellement
export async function areUsersBlocked(userId1: string, userId2: string): Promise<boolean> {
  const block = await Block.findOne({
    $or: [
      { blocker: userId1, blocked: userId2 },
      { blocker: userId2, blocked: userId1 },
    ],
  });
  return !!block;
}
