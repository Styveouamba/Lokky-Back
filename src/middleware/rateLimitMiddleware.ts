import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import User from '../models/userModel';

// Rate limit pour la création d'activités (max 5 par jour)
export const activityCreationRateLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(401).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Réinitialiser le compteur si on est un nouveau jour
    if (!user.rateLimit?.lastActivityCreated || 
        new Date(user.rateLimit.lastActivityCreated) < today) {
      user.rateLimit = {
        lastActivityCreated: now,
        activitiesCreatedToday: 0,
        lastMessageSent: user.rateLimit?.lastMessageSent,
        messagesLastMinute: user.rateLimit?.messagesLastMinute || 0,
      };
    }

    // Vérifier la limite (5 activités par jour)
    const MAX_ACTIVITIES_PER_DAY = 5;
    if ((user.rateLimit?.activitiesCreatedToday || 0) >= MAX_ACTIVITIES_PER_DAY) {
      res.status(429).json({ 
        message: `Vous avez atteint la limite de ${MAX_ACTIVITIES_PER_DAY} activités par jour. Réessayez demain.` 
      });
      return;
    }

    // Incrémenter le compteur
    user.rateLimit = {
      lastActivityCreated: now,
      activitiesCreatedToday: (user.rateLimit?.activitiesCreatedToday || 0) + 1,
      lastMessageSent: user.rateLimit?.lastMessageSent,
      messagesLastMinute: user.rateLimit?.messagesLastMinute || 0,
    };
    await user.save();

    next();
  } catch (error) {
    console.error('Activity rate limit error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification du rate limit' });
  }
};

// Rate limit pour les messages (max 30 par minute)
export const messageRateLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(401).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Réinitialiser le compteur si la dernière minute est passée
    if (!user.rateLimit?.lastMessageSent || 
        new Date(user.rateLimit.lastMessageSent) < oneMinuteAgo) {
      user.rateLimit = {
        lastActivityCreated: user.rateLimit?.lastActivityCreated,
        activitiesCreatedToday: user.rateLimit?.activitiesCreatedToday || 0,
        lastMessageSent: now,
        messagesLastMinute: 0,
      };
    }

    // Vérifier la limite (30 messages par minute)
    const MAX_MESSAGES_PER_MINUTE = 30;
    if ((user.rateLimit?.messagesLastMinute || 0) >= MAX_MESSAGES_PER_MINUTE) {
      res.status(429).json({ 
        message: 'Vous envoyez trop de messages. Veuillez ralentir.' 
      });
      return;
    }

    // Incrémenter le compteur
    user.rateLimit = {
      lastActivityCreated: user.rateLimit?.lastActivityCreated,
      activitiesCreatedToday: user.rateLimit?.activitiesCreatedToday || 0,
      lastMessageSent: now,
      messagesLastMinute: (user.rateLimit?.messagesLastMinute || 0) + 1,
    };
    await user.save();

    next();
  } catch (error) {
    console.error('Message rate limit error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification du rate limit' });
  }
};

// Middleware pour vérifier le statut de modération
export const checkModerationStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(401).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // Vérifier si l'utilisateur est banni
    if (user.moderation?.status === 'banned') {
      res.status(403).json({ 
        message: 'Votre compte a été banni pour violation des conditions d\'utilisation.' 
      });
      return;
    }

    // Vérifier si l'utilisateur est suspendu
    if (user.moderation?.status === 'suspended') {
      const suspendedUntil = user.moderation.suspendedUntil;
      if (suspendedUntil && new Date() < suspendedUntil) {
        res.status(403).json({ 
          message: `Votre compte est suspendu jusqu'au ${suspendedUntil.toLocaleDateString('fr-FR')}.` 
        });
        return;
      } else {
        // La suspension est terminée, réactiver le compte
        user.moderation.status = 'active';
        await user.save();
      }
    }

    next();
  } catch (error) {
    console.error('Moderation check error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification du statut' });
  }
};
