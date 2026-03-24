import Achievement from '../models/achievementModel';
import User from '../models/userModel';
import Activity from '../models/activityModel';
import mongoose from 'mongoose';

// Définition des achievements disponibles
const ACHIEVEMENTS = {
  first_activity_created: {
    title: '🎯 Premier pas',
    description: 'Félicitations pour ta première activité créée!',
    icon: '🎯',
  },
  first_activity_joined: {
    title: '👋 Première sortie',
    description: 'Bravo! Tu as rejoint ta première activité!',
    icon: '👋',
  },
  first_review: {
    title: '⭐ Premier avis',
    description: 'Merci d\'avoir partagé ton expérience!',
    icon: '⭐',
  },
  first_message: {
    title: '💬 Sociable',
    description: 'Tu as envoyé ton premier message!',
    icon: '💬',
  },
  activities_5: {
    title: '🔥 Actif',
    description: 'Tu as participé à 5 activités!',
    icon: '🔥',
  },
  activities_10: {
    title: '👑 Légende',
    description: 'Incroyable! 10 activités complétées!',
    icon: '👑',
  },
  perfect_attendance: {
    title: '✅ Toujours présent',
    description: '100% de présence à tes activités!',
    icon: '✅',
  },
  social_butterfly: {
    title: '🦋 Papillon social',
    description: 'Tu as rencontré 20 personnes différentes!',
    icon: '🦋',
  },
};

/**
 * Vérifie et attribue un achievement à un utilisateur
 */
export const checkAndAwardAchievement = async (
  userId: string | mongoose.Types.ObjectId,
  achievementType: keyof typeof ACHIEVEMENTS
): Promise<{ awarded: boolean; achievement?: any }> => {
  try {
    // Vérifier si l'achievement existe déjà
    const existing = await Achievement.findOne({
      user: userId,
      type: achievementType,
    });

    if (existing) {
      return { awarded: false };
    }

    // Créer le nouvel achievement
    const achievementData = ACHIEVEMENTS[achievementType];
    const achievement = await Achievement.create({
      user: userId,
      type: achievementType,
      title: achievementData.title,
      description: achievementData.description,
      icon: achievementData.icon,
      seen: false,
    });

    console.log(`🏆 Achievement awarded: ${achievementType} to user ${userId}`);

    return { awarded: true, achievement };
  } catch (error) {
    console.error('Error awarding achievement:', error);
    return { awarded: false };
  }
};

/**
 * Vérifie les achievements après création d'activité
 */
export const checkActivityCreationAchievements = async (
  userId: string | mongoose.Types.ObjectId
): Promise<any[]> => {
  const awarded = [];

  // Premier achievement: première activité créée
  const firstActivity = await checkAndAwardAchievement(userId, 'first_activity_created');
  if (firstActivity.awarded) {
    awarded.push(firstActivity.achievement);
  }

  // Compter le nombre d'activités créées
  const activitiesCount = await Activity.countDocuments({
    createdBy: userId,
  });

  // Achievement pour 5 activités
  if (activitiesCount >= 5) {
    const activities5 = await checkAndAwardAchievement(userId, 'activities_5');
    if (activities5.awarded) {
      awarded.push(activities5.achievement);
    }
  }

  // Achievement pour 10 activités
  if (activitiesCount >= 10) {
    const activities10 = await checkAndAwardAchievement(userId, 'activities_10');
    if (activities10.awarded) {
      awarded.push(activities10.achievement);
    }
  }

  return awarded;
};

/**
 * Vérifie les achievements après participation à une activité
 */
export const checkActivityJoinAchievements = async (
  userId: string | mongoose.Types.ObjectId
): Promise<any[]> => {
  const awarded = [];

  // Premier achievement: première participation
  const firstJoin = await checkAndAwardAchievement(userId, 'first_activity_joined');
  if (firstJoin.awarded) {
    awarded.push(firstJoin.achievement);
  }

  // Compter le nombre de participations
  const participationsCount = await Activity.countDocuments({
    participants: userId,
  });

  // Achievement pour 5 participations
  if (participationsCount >= 5) {
    const activities5 = await checkAndAwardAchievement(userId, 'activities_5');
    if (activities5.awarded) {
      awarded.push(activities5.achievement);
    }
  }

  // Achievement pour 10 participations
  if (participationsCount >= 10) {
    const activities10 = await checkAndAwardAchievement(userId, 'activities_10');
    if (activities10.awarded) {
      awarded.push(activities10.achievement);
    }
  }

  // Vérifier le taux de présence pour "perfect_attendance"
  const user = await User.findById(userId);
  if (user && user.reputation && user.reputation.attendanceRate === 100 && participationsCount >= 5) {
    const perfectAttendance = await checkAndAwardAchievement(userId, 'perfect_attendance');
    if (perfectAttendance.awarded) {
      awarded.push(perfectAttendance.achievement);
    }
  }

  return awarded;
};

/**
 * Vérifie les achievements après un premier message
 */
export const checkMessageAchievements = async (
  userId: string | mongoose.Types.ObjectId
): Promise<any[]> => {
  const awarded = [];

  const firstMessage = await checkAndAwardAchievement(userId, 'first_message');
  if (firstMessage.awarded) {
    awarded.push(firstMessage.achievement);
  }

  return awarded;
};

/**
 * Vérifie les achievements après un premier avis
 */
export const checkReviewAchievements = async (
  userId: string | mongoose.Types.ObjectId
): Promise<any[]> => {
  const awarded = [];

  const firstReview = await checkAndAwardAchievement(userId, 'first_review');
  if (firstReview.awarded) {
    awarded.push(firstReview.achievement);
  }

  return awarded;
};

/**
 * Récupère tous les achievements d'un utilisateur
 */
export const getUserAchievements = async (
  userId: string | mongoose.Types.ObjectId
): Promise<any[]> => {
  return await Achievement.find({ user: userId }).sort({ earnedAt: -1 });
};

/**
 * Récupère les achievements non vus d'un utilisateur
 */
export const getUnseenAchievements = async (
  userId: string | mongoose.Types.ObjectId
): Promise<any[]> => {
  return await Achievement.find({ user: userId, seen: false }).sort({ earnedAt: -1 });
};

/**
 * Marque un achievement comme vu
 */
export const markAchievementAsSeen = async (
  achievementId: string
): Promise<void> => {
  await Achievement.findByIdAndUpdate(achievementId, { seen: true });
};

/**
 * Marque tous les achievements d'un utilisateur comme vus
 */
export const markAllAchievementsAsSeen = async (
  userId: string | mongoose.Types.ObjectId
): Promise<void> => {
  await Achievement.updateMany({ user: userId, seen: false }, { seen: true });
};
