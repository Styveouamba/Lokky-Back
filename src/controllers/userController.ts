import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import fs from 'fs';
import User from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadImage } from '../utils/cloudinary';

const generateToken = (userId: any): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const signOptions: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any
  };

  return jwt.sign({ userId }, jwtSecret, signOptions);
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email déjà utilisé' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      authProvider: 'email',
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        interests: user.interests,
        goals: user.goals,
        location: user.location,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.authProvider !== 'email') {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        interests: user.interests,
        goals: user.goals,
        location: user.location,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // S'assurer que reputation existe avec des valeurs par défaut
    const userObj = user.toObject();
    if (!userObj.reputation) {
      userObj.reputation = {
        averageRating: 0,
        totalReviews: 0,
        activitiesCreated: 0,
        activitiesCompleted: 0,
        attendanceRate: 100,
        totalNoShows: 0,
        participationStreak: 0,
        longestStreak: 0,
        categoriesExplored: [],
        socialScore: 0,
        badges: [],
        level: 'bronze' as const,
      };
    } else {
      // S'assurer que les nouveaux champs existent
      if (userObj.reputation.participationStreak === undefined) {
        userObj.reputation.participationStreak = 0;
      }
      if (userObj.reputation.longestStreak === undefined) {
        userObj.reputation.longestStreak = 0;
      }
      if (userObj.reputation.categoriesExplored === undefined) {
        userObj.reputation.categoriesExplored = [];
      }
      if (userObj.reputation.socialScore === undefined) {
        userObj.reputation.socialScore = 0;
      }
      if (userObj.reputation.badges === undefined) {
        userObj.reputation.badges = [];
      }
      if (userObj.reputation.level === undefined) {
        userObj.reputation.level = 'bronze';
      }
    }

    res.json({ user: userObj });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {


    const { name, avatar, interests, goals, location } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (interests !== undefined) updateData.interests = interests; // Permet les tableaux vides
    if (goals !== undefined) updateData.goals = goals; // Permet les tableaux vides
    if (location && location.coordinates && location.coordinates.length === 2) {
      updateData.location = {
        type: 'Point',
        coordinates: location.coordinates,
      };
    }


    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    
    if (!req.file) {
      console.error('No file in request');
      res.status(400).json({ message: 'Aucune image fournie' });
      return;
    }


    // Upload vers Cloudinary
    const result = await uploadImage(req.file.path);
    
    // Supprimer le fichier temporaire
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.error('Error deleting temporary file:', unlinkError);
    }
    
    // Mettre à jour l'avatar de l'utilisateur
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: result },
      { new: true }
    ).select('-password');

    if (!user) {
      console.error('User not found:', req.userId);
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    res.json({ avatarUrl: result, user });
  } catch (error: any) {
    // Supprimer le fichier temporaire en cas d'erreur
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting temporary file after error:', unlinkError);
      }
    }
    
    console.error('Upload avatar error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload de l\'avatar',
      error: error.message 
    });
  }
};

// Upload avatar avec base64
export const uploadAvatarBase64 = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    
    const { image, mimeType } = req.body;
    
    if (!image) {
      console.error('No image data in request');
      res.status(400).json({ message: 'Aucune image fournie' });
      return;
    }

    // Créer un fichier temporaire
    const tempFilePath = `./uploads/temp-${Date.now()}.jpg`;
    const buffer = Buffer.from(image, 'base64');
    fs.writeFileSync(tempFilePath, buffer);


    // Upload vers Cloudinary
    const result = await uploadImage(tempFilePath);
    
    // Supprimer le fichier temporaire
    try {
      fs.unlinkSync(tempFilePath);
    } catch (unlinkError) {
      console.error('Error deleting temporary file:', unlinkError);
    }
    
    // Mettre à jour l'avatar de l'utilisateur
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: result },
      { new: true }
    ).select('-password');

    if (!user) {
      console.error('User not found:', req.userId);
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    res.json({ avatarUrl: result, user });
  } catch (error: any) {
    console.error('Upload avatar base64 error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload de l\'avatar',
      error: error.message 
    });
  }
};

// Mettre à jour le push token
export const updatePushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pushToken } = req.body;

    // Accepter null pour supprimer le token
    if (pushToken === undefined) {
      res.status(400).json({ message: 'Push token requis' });
      return;
    }

    // Si pushToken est null, on le supprime du document
    if (pushToken === null) {
      const user = await User.findByIdAndUpdate(
        req.userId,
        { $unset: { pushToken: "" } },
        { new: true }
      ).select('-password');

      if (!user) {
        res.status(404).json({ message: 'Utilisateur non trouvé' });
        return;
      }

      console.log(`Push token removed for user ${req.userId}`);

      res.json({ 
        message: 'Push token supprimé', 
        user 
      });
      return;
    }

    // Si on enregistre un nouveau push token, d'abord le retirer de tous les autres utilisateurs
    // pour éviter qu'un même appareil reçoive des notifications pour plusieurs comptes
    await User.updateMany(
      { pushToken, _id: { $ne: req.userId } },
      { $unset: { pushToken: "" } }
    );

    console.log(`Removed push token from other users before assigning to user ${req.userId}`);

    // Ensuite, l'assigner à l'utilisateur actuel
    const user = await User.findByIdAndUpdate(
      req.userId,
      { pushToken },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    console.log(`Push token updated for user ${req.userId}`);

    res.json({ 
      message: 'Push token mis à jour', 
      user 
    });
  } catch (error) {
    console.error('Update push token error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du push token' });
  }
};

// Endpoint de test pour envoyer une notification
export const testPushNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    if (!user.pushToken) {
      res.status(400).json({ message: 'Aucun push token enregistré pour cet utilisateur' });
      return;
    }


    // Importer le service de notification
    const { sendPushNotification } = await import('../services/notificationService');
    
    await sendPushNotification(
      user.pushToken,
      'Test de notification 🔔',
      'Si tu reçois ce message, les notifications fonctionnent !',
      { test: true }
    );

    res.json({ 
      message: 'Notification de test envoyée',
      pushToken: user.pushToken
    });
  } catch (error) {
    console.error('Test push notification error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de la notification de test' });
  }
};

// Bloquer un utilisateur
export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { userId: blockedUserId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    if (!blockedUserId) {
      res.status(400).json({ message: 'ID utilisateur manquant' });
      return;
    }

    // Vérifier qu'on ne se bloque pas soi-même
    if (userId === blockedUserId) {
      res.status(400).json({ message: 'Vous ne pouvez pas vous bloquer vous-même' });
      return;
    }

    // Vérifier que l'utilisateur à bloquer existe
    const userToBlock = await User.findById(blockedUserId);
    if (!userToBlock) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // Importer le modèle Block
    const Block = (await import('../models/blockModel')).default;

    // Vérifier si le blocage existe déjà
    const existingBlock = await Block.findOne({
      blocker: userId,
      blocked: blockedUserId,
    });

    if (existingBlock) {
      res.status(400).json({ message: 'Utilisateur déjà bloqué' });
      return;
    }

    // Créer le blocage
    const block = await Block.create({
      blocker: userId,
      blocked: blockedUserId,
    });

    // Peupler les données pour la réponse
    const populatedBlock = await Block.findById(block._id)
      .populate('blocker', 'name avatar')
      .populate('blocked', 'name avatar');

    res.status(201).json(populatedBlock);
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Erreur lors du blocage' });
  }
};

// Débloquer un utilisateur
export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { userId: blockedUserId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    if (!blockedUserId) {
      res.status(400).json({ message: 'ID utilisateur manquant' });
      return;
    }

    // Importer le modèle Block
    const Block = (await import('../models/blockModel')).default;

    // Trouver et supprimer le blocage
    const block = await Block.findOneAndDelete({
      blocker: userId,
      blocked: blockedUserId,
    });

    if (!block) {
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
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    // Importer le modèle Block
    const Block = (await import('../models/blockModel')).default;

    // Récupérer tous les blocages de l'utilisateur
    const blocks = await Block.find({ blocker: userId })
      .populate('blocked', 'name avatar email')
      .sort({ createdAt: -1 });

    res.json(blocks);
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs bloqués' });
  }
};


/**
 * Get leaderboard
 */
export const getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type = 'creators' } = req.query;
    const userId = req.userId;
    const limit = 50; // Top 50

    console.log(`[Leaderboard] Fetching ${type} leaderboard for user ${userId}`);

    // Essayer de récupérer depuis le cache Redis
    const { rankingCacheService } = await import('../services/rankingCacheService');
    const cached = await rankingCacheService.getLeaderboard(type as string);
    
    if (cached && cached.length > 0) {
      console.log(`[Leaderboard] Cache hit with ${cached.length} entries`);
      
      // Récupérer les détails des utilisateurs depuis la base de données
      const userIds = cached.map(r => r.userId);
      const users = await User.find({ _id: { $in: userIds } })
        .select('name avatar reputation')
        .lean();
      
      console.log(`[Leaderboard] Found ${users.length} users in DB for ${userIds.length} cached IDs`);
      
      // Créer un map pour un accès rapide
      const userMap = new Map(users.map(u => [u._id.toString(), u]));
      
      // Combiner les données du cache avec les détails des utilisateurs
      const leaderboard = cached
        .map(r => {
          const user = userMap.get(r.userId);
          if (!user) {
            console.log(`[Leaderboard] User ${r.userId} not found in DB`);
            return null;
          }
          
          return {
            _id: r.userId,
            name: user.name,
            avatar: user.avatar,
            reputation: user.reputation,
            rank: r.rank,
          };
        })
        .filter(u => u !== null); // Filtrer les utilisateurs non trouvés
      
      console.log(`[Leaderboard] Returning ${leaderboard.length} valid users from cache`);
      
      // Si le cache ne retourne aucun utilisateur valide, invalider et refaire la requête
      if (leaderboard.length === 0) {
        console.log('[Leaderboard] Cache returned no valid users, invalidating and fetching fresh data...');
        await rankingCacheService.invalidateAll();
        // Ne pas retourner, continuer avec la requête normale
      } else {
        // Trouver le rang de l'utilisateur dans le cache
        let myRank = null;
        if (userId) {
          const userIndex = leaderboard.findIndex(u => u && u._id === userId);
          myRank = userIndex !== -1 ? userIndex + 1 : null;
        }

        res.json({
          leaderboard,
          myRank,
          type,
          cached: true,
        });
        return;
      }
    } else {
      console.log('[Leaderboard] Cache miss, fetching from DB');
    }

    let sortCriteria: any = {};
    let minCriteria: any = {};

    switch (type) {
      case 'creators':
        // Classement par nombre d'activités créées
        sortCriteria = { 'reputation.activitiesCreated': -1 };
        minCriteria = { 'reputation.activitiesCreated': { $gt: 0 } };
        break;
      
      case 'ratings':
        // Classement par note moyenne (minimum 3 avis pour être classé)
        sortCriteria = { 'reputation.averageRating': -1, 'reputation.totalReviews': -1 };
        minCriteria = { 'reputation.totalReviews': { $gte: 3 } };
        break;
      
      case 'active':
        // Classement par nombre d'activités complétées
        sortCriteria = { 'reputation.activitiesCompleted': -1 };
        minCriteria = { 'reputation.activitiesCompleted': { $gt: 0 } };
        break;
      
      default:
        sortCriteria = { 'reputation.activitiesCreated': -1 };
        minCriteria = { 'reputation.activitiesCreated': { $gt: 0 } };
    }

    // Récupérer le top du leaderboard
    const leaderboard = await User.find({
      ...minCriteria,
      'moderation.status': { $ne: 'banned' },
    })
      .select('name avatar reputation')
      .sort(sortCriteria)
      .limit(limit)
      .lean();

    // Préparer les données pour le cache et la détection de changements
    const rankingsData = leaderboard.map((user, index) => {
      let score = 0;
      switch (type) {
        case 'creators':
          score = user.reputation?.activitiesCreated || 0;
          break;
        case 'ratings':
          score = user.reputation?.averageRating || 0;
          break;
        case 'active':
          score = user.reputation?.activitiesCompleted || 0;
          break;
      }

      return {
        userId: user._id.toString(),
        rank: index + 1,
        score,
        category: type as 'creators' | 'ratings' | 'active',
      };
    });

    // DÉSACTIVÉ: Notifications de rang temporairement désactivées
    // const { rankNotificationService } = await import('../services/rankNotificationService');
    // const changes = await rankingCacheService.detectRankChanges(type as string, rankingsData);
    
    // if (changes.length > 0) {
    //   console.log(`[Leaderboard] Detected ${changes.length} rank changes for ${type}`);
    //   rankNotificationService.notifyRankChanges(changes).catch(err => {
    //     console.error('[Leaderboard] Error sending rank notifications:', err);
    //   });
    // }

    // Mettre en cache le nouveau leaderboard
    await rankingCacheService.cacheLeaderboard(type as string, rankingsData);

    console.log(`[Leaderboard] Returning ${leaderboard.length} users from DB (fresh data)`);

    // Trouver le rang de l'utilisateur actuel
    let myRank = null;
    if (userId) {
      const userIndex = rankingsData.findIndex(r => r.userId === userId);
      if (userIndex !== -1) {
        myRank = userIndex + 1;
      } else {
        // L'utilisateur n'est pas dans le top, chercher son rang exact
        const allUsers = await User.find({
          ...minCriteria,
          'moderation.status': { $ne: 'banned' },
        })
          .select('_id')
          .sort(sortCriteria)
          .lean();

        const allUserIndex = allUsers.findIndex(u => u._id.toString() === userId);
        if (allUserIndex !== -1) {
          myRank = allUserIndex + 1;
        }
      }
    }

    res.json({
      leaderboard,
      myRank,
      type,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Get public profile of a user (visible by others)
 */
export const getUserPublicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Récupérer l'utilisateur avec ses statistiques
    const user = await User.findById(userId)
      .select('name avatar interests goals reputation createdAt')
      .lean();

    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // Récupérer les activités créées par cet utilisateur
    const Activity = (await import('../models/activityModel')).default;
    const activities = await Activity.find({ 
      createdBy: userId,
      status: { $in: ['upcoming', 'ongoing', 'completed'] }
    })
      .select('title description category date location imageUrl status participants maxParticipants')
      .sort({ date: -1 })
      .limit(20)
      .lean();

    // Récupérer les avis reçus
    const Review = (await import('../models/reviewModel')).default;
    const reviews = await Review.find({ reviewee: userId })
      .populate('reviewer', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Calculer des statistiques supplémentaires
    const stats = {
      totalActivitiesCreated: user.reputation?.activitiesCreated || 0,
      totalActivitiesCompleted: user.reputation?.activitiesCompleted || 0,
      averageRating: user.reputation?.averageRating || 0,
      totalReviews: user.reputation?.totalReviews || 0,
      attendanceRate: user.reputation?.attendanceRate || 0,
      memberSince: user.createdAt,
    };

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        avatar: user.avatar,
        interests: user.interests,
        goals: user.goals,
      },
      stats,
      activities,
      reviews,
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
