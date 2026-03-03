import { cacheService } from './cacheService';
import { calculateActivityScore, rankActivities } from './rankingService';
import Activity from '../models/activityModel';
import User from '../models/userModel';

interface CachedRanking {
  activityId: string;
  scores: Map<string, number>; // userId -> score
  lastUpdated: Date;
}

/**
 * Service pour gérer le cache des scores de ranking
 */
class RankingCacheService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly BATCH_SIZE = 100;

  /**
   * Génère une clé de cache pour un utilisateur
   */
  private getUserCacheKey(userId: string): string {
    return `ranking:user:${userId}`;
  }

  /**
   * Génère une clé de cache pour une activité
   */
  private getActivityCacheKey(activityId: string): string {
    return `ranking:activity:${activityId}`;
  }

  /**
   * Récupère les scores en cache pour un utilisateur
   */
  async getCachedScores(userId: string): Promise<any[] | null> {
    const key = this.getUserCacheKey(userId);
    return await cacheService.get(key);
  }

  /**
   * Stocke les scores en cache pour un utilisateur
   */
  async setCachedScores(userId: string, rankedActivities: any[]): Promise<void> {
    const key = this.getUserCacheKey(userId);
    await cacheService.set(key, rankedActivities, this.CACHE_TTL);
  }

  /**
   * Invalide le cache d'un utilisateur
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const key = this.getUserCacheKey(userId);
    await cacheService.delete(key);
  }

  /**
   * Invalide le cache de tous les utilisateurs
   */
  async invalidateAllUserCaches(): Promise<void> {
    await cacheService.deletePattern('ranking:user:*');
  }

  /**
   * Invalide le cache lié à une activité
   */
  async invalidateActivityCache(activityId: string): Promise<void> {
    // Invalider tous les caches utilisateurs car une activité a changé
    await this.invalidateAllUserCaches();
  }

  /**
   * Pré-calcule les rankings pour les utilisateurs actifs
   * À exécuter en background toutes les 5-10 minutes
   */
  async precomputeRankings(): Promise<void> {
    try {
      console.log('[RankingCache] Starting precomputation...');
      
      // Récupérer toutes les activités actives
      const activities = await Activity.find({
        status: { $in: ['upcoming', 'ongoing'] },
      })
        .populate('createdBy', 'name avatar')
        .populate('participants', 'name avatar')
        .lean();

      if (activities.length === 0) {
        console.log('[RankingCache] No activities to rank');
        return;
      }

      // Récupérer les utilisateurs actifs (connectés dans les dernières 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeUsers = await User.find({
        lastActive: { $gte: oneDayAgo },
        'location.coordinates': { $exists: true },
      })
        .select('_id interests goals location')
        .lean();

      console.log(`[RankingCache] Processing ${activeUsers.length} active users`);

      // Traiter par batch pour éviter la surcharge mémoire
      for (let i = 0; i < activeUsers.length; i += this.BATCH_SIZE) {
        const batch = activeUsers.slice(i, i + this.BATCH_SIZE);
        
        await Promise.all(
          batch.map(async (user) => {
            if (!user.location?.coordinates) return;

            const rankedActivities = rankActivities(activities, {
              userId: user._id.toString(),
              userInterests: user.interests || [],
              userGoals: user.goals || [],
              userLocation: user.location.coordinates,
            });

            await this.setCachedScores(user._id.toString(), rankedActivities);
          })
        );

        console.log(`[RankingCache] Processed batch ${i / this.BATCH_SIZE + 1}`);
      }

      console.log('[RankingCache] Precomputation completed');
    } catch (error) {
      console.error('[RankingCache] Precomputation error:', error);
    }
  }

  /**
   * Calcule le ranking pour un utilisateur spécifique avec cache
   */
  async getRankedActivitiesForUser(userId: string): Promise<any[] | null> {
    // Vérifier le cache d'abord
    const cached = await this.getCachedScores(userId);
    if (cached) {
      console.log(`[RankingCache] Cache hit for user ${userId}`);
      return cached;
    }

    console.log(`[RankingCache] Cache miss for user ${userId}, computing...`);

    // Calculer si pas en cache
    const user = await User.findById(userId)
      .select('interests goals location')
      .lean();

    if (!user || !user.location?.coordinates) {
      return null;
    }

    const activities = await Activity.find({
      status: { $in: ['upcoming', 'ongoing'] },
    })
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .lean();

    const rankedActivities = rankActivities(activities, {
      userId,
      userInterests: user.interests || [],
      userGoals: user.goals || [],
      userLocation: user.location.coordinates,
    });

    // Mettre en cache
    await this.setCachedScores(userId, rankedActivities);

    return rankedActivities;
  }
}

export const rankingCacheService = new RankingCacheService();
