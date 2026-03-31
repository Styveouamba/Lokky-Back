import ActivityViewHistory from '../models/activityViewHistoryModel';
import { IActivity } from '../models/activityModel';

interface DiversityOptions {
  userId: string;
  explorationRate?: number; // 0-1, taux d'exploration vs exploitation (défaut: 0.3)
  categoryRotation?: boolean; // Forcer la rotation des catégories (défaut: true)
  penalizeRecentViews?: boolean; // Pénaliser les vues récentes (défaut: true)
}

interface ViewStats {
  activityId: string;
  viewCount: number;
  lastViewedAt: Date;
  interacted: boolean;
  daysSinceLastView: number;
}

/**
 * Service de diversité pour améliorer la variété du feed d'activités
 */
class DiversityService {
  /**
   * Récupère l'historique des vues récentes de l'utilisateur (30 derniers jours)
   */
  async getUserViewHistory(userId: string, days: number = 30): Promise<ViewStats[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const views = await ActivityViewHistory.aggregate([
      {
        $match: {
          userId: userId,
          viewedAt: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: '$activityId',
          viewCount: { $sum: 1 },
          lastViewedAt: { $max: '$viewedAt' },
          interacted: { $max: '$interacted' },
        },
      },
    ]);

    const now = new Date();
    return views.map(view => ({
      activityId: view._id.toString(),
      viewCount: view.viewCount,
      lastViewedAt: view.lastViewedAt,
      interacted: view.interacted,
      daysSinceLastView: Math.floor((now.getTime() - view.lastViewedAt.getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }

  /**
   * Enregistre qu'un utilisateur a vu une activité
   */
  async recordView(userId: string, activityId: string, interacted: boolean = false): Promise<void> {
    await ActivityViewHistory.create({
      userId,
      activityId,
      interacted,
    });
  }

  /**
   * Enregistre plusieurs vues en batch
   */
  async recordBatchViews(userId: string, activityIds: string[]): Promise<void> {
    const views = activityIds.map(activityId => ({
      userId,
      activityId,
      interacted: false,
    }));

    await ActivityViewHistory.insertMany(views, { ordered: false });
  }

  /**
   * Calcule un score de pénalité basé sur l'historique de vues
   * Plus l'activité a été vue récemment et fréquemment, plus la pénalité est élevée
   */
  calculateViewPenalty(viewStats: ViewStats | undefined): number {
    if (!viewStats) return 0;

    const { viewCount, daysSinceLastView, interacted } = viewStats;

    // Pénalité de base selon le nombre de vues
    let penalty = viewCount * 5; // -5 points par vue

    // Pénalité selon la récence
    if (daysSinceLastView < 1) {
      penalty += 20; // Vue aujourd'hui: -20 points
    } else if (daysSinceLastView < 3) {
      penalty += 15; // Vue dans les 3 derniers jours: -15 points
    } else if (daysSinceLastView < 7) {
      penalty += 10; // Vue dans la dernière semaine: -10 points
    } else if (daysSinceLastView < 14) {
      penalty += 5; // Vue dans les 2 dernières semaines: -5 points
    }

    // Bonus si l'utilisateur n'a pas interagi (juste scrollé)
    if (!interacted && viewCount === 1) {
      penalty = penalty * 0.5; // Réduire la pénalité de 50%
    }

    return Math.min(penalty, 40); // Pénalité max: -40 points
  }

  /**
   * Applique un facteur de diversité aux activités classées
   * Mélange exploration (nouvelles découvertes) et exploitation (préférences connues)
   */
  applyDiversityBoost(
    activities: any[],
    viewHistory: ViewStats[],
    options: DiversityOptions
  ): any[] {
    const {
      explorationRate = 0.3,
      categoryRotation = true,
      penalizeRecentViews = true,
    } = options;

    // Créer un map pour accès rapide à l'historique
    const viewMap = new Map(viewHistory.map(v => [v.activityId, v]));

    // Tracker les catégories déjà vues
    const seenCategories = new Set<string>();
    const categoryCount = new Map<string, number>();

    return activities.map((activity, index) => {
      let diversityBonus = 0;
      const activityId = activity._id.toString();
      const viewStats = viewMap.get(activityId);

      // 1. Pénalité pour les vues récentes
      if (penalizeRecentViews && viewStats) {
        const penalty = this.calculateViewPenalty(viewStats);
        diversityBonus -= penalty;
      }

      // 2. Bonus pour les activités jamais vues
      if (!viewStats) {
        diversityBonus += 15; // +15 points pour la nouveauté
      }

      // 3. Bonus d'exploration aléatoire
      // Certaines activités reçoivent un boost aléatoire pour encourager la découverte
      if (Math.random() < explorationRate) {
        diversityBonus += Math.random() * 20; // Boost aléatoire jusqu'à +20 points
      }

      // 4. Rotation des catégories
      if (categoryRotation && activity.category) {
        const category = activity.category;
        const count = categoryCount.get(category) || 0;
        categoryCount.set(category, count + 1);

        // Pénaliser si cette catégorie apparaît trop souvent dans le top
        if (index < 20 && count > 3) {
          diversityBonus -= count * 3; // -3 points par occurrence supplémentaire
        }

        // Bonus pour les catégories peu vues
        if (!seenCategories.has(category) && index < 50) {
          diversityBonus += 8; // +8 points pour une nouvelle catégorie
          seenCategories.add(category);
        }
      }

      // 5. Bonus de position pour éviter que les mêmes soient toujours en haut
      // Ajouter un petit facteur aléatoire qui diminue avec le score
      const positionRandomness = (100 - (activity.rankingScore?.totalScore || 0)) * 0.1 * Math.random();
      diversityBonus += positionRandomness;

      return {
        ...activity,
        rankingScore: {
          ...activity.rankingScore,
          totalScore: (activity.rankingScore?.totalScore || 0) + diversityBonus,
          breakdown: {
            ...activity.rankingScore?.breakdown,
            diversity: Math.round(diversityBonus * 100) / 100,
          },
        },
      };
    });
  }

  /**
   * Applique un shuffle partiel pour mélanger légèrement l'ordre
   * Utile pour éviter que l'utilisateur voie exactement le même ordre à chaque fois
   */
  partialShuffle<T>(array: T[], shuffleRate: number = 0.2): T[] {
    const result = [...array];
    const shuffleCount = Math.floor(array.length * shuffleRate);

    for (let i = 0; i < shuffleCount; i++) {
      const idx1 = Math.floor(Math.random() * array.length);
      const idx2 = Math.floor(Math.random() * array.length);
      [result[idx1], result[idx2]] = [result[idx2], result[idx1]];
    }

    return result;
  }

  /**
   * Injecte des activités "découverte" dans le feed
   * Prend des activités avec un score moyen et les insère stratégiquement
   */
  injectDiscoveryActivities(
    activities: any[],
    discoveryRate: number = 0.15
  ): any[] {
    if (activities.length < 10) return activities;

    const topActivities: any[] = [];
    const midActivities: any[] = [];
    const lowActivities: any[] = [];

    // Séparer en 3 groupes selon le score
    activities.forEach(activity => {
      const score = activity.rankingScore?.totalScore || 0;
      if (score >= 70) {
        topActivities.push(activity);
      } else if (score >= 40) {
        midActivities.push(activity);
      } else {
        lowActivities.push(activity);
      }
    });

    // Calculer combien d'activités "découverte" injecter
    const discoveryCount = Math.floor(topActivities.length * discoveryRate);
    
    // Mélanger les activités moyennes
    const shuffledMid = this.partialShuffle(midActivities, 0.8);
    const discoveryActivities = shuffledMid.slice(0, discoveryCount);

    // Injecter les découvertes à des positions stratégiques
    const result = [...topActivities];
    const injectionInterval = Math.floor(topActivities.length / (discoveryCount + 1));

    discoveryActivities.forEach((activity, index) => {
      const position = (index + 1) * injectionInterval;
      result.splice(position, 0, activity);
    });

    // Ajouter le reste à la fin
    result.push(...midActivities.filter(a => !discoveryActivities.includes(a)));
    result.push(...lowActivities);

    return result;
  }

  /**
   * Nettoie l'historique des vues pour une activité spécifique
   * Utile quand une activité est mise à jour significativement
   */
  async clearActivityHistory(activityId: string): Promise<void> {
    await ActivityViewHistory.deleteMany({ activityId });
  }

  /**
   * Obtient des statistiques sur les vues d'un utilisateur
   */
  async getUserViewStats(userId: string): Promise<{
    totalViews: number;
    uniqueActivities: number;
    averageViewsPerActivity: number;
    mostViewedCategories: { category: string; count: number }[];
  }> {
    const views = await ActivityViewHistory.find({ userId })
      .populate('activityId', 'category')
      .lean();

    const uniqueActivities = new Set(views.map(v => v.activityId.toString())).size;
    const categoryCount = new Map<string, number>();

    views.forEach(view => {
      const category = (view.activityId as any)?.category;
      if (category) {
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      }
    });

    const mostViewedCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalViews: views.length,
      uniqueActivities,
      averageViewsPerActivity: uniqueActivities > 0 ? views.length / uniqueActivities : 0,
      mostViewedCategories,
    };
  }
}

export default new DiversityService();
