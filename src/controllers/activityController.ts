import { Response } from 'express';
import fs from 'fs';
import Activity from '../models/activityModel';
import User from '../models/userModel';
import Group from '../models/groupModel';
import Message from '../models/messageModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadImage } from '../utils/cloudinary';
import { getIO } from '../socket/socketHandler';
import * as rankingService from '../services/rankingService';
import { rankingCacheService } from '../services/rankingCacheService';
import { checkActivityCreationAchievements, checkActivityJoinAchievements } from '../services/achievementService';
import diversityService from '../services/diversityService';
import { createRemindersForActivity, deleteRemindersForActivity, deleteAllRemindersForActivity } from '../services/activityReminderService';

export const createActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, tags, location, date, maxParticipants, imageUrl, duration } = req.body;

    // Validation
    if (!title || !category || !location || !date || !maxParticipants) {
      res.status(400).json({ message: 'Champs obligatoires manquants' });
      return;
    }

    // Vérifier que la date n'est pas passée
    if (new Date(date) < new Date()) {
      res.status(400).json({ message: 'La date ne peut pas être dans le passé' });
      return;
    }

    // Créer le groupe de discussion pour l'activité
    const group = await Group.create({
      name: title,
      description: description || `Groupe de discussion pour ${title}`,
      avatar: imageUrl,
      createdBy: req.userId,
      members: [req.userId],
      admins: [req.userId],
      isPrivate: false,
    });


    // Créer l'activité avec la référence au groupe
    const activity = await Activity.create({
      title,
      description,
      category,
      tags: tags || [],
      location,
      date,
      duration: duration || 2, // Durée par défaut de 2 heures
      maxParticipants,
      imageUrl,
      createdBy: req.userId,
      participants: [req.userId],
      status: 'upcoming',
      groupId: group._id,
    });

    const populatedActivity = await Activity.findById(activity._id)
      .populate('createdBy', 'name avatar reputation')
      .populate('participants', 'name avatar')
      .populate('groupId', 'name avatar');

    // Mettre à jour le compteur d'activités créées
    await User.findByIdAndUpdate(
      req.userId,
      { $inc: { 'reputation.activitiesCreated': 1 } }
    );

    // Invalider le cache des rankings
    await rankingCacheService.invalidateActivityCache(activity._id.toString());

    // Vérifier et attribuer les achievements
    const achievements = await checkActivityCreationAchievements(req.userId!);
    
    res.status(201).json({
      ...(populatedActivity?.toObject() || {}),
      newAchievements: achievements, // Envoyer les nouveaux achievements au frontend
    });
  } catch (error: any) {
    console.error('Create activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'activité' });
  }
};

export const getActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, tags, maxDistance, ranked, limit = '20', cursor, trackView = 'true' } = req.query;
    
    // Pagination stricte
    const limitNum = Math.min(parseInt(limit as string, 10), 100); // Max 100 par page
    
    // Ne récupérer que les activités à venir et en cours
    const query: any = { 
      status: { $in: ['upcoming', 'ongoing', 'active'] }
    };

    // Pagination avec curseur (plus efficace que skip/limit)
    if (cursor) {
      query._id = { $gt: cursor };
    }

    console.log('[getActivities] Query:', JSON.stringify(query));
    console.log('[getActivities] Current date:', new Date().toISOString());

    if (category) {
      query.category = category;
    }

    if (tags) {
      const tagArray = (tags as string).split(',');
      query.tags = { $in: tagArray };
    }

    let activities = await Activity.find(query)
      .populate('createdBy', 'name avatar reputation')
      .populate('participants', 'name avatar')
      .sort({ _id: 1 }) // Tri par _id pour pagination avec curseur
      .limit(limitNum + 1) // +1 pour savoir s'il y a une page suivante
      .lean();

    console.log('[getActivities] Found activities:', activities.length);

    // Vérifier s'il y a une page suivante
    const hasNextPage = activities.length > limitNum;
    if (hasNextPage) {
      activities = activities.slice(0, limitNum);
    }

    // Curseur pour la page suivante
    const nextCursor = hasNextPage && activities.length > 0
      ? activities[activities.length - 1]._id.toString()
      : null;

    // Filtrer par distance si demandé
    if (maxDistance && req.userId) {
      const user = await User.findById(req.userId);
      if (user?.location?.coordinates) {
        const userCoordinates = user.location.coordinates;
        activities = activities.filter(activity => {
          const distance = calculateDistance(
            userCoordinates,
            activity.location.coordinates
          );
          return distance <= Number(maxDistance);
        });
      }
    }

    // Appliquer le ranking avec diversité si demandé
    if (ranked === 'true' && req.userId) {
      const user = await User.findById(req.userId);
      if (user && user.interests && user.goals && user.location?.coordinates) {
        // 1. Calculer le ranking de base
        let rankedActivities = rankingService.rankActivities(
          activities,
          {
            userId: req.userId,
            userInterests: user.interests,
            userGoals: user.goals,
            userLocation: user.location.coordinates,
          },
          { addRandomness: true, randomnessFactor: 3 } // Ajouter un facteur aléatoire léger
        );

        // 2. Récupérer l'historique des vues de l'utilisateur
        const viewHistory = await diversityService.getUserViewHistory(req.userId, 30);

        // 3. Appliquer les facteurs de diversité
        rankedActivities = diversityService.applyDiversityBoost(
          rankedActivities,
          viewHistory,
          {
            userId: req.userId,
            explorationRate: 0.25, // 25% de chance de boost aléatoire
            categoryRotation: true,
            penalizeRecentViews: true,
          }
        );

        // 4. Injecter des activités "découverte" (score moyen)
        rankedActivities = diversityService.injectDiscoveryActivities(rankedActivities, 0.15);

        // 5. Re-trier après application de la diversité
        rankedActivities.sort((a, b) => {
          return (b.rankingScore?.totalScore || 0) - (a.rankingScore?.totalScore || 0);
        });

        // 6. Enregistrer les vues (en arrière-plan, sans bloquer la réponse)
        if (trackView === 'true' && rankedActivities.length > 0) {
          const activityIds = rankedActivities.slice(0, 20).map(a => a._id.toString());
          diversityService.recordBatchViews(req.userId, activityIds).catch(err => {
            console.error('[getActivities] Error recording views:', err);
          });
        }

        res.json({
          activities: rankedActivities.slice(0, limitNum),
          hasNextPage,
          nextCursor,
        });
        return;
      }
    }

    res.json({
      activities,
      hasNextPage,
      nextCursor,
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités' });
  }
};

export const getActivityById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('createdBy', 'name avatar interests goals reputation')
      .populate('participants', 'name avatar interests');

    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    // Enregistrer l'interaction (vue détaillée) si l'utilisateur est authentifié
    if (req.userId) {
      diversityService.recordView(req.userId, activity._id.toString(), true).catch(err => {
        console.error('[getActivityById] Error recording interaction:', err);
      });
    }

    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'activité' });
  }
};

export const joinActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    if (activity.status !== 'upcoming' && activity.status !== 'ongoing') {
      res.status(400).json({ message: 'Cette activité n\'est plus disponible' });
      return;
    }

    if (activity.participants.includes(req.userId as any)) {
      res.status(400).json({ message: 'Vous participez déjà à cette activité' });
      return;
    }

    if (activity.participants.length >= activity.maxParticipants) {
      res.status(400).json({ message: 'Cette activité est complète' });
      return;
    }

    // Récupérer les infos de l'utilisateur
    const user = await User.findById(req.userId).select('name avatar');

    // Ajouter l'utilisateur à l'activité
    activity.participants.push(req.userId as any);
    await activity.save();

    // Ajouter l'utilisateur au groupe de discussion
    if (activity.groupId) {
      const group = await Group.findById(activity.groupId);
      if (group && !group.members.includes(req.userId as any)) {
        group.members.push(req.userId as any);
        await group.save();

        // Créer un message système pour notifier les membres
        const systemMessage = await Message.create({
          group: group._id,
          sender: req.userId,
          content: `${user?.name} a rejoint l'activité`,
          isSystemMessage: true,
          systemMessageType: 'user_joined',
          read: false,
        });

        const populatedMessage = await Message.findById(systemMessage._id)
          .populate('sender', 'name avatar');

        // Émettre le message via Socket.IO
        const io = getIO();
        io.to(group._id.toString()).emit('new_message', populatedMessage);

        // Mettre à jour le lastMessage du groupe
        group.lastMessage = systemMessage.content;
        group.lastMessageAt = systemMessage.createdAt;
        group.lastMessageSender = user?.name;
        await group.save();
      }
    }

    const populatedActivity = await Activity.findById(activity._id)
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .populate('groupId', 'name avatar');

    // Créer les rappels pour cette activité (24h et 2h avant)
    await createRemindersForActivity(activity._id, req.userId!);

    // Vérifier et attribuer les achievements
    const achievements = await checkActivityJoinAchievements(req.userId!);

    res.json({
      ...(populatedActivity?.toObject() || {}),
      newAchievements: achievements, // Envoyer les nouveaux achievements au frontend
    });
  } catch (error) {
    console.error('Join activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la participation à l\'activité' });
  }
};

export const leaveActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    if (activity.createdBy.toString() === req.userId) {
      res.status(400).json({ message: 'Le créateur ne peut pas quitter l\'activité' });
      return;
    }

    // Récupérer les infos de l'utilisateur
    const user = await User.findById(req.userId).select('name avatar');

    // Retirer l'utilisateur de l'activité
    activity.participants = activity.participants.filter(
      p => p.toString() !== req.userId
    );
    await activity.save();

    // Retirer l'utilisateur du groupe de discussion
    if (activity.groupId) {
      const group = await Group.findById(activity.groupId);
      if (group) {
        group.members = group.members.filter(
          m => m.toString() !== req.userId
        );
        await group.save();

        // Créer un message système pour notifier les membres
        const systemMessage = await Message.create({
          group: group._id,
          sender: req.userId,
          content: `${user?.name} a quitté l'activité`,
          isSystemMessage: true,
          systemMessageType: 'user_left',
          read: false,
        });

        const populatedMessage = await Message.findById(systemMessage._id)
          .populate('sender', 'name avatar');

        // Émettre le message via Socket.IO
        const io = getIO();
        io.to(group._id.toString()).emit('new_message', populatedMessage);

        // Mettre à jour le lastMessage du groupe
        group.lastMessage = systemMessage.content;
        group.lastMessageAt = systemMessage.createdAt;
        group.lastMessageSender = user?.name;
        await group.save();
      }
    }

    // Supprimer les rappels de cet utilisateur pour cette activité
    await deleteRemindersForActivity(activity._id, req.userId!);

    res.json({ message: 'Vous avez quitté l\'activité' });
  } catch (error) {
    console.error('Leave activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la sortie de l\'activité' });
  }
};

export const updateActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    // Vérifier que l'utilisateur est le créateur
    if (activity.createdBy.toString() !== req.userId) {
      res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette activité' });
      return;
    }

    const { title, description, category, tags, location, date, maxParticipants, imageUrl, status } = req.body;

    // Mettre à jour les champs
    if (title) activity.title = title;
    if (description !== undefined) activity.description = description;
    if (category) activity.category = category;
    if (tags) activity.tags = tags;
    if (location) activity.location = location;
    if (date) activity.date = date;
    if (maxParticipants) activity.maxParticipants = maxParticipants;
    if (imageUrl !== undefined) activity.imageUrl = imageUrl;
    if (status) activity.status = status;

    await activity.save();

    // Si l'image a été mise à jour et qu'il y a un groupe associé, mettre à jour l'avatar du groupe
    if (imageUrl !== undefined && activity.groupId) {
      try {
        await Group.findByIdAndUpdate(activity.groupId, {
          avatar: imageUrl,
        });
      } catch (groupError) {
        console.error('Error updating group avatar:', groupError);
        // Ne pas bloquer la mise à jour de l'activité si la mise à jour du groupe échoue
      }
    }

    const updatedActivity = await Activity.findById(activity._id)
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar');

    res.json(updatedActivity);
  } catch (error: any) {
    console.error('Update activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'activité' });
  }
};

export const deleteActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    // Vérifier que l'utilisateur est le créateur
    if (activity.createdBy.toString() !== req.userId) {
      res.status(403).json({ message: 'Vous n\'êtes pas autorisé à supprimer cette activité' });
      return;
    }

    // Supprimer tous les rappels de cette activité
    await deleteAllRemindersForActivity(req.params.id);

    await Activity.findByIdAndDelete(req.params.id);

    res.json({ message: 'Activité supprimée avec succès' });
  } catch (error: any) {
    console.error('Delete activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'activité' });
  }
};

export const getMyActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activities = await Activity.find({ createdBy: req.userId })
      .populate('createdBy', 'name avatar reputation')
      .populate('participants', 'name avatar')
      .sort({ date: 1 });

    res.json(activities);
  } catch (error) {
    console.error('Get my activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de vos activités' });
  }
};

// Fonction helper pour calculer la distance
function calculateDistance(coords1: number[], coords2: number[]): number {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const uploadActivityImage = async (req: AuthRequest, res: Response): Promise<void> => {
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

    res.json({ imageUrl: result });
  } catch (error: any) {
    // Supprimer le fichier temporaire en cas d'erreur
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting temporary file after error:', unlinkError);
      }
    }
    
    console.error('Upload activity image error:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload de l\'image',
      error: error.message 
    });
  }
};


// Récupérer les activités recommandées (score > 70)
export const getRecommendedActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user || !user.interests || !user.goals || !user.location?.coordinates) {
      res.status(400).json({ message: 'Profil incomplet. Veuillez compléter vos intérêts, objectifs et localisation.' });
      return;
    }

    // Récupérer toutes les activités actives (upcoming et ongoing)
    const activities = await Activity.find({
      status: { $in: ['upcoming', 'ongoing'] },
      date: { $gte: new Date() }
    })
      .populate('createdBy', 'name avatar reputation')
      .populate('participants', 'name avatar')
      .lean();

    // 1. Appliquer le ranking de base avec randomness
    let rankedActivities = rankingService.rankActivities(
      activities,
      {
        userId: req.userId,
        userInterests: user.interests,
        userGoals: user.goals,
        userLocation: user.location.coordinates,
      },
      { addRandomness: true, randomnessFactor: 5 } // Plus de randomness pour les recommandations
    );

    // 2. Récupérer l'historique des vues
    const viewHistory = await diversityService.getUserViewHistory(req.userId, 30);

    // 3. Appliquer les facteurs de diversité
    rankedActivities = diversityService.applyDiversityBoost(
      rankedActivities,
      viewHistory,
      {
        userId: req.userId,
        explorationRate: 0.3, // 30% d'exploration pour les recommandations
        categoryRotation: true,
        penalizeRecentViews: true,
      }
    );

    // 4. Re-trier après diversité
    rankedActivities.sort((a, b) => {
      return (b.rankingScore?.totalScore || 0) - (a.rankingScore?.totalScore || 0);
    });

    // 5. Filtrer pour ne garder que les bonnes recommandations (score > 60)
    // Score abaissé de 70 à 60 pour permettre plus de diversité
    const recommended = rankedActivities.filter(
      activity => (activity.rankingScore?.totalScore || 0) >= 60
    );

    // 6. Injecter quelques activités découverte
    const finalRecommendations = diversityService.injectDiscoveryActivities(recommended, 0.2);

    res.json(finalRecommendations);
  } catch (error) {
    console.error('Get recommended activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités recommandées' });
  }
};


// Récupérer les activités tendance (score > 50)
export const getTrendingActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user || !user.interests || !user.goals || !user.location?.coordinates) {
      res.status(400).json({ message: 'Profil incomplet. Veuillez compléter vos intérêts, objectifs et localisation.' });
      return;
    }

    // Récupérer toutes les activités actives (upcoming et ongoing)
    const activities = await Activity.find({
      status: { $in: ['upcoming', 'ongoing'] },
      date: { $gte: new Date() }
    })
      .populate('createdBy', 'name avatar reputation')
      .populate('participants', 'name avatar')
      .lean();

    // 1. Appliquer le ranking avec randomness
    let rankedActivities = rankingService.rankActivities(
      activities,
      {
        userId: req.userId,
        userInterests: user.interests,
        userGoals: user.goals,
        userLocation: user.location.coordinates,
      },
      { addRandomness: true, randomnessFactor: 4 }
    );

    // 2. Récupérer l'historique des vues
    const viewHistory = await diversityService.getUserViewHistory(req.userId, 30);

    // 3. Appliquer la diversité avec moins de pénalités pour les tendances
    rankedActivities = diversityService.applyDiversityBoost(
      rankedActivities,
      viewHistory,
      {
        userId: req.userId,
        explorationRate: 0.35, // Plus d'exploration pour les tendances
        categoryRotation: true,
        penalizeRecentViews: false, // Pas de pénalité pour les vues récentes dans les tendances
      }
    );

    // 4. Re-trier
    rankedActivities.sort((a, b) => {
      return (b.rankingScore?.totalScore || 0) - (a.rankingScore?.totalScore || 0);
    });

    // 5. Filtrer pour ne garder que les tendances (score > 45)
    // Score abaissé pour plus de diversité
    const trending = rankedActivities.filter(
      activity => (activity.rankingScore?.totalScore || 0) >= 45
    );

    res.json(trending);
  } catch (error) {
    console.error('Get trending activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités tendance' });
  }
};



// Récupérer les activités passées d'un utilisateur
export const getUserPastActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { getUserPastActivities } = await import('../services/activityLifecycleService');
    const activities = await getUserPastActivities(req.userId!);
    res.json(activities);
  } catch (error) {
    console.error('Get user past activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités passées' });
  }
};

// Récupérer les activités à venir d'un utilisateur
export const getUserUpcomingActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { getUserUpcomingActivities } = await import('../services/activityLifecycleService');
    const activities = await getUserUpcomingActivities(req.userId!);
    res.json(activities);
  } catch (error) {
    console.error('Get user upcoming activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités à venir' });
  }
};

// Mettre à jour le statut d'une activité (calcul dynamique)
export const updateActivityStatusEndpoint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { updateActivityStatus } = await import('../services/activityLifecycleService');
    const activity = await updateActivityStatus(req.params.id);
    
    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    res.json(activity);
  } catch (error) {
    console.error('Update activity status error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut' });
  }
};

// Route publique pour récupérer une activité (pour la landing page)
export const getPublicActivity = async (req: any, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .lean();

    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    // Cast pour TypeScript
    const createdBy = activity.createdBy as any;
    const participants = activity.participants as any[];

    // Ne retourner que les informations publiques
    const publicActivity = {
      _id: activity._id,
      title: activity.title,
      description: activity.description,
      category: activity.category,
      location: activity.location,
      date: activity.date,
      duration: activity.duration,
      maxParticipants: activity.maxParticipants,
      imageUrl: activity.imageUrl,
      createdBy: {
        _id: createdBy._id,
        name: createdBy.name,
        avatar: createdBy.avatar,
      },
      participants: participants.map((p: any) => ({
        _id: p._id,
        name: p.name,
        avatar: p.avatar,
      })),
    };

    res.json(publicActivity);
  } catch (error) {
    console.error('Get public activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'activité' });
  }
};

// Obtenir les statistiques de diversité de l'utilisateur
export const getUserDiversityStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    const stats = await diversityService.getUserViewStats(req.userId);
    res.json(stats);
  } catch (error) {
    console.error('Get user diversity stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
};

// Nettoyer l'historique des vues pour une activité (admin ou créateur)
export const clearActivityViewHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id);
    
    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    // Vérifier que l'utilisateur est le créateur ou admin
    const user = await User.findById(req.userId);
    if (activity.createdBy.toString() !== req.userId && user?.role !== 'admin') {
      res.status(403).json({ message: 'Non autorisé' });
      return;
    }

    await diversityService.clearActivityHistory(req.params.id);
    res.json({ message: 'Historique des vues nettoyé avec succès' });
  } catch (error) {
    console.error('Clear activity view history error:', error);
    res.status(500).json({ message: 'Erreur lors du nettoyage de l\'historique' });
  }
};
