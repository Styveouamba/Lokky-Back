import { IActivity } from '../models/activityModel';

interface RankingCriteria {
  userId: string;
  userInterests: string[];
  userGoals: string[];
  userLocation: [number, number]; // [longitude, latitude]
}

interface ActivityScore {
  activityId: string;
  totalScore: number;
  breakdown: {
    interests: number;
    goals: number;
    proximity: number;
    popularity: number;
    freshness: number;
  };
}

interface RankedActivity extends IActivity {
  rankingScore?: ActivityScore;
}

// Mapping des catégories d'activités vers les objectifs utilisateur
const CATEGORY_TO_GOALS_MAP: Record<string, string[]> = {
  sport: ['sport', 'friends'],
  culture: ['learn', 'discover'],
  food: ['hangout', 'discover'],
  music: ['hangout', 'friends'],
  art: ['learn', 'discover'],
  tech: ['learn', 'network'],
  nature: ['discover', 'friends'],
  gaming: ['hangout', 'friends'],
  social: ['friends', 'network', 'hangout'],
  learning: ['learn', 'network'],
};

/**
 * Calcule la distance entre deux points géographiques en km
 * Utilise la formule de Haversine
 */
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

/**
 * Calcule le score d'intérêts communs (30% du score total)
 * Si l'utilisateur n'a pas d'intérêts, retourne un score neutre pour permettre un tri aléatoire
 */
function calculateInterestsScore(
  userInterests: string[],
  activityTags: string[]
): number {
  // Si l'utilisateur n'a pas d'intérêts, retourne un score neutre (15 points = 50% du max)
  // Cela permet un tri plus aléatoire basé sur les autres critères
  if (!userInterests || userInterests.length === 0) return 15;
  
  if (!activityTags || activityTags.length === 0) return 0;

  // Compter les intérêts communs
  const commonInterests = userInterests.filter(interest =>
    activityTags.includes(interest)
  );

  // Score = (intérêts communs / total intérêts utilisateur) × 30
  const score = (commonInterests.length / userInterests.length) * 30;
  
  return Math.min(score, 30); // Max 30 points
}

/**
 * Calcule le score d'objectifs communs (20% du score total)
 */
function calculateGoalsScore(
  userGoals: string[],
  activityCategory: string
): number {
  if (!userGoals || userGoals.length === 0) return 0;
  if (!activityCategory) return 0;

  // Récupérer les objectifs correspondant à la catégorie
  const categoryGoals = CATEGORY_TO_GOALS_MAP[activityCategory.toLowerCase()] || [];
  
  // Compter les objectifs matchés
  const matchedGoals = userGoals.filter(goal =>
    categoryGoals.includes(goal)
  );

  // Score = (objectifs matchés / total objectifs) × 20
  const score = (matchedGoals.length / userGoals.length) * 20;
  
  return Math.min(score, 20); // Max 20 points
}

/**
 * Calcule le score de proximité (25% du score total)
 */
function calculateProximityScore(
  userLocation: number[],
  activityLocation: number[]
): number {
  if (!userLocation || !activityLocation) return 0;

  const distance = calculateDistance(userLocation, activityLocation);
  
  // Formule : max(0, 25 - (distance / 2))
  // 0-2 km → 25 points
  // 5 km → 22.5 points
  // 10 km → 20 points
  // 50+ km → 0 points
  const score = Math.max(0, 25 - (distance / 2));
  
  return Math.min(score, 25); // Max 25 points
}

/**
 * Calcule le score de popularité (15% du score total)
 */
function calculatePopularityScore(
  currentParticipants: number,
  maxParticipants: number
): number {
  if (maxParticipants === 0) return 0;

  const fillRate = currentParticipants / maxParticipants;
  
  // Score de base = taux de remplissage × 15
  let score = fillRate * 15;
  
  // Bonus si presque complet (80-95%) pour créer l'urgence
  if (fillRate >= 0.8 && fillRate < 0.95) {
    score += 3; // Bonus de 3 points
  }
  
  return Math.min(score, 15); // Max 15 points
}

/**
 * Calcule le score de fraîcheur (10% du score total)
 */
function calculateFreshnessScore(createdAt: Date): number {
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  // Formule : max(0, 10 - (heures / 24))
  // < 1h → 10 points
  // 12h → 5 points
  // 24h+ → 0 points
  const score = Math.max(0, 10 - (hoursSinceCreation / 24) * 10);
  
  return Math.min(score, 10); // Max 10 points
}

/**
 * Calcule le score total d'une activité pour un utilisateur
 */
export function calculateActivityScore(
  activity: any,
  criteria: RankingCriteria
): ActivityScore {
  const interestsScore = calculateInterestsScore(
    criteria.userInterests,
    activity.tags || []
  );

  const goalsScore = calculateGoalsScore(
    criteria.userGoals,
    activity.category
  );

  const proximityScore = calculateProximityScore(
    criteria.userLocation,
    activity.location?.coordinates || []
  );

  const popularityScore = calculatePopularityScore(
    activity.participants?.length || 0,
    activity.maxParticipants || 1
  );

  const freshnessScore = calculateFreshnessScore(
    activity.createdAt
  );

  const totalScore = 
    interestsScore +
    goalsScore +
    proximityScore +
    popularityScore +
    freshnessScore;

  return {
    activityId: activity._id.toString(),
    totalScore: Math.round(totalScore * 100) / 100, // Arrondir à 2 décimales
    breakdown: {
      interests: Math.round(interestsScore * 100) / 100,
      goals: Math.round(goalsScore * 100) / 100,
      proximity: Math.round(proximityScore * 100) / 100,
      popularity: Math.round(popularityScore * 100) / 100,
      freshness: Math.round(freshnessScore * 100) / 100,
    },
  };
}

/**
 * Classe et retourne les activités par score de pertinence
 * Si l'utilisateur n'a pas d'intérêts, ajoute un facteur aléatoire pour varier les résultats
 */
export function rankActivities(
  activities: any[],
  criteria: RankingCriteria
): RankedActivity[] {
  const hasNoInterests = !criteria.userInterests || criteria.userInterests.length === 0;
  
  // Calculer le score pour chaque activité
  const activitiesWithScores = activities.map(activity => {
    const score = calculateActivityScore(activity, criteria);
    
    // Si pas d'intérêts, ajouter un petit facteur aléatoire (0-5 points) pour varier l'ordre
    if (hasNoInterests) {
      const randomBonus = Math.random() * 5;
      score.totalScore += randomBonus;
      score.breakdown.interests += randomBonus;
    }
    
    return {
      ...activity,
      rankingScore: score,
    };
  });

  // Trier par score décroissant
  activitiesWithScores.sort((a, b) => {
    return (b.rankingScore?.totalScore || 0) - (a.rankingScore?.totalScore || 0);
  });

  return activitiesWithScores;
}

/**
 * Filtre les activités avec un score minimum
 */
export function filterByMinScore(
  rankedActivities: RankedActivity[],
  minScore: number = 30
): RankedActivity[] {
  return rankedActivities.filter(
    activity => (activity.rankingScore?.totalScore || 0) >= minScore
  );
}

/**
 * Récupère les activités recommandées (score > 70)
 */
export function getRecommendedActivities(
  rankedActivities: RankedActivity[]
): RankedActivity[] {
  return filterByMinScore(rankedActivities, 70);
}

/**
 * Récupère les activités tendance (score > 50)
 */
export function getTrendingActivities(
  rankedActivities: RankedActivity[]
): RankedActivity[] {
  return filterByMinScore(rankedActivities, 50);
}
