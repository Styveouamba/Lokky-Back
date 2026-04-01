import Redis from 'ioredis';

// Configuration Redis
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

interface RankingData {
  userId: string;
  rank: number;
  score: number;
  category: 'creators' | 'ratings' | 'active';
}

interface RankChange {
  userId: string;
  category: string;
  oldRank: number | null;
  newRank: number;
  change: number;
  enteredTop10: boolean;
  becameFirst: boolean;
}

class RankingCacheService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly RANK_HISTORY_TTL = 86400; // 24 heures

  /**
   * Sauvegarder le leaderboard en cache
   */
  async cacheLeaderboard(category: string, rankings: RankingData[]): Promise<void> {
    try {
      const key = `leaderboard:${category}`;
      await redis.setex(key, this.CACHE_TTL, JSON.stringify(rankings));
      console.log(`[RankingCache] Cached ${category} leaderboard with ${rankings.length} entries`);
    } catch (error) {
      console.error('[RankingCache] Error caching leaderboard:', error);
    }
  }

  /**
   * Récupérer le leaderboard depuis le cache
   */
  async getLeaderboard(category: string): Promise<RankingData[] | null> {
    try {
      const key = `leaderboard:${category}`;
      const cached = await redis.get(key);
      
      if (cached) {
        console.log(`[RankingCache] Cache hit for ${category}`);
        return JSON.parse(cached);
      }
      
      console.log(`[RankingCache] Cache miss for ${category}`);
      return null;
    } catch (error) {
      console.error('[RankingCache] Error getting leaderboard (Redis might not be running):', error);
      return null; // Retourner null en cas d'erreur pour continuer sans cache
    }
  }

  /**
   * Sauvegarder le rang actuel d'un utilisateur
   */
  async saveUserRank(userId: string, category: string, rank: number, score: number): Promise<void> {
    try {
      const key = `user:${userId}:rank:${category}`;
      const data = { rank, score, timestamp: Date.now() };
      await redis.setex(key, this.RANK_HISTORY_TTL, JSON.stringify(data));
    } catch (error) {
      console.error('[RankingCache] Error saving user rank:', error);
    }
  }

  /**
   * Vérifier si une notification a déjà été envoyée pour ce changement
   */
  async hasNotificationBeenSent(userId: string, category: string, rank: number): Promise<boolean> {
    try {
      const key = `user:${userId}:notif:${category}:${rank}`;
      const exists = await redis.get(key);
      return exists !== null;
    } catch (error) {
      console.error('[RankingCache] Error checking notification:', error);
      return false;
    }
  }

  /**
   * Marquer qu'une notification a été envoyée
   */
  async markNotificationSent(userId: string, category: string, rank: number): Promise<void> {
    try {
      const key = `user:${userId}:notif:${category}:${rank}`;
      // Garder pendant 7 jours pour éviter les doublons
      await redis.setex(key, 7 * 24 * 60 * 60, '1');
    } catch (error) {
      console.error('[RankingCache] Error marking notification:', error);
    }
  }

  /**
   * Récupérer le rang précédent d'un utilisateur
   */
  async getPreviousRank(userId: string, category: string): Promise<{ rank: number; score: number } | null> {
    try {
      const key = `user:${userId}:rank:${category}`;
      const cached = await redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        return { rank: data.rank, score: data.score };
      }
      
      return null;
    } catch (error) {
      console.error('[RankingCache] Error getting previous rank:', error);
      return null;
    }
  }

  /**
   * Détecter les changements de rang et retourner les notifications à envoyer
   */
  async detectRankChanges(
    category: string,
    newRankings: RankingData[]
  ): Promise<RankChange[]> {
    const changes: RankChange[] = [];

    for (const ranking of newRankings) {
      const previous = await this.getPreviousRank(ranking.userId, category);
      
      // Vérifier si le rang a changé
      const hasRankChanged = !previous || previous.rank !== ranking.rank;
      
      if (!hasRankChanged) {
        // Pas de changement, on sauvegarde juste le rang actuel
        await this.saveUserRank(ranking.userId, category, ranking.rank, ranking.score);
        continue;
      }
      
      // Le rang a changé, vérifier si on doit envoyer une notification
      let shouldNotify = false;
      let enteredTop10 = false;
      let becameFirst = false;
      let rankChange = 0;
      
      if (!previous) {
        // Première fois dans le classement
        if (ranking.rank <= 10) {
          shouldNotify = true;
          enteredTop10 = true;
          becameFirst = ranking.rank === 1;
        }
      } else {
        rankChange = previous.rank - ranking.rank; // Positif = amélioration
        
        // Détecter les changements significatifs
        enteredTop10 = previous.rank > 10 && ranking.rank <= 10;
        becameFirst = previous.rank > 1 && ranking.rank === 1;
        const significantChange = Math.abs(rankChange) >= 5;
        
        shouldNotify = enteredTop10 || becameFirst || significantChange;
      }
      
      // Vérifier si on a déjà envoyé une notification pour ce rang
      if (shouldNotify) {
        const alreadySent = await this.hasNotificationBeenSent(ranking.userId, category, ranking.rank);
        
        if (!alreadySent) {
          changes.push({
            userId: ranking.userId,
            category,
            oldRank: previous?.rank || null,
            newRank: ranking.rank,
            change: rankChange,
            enteredTop10,
            becameFirst,
          });
          
          // Marquer la notification comme envoyée
          await this.markNotificationSent(ranking.userId, category, ranking.rank);
          console.log(`[RankingCache] Will notify user ${ranking.userId} for rank ${ranking.rank} in ${category}`);
        } else {
          console.log(`[RankingCache] Notification already sent for user ${ranking.userId} rank ${ranking.rank} in ${category}`);
        }
      }

      // Sauvegarder le nouveau rang
      await this.saveUserRank(ranking.userId, category, ranking.rank, ranking.score);
    }

    return changes;
  }

  /**
   * Invalider le cache d'une activité spécifique
   */
  async invalidateActivityCache(activityId: string): Promise<void> {
    try {
      // Invalider tous les leaderboards car une activité peut affecter plusieurs classements
      await redis.del('leaderboard:creators', 'leaderboard:ratings', 'leaderboard:active');
      console.log(`[RankingCache] Invalidated cache for activity ${activityId}`);
    } catch (error) {
      console.error('[RankingCache] Error invalidating cache:', error);
    }
  }

  /**
   * Invalider tout le cache
   */
  async invalidateAll(): Promise<void> {
    try {
      const keys = await redis.keys('leaderboard:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[RankingCache] Invalidated ${keys.length} cache entries`);
      }
    } catch (error) {
      console.error('[RankingCache] Error invalidating all cache:', error);
    }
  }

  /**
   * Pré-calculer les rankings pour toutes les catégories
   * et détecter les changements de rang
   */
  async precomputeRankings(): Promise<void> {
    const categories = ['creators', 'ratings', 'active'];
    
    for (const category of categories) {
      try {
        console.log(`[RankingCache] Precomputing ${category} rankings...`);
        
        // Importer les modèles nécessaires
        const User = (await import('../models/userModel')).default;
        
        let sortCriteria: any = {};
        let minCriteria: any = {};

        switch (category) {
          case 'creators':
            sortCriteria = { 'reputation.activitiesCreated': -1 };
            minCriteria = { 'reputation.activitiesCreated': { $gt: 0 } };
            break;
          case 'ratings':
            sortCriteria = { 'reputation.averageRating': -1, 'reputation.totalReviews': -1 };
            minCriteria = { 'reputation.totalReviews': { $gte: 3 } };
            break;
          case 'active':
            sortCriteria = { 'reputation.activitiesCompleted': -1 };
            minCriteria = { 'reputation.activitiesCompleted': { $gt: 0 } };
            break;
        }

        // Récupérer le top 50
        const users = await User.find({
          ...minCriteria,
          'moderation.status': { $ne: 'banned' },
        })
          .select('_id reputation')
          .sort(sortCriteria)
          .limit(50)
          .lean();

        // Préparer les données de ranking
        const rankingsData = users.map((user, index) => {
          let score = 0;
          switch (category) {
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
            category: category as 'creators' | 'ratings' | 'active',
          };
        });

        // Détecter les changements et envoyer les notifications
        // DÉSACTIVÉ: Notifications de rang temporairement désactivées
        // const changes = await this.detectRankChanges(category, rankingsData);
        
        // if (changes.length > 0) {
        //   console.log(`[RankingCache] Detected ${changes.length} rank changes for ${category}`);
        //   const { rankNotificationService } = await import('./rankNotificationService');
        //   await rankNotificationService.notifyRankChanges(changes);
        // }

        // Mettre en cache
        await this.cacheLeaderboard(category, rankingsData);
        
        console.log(`[RankingCache] Precomputed ${category} with ${rankingsData.length} users`);
      } catch (error) {
        console.error(`[RankingCache] Error precomputing ${category}:`, error);
      }
    }
  }
  async getCacheStats(): Promise<{ hits: number; misses: number; keys: number }> {
    try {
      const info = await redis.info('stats');
      const keys = await redis.keys('leaderboard:*');
      
      // Parser les stats Redis
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      
      return {
        hits: hitsMatch ? parseInt(hitsMatch[1]) : 0,
        misses: missesMatch ? parseInt(missesMatch[1]) : 0,
        keys: keys.length,
      };
    } catch (error) {
      console.error('[RankingCache] Error getting cache stats:', error);
      return { hits: 0, misses: 0, keys: 0 };
    }
  }
}

export const rankingCacheService = new RankingCacheService();
export { RankChange };
