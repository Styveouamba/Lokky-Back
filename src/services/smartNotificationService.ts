import User from '../models/userModel';
import Activity from '../models/activityModel';
import { sendPushNotificationToUser } from './notificationService';
import mongoose from 'mongoose';

/**
 * Calcule la distance entre deux points en kilomètres (formule de Haversine)
 */
const calculateDistance = (
  coords1: [number, number],
  coords2: [number, number]
): number => {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Vérifie si une activité correspond aux intérêts d'un utilisateur
 */
const matchesUserInterests = (
  activityCategory: string,
  activityTags: string[],
  userInterests: string[]
): boolean => {
  if (!userInterests || userInterests.length === 0) return false;

  // Vérifier si la catégorie correspond
  if (userInterests.includes(activityCategory)) return true;

  // Vérifier si un tag correspond
  return activityTags.some((tag) => userInterests.includes(tag));
};

/**
 * Envoie une notification aux utilisateurs proches quand une activité correspondant à leurs intérêts est créée
 */
export const notifyNearbyUsersForNewActivity = async (
  activityId: string | mongoose.Types.ObjectId,
  maxDistanceKm: number = 25 // Distance maximale par défaut: 25km
): Promise<void> => {
  try {
    const activity = await Activity.findById(activityId).populate(
      'createdBy',
      'name'
    );

    if (!activity) {
      console.error('Activity not found:', activityId);
      return;
    }

    // Ne pas notifier pour les activités annulées ou complétées
    if (activity.status !== 'upcoming') return;

    const activityCoords = activity.location.coordinates;
    const activityCategory = activity.category;
    const activityTags = activity.tags || [];

    // Trouver les utilisateurs dans un rayon de maxDistanceKm
    // Utiliser l'opérateur $geoNear pour une recherche géospatiale efficace
    const nearbyUsers = await User.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: activityCoords,
          },
          $maxDistance: maxDistanceKm * 1000, // Convertir en mètres
        },
      },
      _id: { $ne: activity.createdBy }, // Exclure le créateur
      pushToken: { $exists: true, $ne: null }, // Seulement ceux avec push token
      interests: { $exists: true, $ne: [] }, // Seulement ceux avec des intérêts
    }).select('_id name interests location pushToken');

    console.log(
      `[SmartNotification] Found ${nearbyUsers.length} nearby users for activity ${activityId}`
    );

    let notificationsSent = 0;

    for (const user of nearbyUsers) {
      // Vérifier si l'activité correspond aux intérêts de l'utilisateur
      if (
        !matchesUserInterests(
          activityCategory,
          activityTags,
          user.interests || []
        )
      ) {
        continue;
      }

      // Calculer la distance exacte
      const distance = calculateDistance(
        activityCoords,
        user.location?.coordinates || [0, 0]
      );

      // Créer le message de notification
      const distanceText =
        distance < 1
          ? 'à moins de 1 km'
          : distance < 5
            ? `à ${Math.round(distance)} km`
            : `à ${Math.round(distance)} km`;

      const title = '🎯 Nouvelle activité près de toi !';
      const body = `${activity.title} ${distanceText} - ${activity.location.name}`;

      // Envoyer la notification
      const sent = await sendPushNotificationToUser(user._id, title, body, {
        type: 'new_activity_nearby',
        activityId: activity._id.toString(),
        distance: Math.round(distance),
      });

      if (sent) {
        notificationsSent++;
      }
    }

    console.log(
      `[SmartNotification] Sent ${notificationsSent} notifications for activity ${activityId}`
    );
  } catch (error) {
    console.error('Error notifying nearby users:', error);
  }
};

/**
 * Envoie une notification quand une activité populaire se remplit rapidement
 */
export const notifyPopularActivityFilling = async (
  activityId: string | mongoose.Types.ObjectId
): Promise<void> => {
  try {
    const activity = await Activity.findById(activityId).populate(
      'createdBy',
      'name'
    );

    if (!activity) return;

    // Calculer le taux de remplissage
    const fillRate =
      (activity.participants.length / activity.maxParticipants) * 100;

    // Notifier seulement si l'activité est à 70% ou plus
    if (fillRate < 70) return;

    const spotsLeft = activity.maxParticipants - activity.participants.length;

    // Trouver les utilisateurs proches qui pourraient être intéressés
    const nearbyUsers = await User.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: activity.location.coordinates,
          },
          $maxDistance: 15000, // 15km pour les activités populaires
        },
      },
      _id: {
        $ne: activity.createdBy,
        $nin: activity.participants, // Exclure ceux qui participent déjà
      },
      pushToken: { $exists: true, $ne: null },
      interests: { $exists: true, $ne: [] },
    }).select('_id interests');

    let notificationsSent = 0;

    for (const user of nearbyUsers) {
      // Vérifier si l'activité correspond aux intérêts
      if (
        !matchesUserInterests(
          activity.category,
          activity.tags || [],
          user.interests || []
        )
      ) {
        continue;
      }

      const title = '🔥 Activité populaire !';
      const body =
        spotsLeft === 1
          ? `${activity.title} - Dernière place disponible !`
          : `${activity.title} - Plus que ${spotsLeft} places !`;

      const sent = await sendPushNotificationToUser(user._id, title, body, {
        type: 'popular_activity',
        activityId: activity._id.toString(),
        spotsLeft,
      });

      if (sent) {
        notificationsSent++;
      }
    }

    console.log(
      `[SmartNotification] Sent ${notificationsSent} popular activity notifications`
    );
  } catch (error) {
    console.error('Error notifying popular activity:', error);
  }
};

/**
 * Envoie des notifications de découverte aléatoires pour encourager l'exploration
 */
export const sendDiscoveryNotifications = async (): Promise<void> => {
  try {
    console.log('[SmartNotification] Starting discovery notifications...');

    // Récupérer tous les utilisateurs actifs avec push token
    const users = await User.find({
      pushToken: { $exists: true, $ne: null },
      interests: { $exists: true, $ne: [] },
      location: { $exists: true },
      'moderation.status': 'active',
    }).select('_id interests location reputation');

    console.log(`[SmartNotification] Found ${users.length} eligible users`);

    // Sélectionner aléatoirement 20% des utilisateurs (pour ne pas spammer)
    const selectedUsers = users
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.ceil(users.length * 0.2));

    console.log(
      `[SmartNotification] Selected ${selectedUsers.length} users for discovery notifications`
    );

    let notificationsSent = 0;

    for (const user of selectedUsers) {
      // Choisir aléatoirement un type de notification de découverte
      const notificationType = Math.random();

      if (notificationType < 0.4) {
        // 40% - Activité hors des intérêts habituels
        await sendNewCategoryNotification(user);
        notificationsSent++;
      } else if (notificationType < 0.7) {
        // 30% - Activité dans un nouveau lieu
        await sendNewLocationNotification(user);
        notificationsSent++;
      } else {
        // 30% - Activité avec créateur bien noté
        await sendTopCreatorNotification(user);
        notificationsSent++;
      }

      // Petit délai pour ne pas surcharger l'API Expo
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `[SmartNotification] Sent ${notificationsSent} discovery notifications`
    );
  } catch (error) {
    console.error('Error sending discovery notifications:', error);
  }
};

/**
 * Suggère une activité dans une catégorie que l'utilisateur n'a jamais essayée
 */
const sendNewCategoryNotification = async (user: any): Promise<void> => {
  try {
    const userInterests = user.interests || [];
    const exploredCategories = user.reputation?.categoriesExplored || [];

    // Toutes les catégories disponibles
    const allCategories = [
      'sport',
      'food',
      'culture',
      'nightlife',
      'outdoor',
      'gaming',
      'networking',
      'other',
    ];

    // Catégories non explorées
    const unexploredCategories = allCategories.filter(
      (cat) => !exploredCategories.includes(cat) && !userInterests.includes(cat)
    );

    if (unexploredCategories.length === 0) return;

    // Choisir une catégorie aléatoire
    const randomCategory =
      unexploredCategories[
        Math.floor(Math.random() * unexploredCategories.length)
      ];

    // Trouver une activité dans cette catégorie près de l'utilisateur
    const activities = await Activity.find({
      category: randomCategory,
      status: 'upcoming',
      date: { $gte: new Date() },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: user.location?.coordinates || [0, 0],
          },
          $maxDistance: 20000, // 20km
        },
      },
    })
      .limit(5)
      .populate('createdBy', 'name');

    if (activities.length === 0) return;

    // Choisir une activité aléatoire
    const activity = activities[Math.floor(Math.random() * activities.length)];

    const categoryNames: Record<string, string> = {
      sport: 'Sport',
      food: 'Gastronomie',
      culture: 'Culture',
      nightlife: 'Soirée',
      outdoor: 'Plein air',
      gaming: 'Gaming',
      networking: 'Networking',
      other: 'Autre',
    };

    const title = '🌟 Découvre quelque chose de nouveau !';
    const body = `${categoryNames[randomCategory]} : ${activity.title}`;

    await sendPushNotificationToUser(user._id, title, body, {
      type: 'discovery_new_category',
      activityId: activity._id.toString(),
      category: randomCategory,
    });
  } catch (error) {
    console.error('Error sending new category notification:', error);
  }
};

/**
 * Suggère une activité dans un nouveau lieu
 */
const sendNewLocationNotification = async (user: any): Promise<void> => {
  try {
    // Trouver des activités dans des lieux différents de ceux habituels
    // Pour simplifier, on cherche des activités un peu plus loin (10-25km)
    const activities = await Activity.find({
      status: 'upcoming',
      date: { $gte: new Date() },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: user.location?.coordinates || [0, 0],
          },
          $minDistance: 10000, // Minimum 10km
          $maxDistance: 25000, // Maximum 25km
        },
      },
    })
      .limit(5)
      .populate('createdBy', 'name');

    if (activities.length === 0) return;

    // Choisir une activité aléatoire
    const activity = activities[Math.floor(Math.random() * activities.length)];

    const distance = calculateDistance(
      user.location?.coordinates || [0, 0],
      activity.location.coordinates
    );

    const title = '🗺️ Explore un nouveau quartier !';
    const body = `${activity.title} à ${activity.location.name} (${Math.round(distance)} km)`;

    await sendPushNotificationToUser(user._id, title, body, {
      type: 'discovery_new_location',
      activityId: activity._id.toString(),
      distance: Math.round(distance),
    });
  } catch (error) {
    console.error('Error sending new location notification:', error);
  }
};

/**
 * Suggère une activité organisée par un créateur bien noté
 */
const sendTopCreatorNotification = async (user: any): Promise<void> => {
  try {
    const userInterests = user.interests || [];

    // Trouver des activités créées par des utilisateurs avec une bonne note
    const activities = await Activity.find({
      status: 'upcoming',
      date: { $gte: new Date() },
      category: { $in: userInterests },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: user.location?.coordinates || [0, 0],
          },
          $maxDistance: 20000, // 20km
        },
      },
    })
      .populate({
        path: 'createdBy',
        select: 'name reputation',
        match: {
          'reputation.averageRating': { $gte: 4.5 },
          'reputation.totalReviews': { $gte: 5 },
        },
      })
      .limit(10);

    // Filtrer les activités dont le créateur a été populé (note >= 4.5)
    const topCreatorActivities = activities.filter((a) => a.createdBy);

    if (topCreatorActivities.length === 0) return;

    // Choisir une activité aléatoire
    const activity =
      topCreatorActivities[
        Math.floor(Math.random() * topCreatorActivities.length)
      ];
    const creator = activity.createdBy as any;

    const title = '⭐ Créateur 5 étoiles !';
    const body = `${activity.title} par ${creator.name} (${creator.reputation?.averageRating?.toFixed(1)}⭐)`;

    await sendPushNotificationToUser(user._id, title, body, {
      type: 'discovery_top_creator',
      activityId: activity._id.toString(),
      creatorRating: creator.reputation?.averageRating,
    });
  } catch (error) {
    console.error('Error sending top creator notification:', error);
  }
};

export default {
  notifyNearbyUsersForNewActivity,
  notifyPopularActivityFilling,
  sendDiscoveryNotifications,
};
