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
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .populate('groupId', 'name avatar');


    res.status(201).json(populatedActivity);
  } catch (error: any) {
    console.error('Create activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'activité' });
  }
};

export const getActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, tags, maxDistance, ranked } = req.query;
    
    // Ne récupérer que les activités à venir et en cours
    // Temporairement, accepter aussi 'active' pour la rétrocompatibilité
    const query: any = { 
      status: { $in: ['upcoming', 'ongoing', 'active'] }
    };

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
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .sort({ date: 1 });

    console.log('[getActivities] Found activities (before date filter):', activities.length);
    if (activities.length > 0) {
      activities.forEach((act, idx) => {
        console.log(`[getActivities] Activity ${idx}:`, {
          id: act._id,
          title: act.title,
          status: act.status,
          date: act.date,
          duration: act.duration
        });
      });
    }

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

    // Appliquer le ranking si demandé
    if (ranked === 'true' && req.userId) {
      const user = await User.findById(req.userId);
      if (user && user.interests && user.goals && user.location?.coordinates) {
        const rankedActivities = rankingService.rankActivities(
          activities.map(a => a.toObject()),
          {
            userId: req.userId,
            userInterests: user.interests,
            userGoals: user.goals,
            userLocation: user.location.coordinates,
          }
        );
        
        res.json(rankedActivities);
        return;
      }
    }

    res.json(activities);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités' });
  }
};

export const getActivityById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('createdBy', 'name avatar interests goals')
      .populate('participants', 'name avatar interests');

    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
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

    res.json(populatedActivity);
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
      .populate('createdBy', 'name avatar')
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
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .lean();

    // Appliquer le ranking
    const rankedActivities = rankingService.rankActivities(
      activities,
      {
        userId: req.userId,
        userInterests: user.interests,
        userGoals: user.goals,
        userLocation: user.location.coordinates,
      }
    );

    // Filtrer pour ne garder que les recommandations (score > 70)
    const recommended = rankingService.getRecommendedActivities(rankedActivities);

    res.json(recommended);
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
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .lean();

    // Appliquer le ranking
    const rankedActivities = rankingService.rankActivities(
      activities,
      {
        userId: req.userId,
        userInterests: user.interests,
        userGoals: user.goals,
        userLocation: user.location.coordinates,
      }
    );

    // Filtrer pour ne garder que les tendances (score > 50)
    const trending = rankingService.getTrendingActivities(rankedActivities);

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
