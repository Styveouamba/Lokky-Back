import { RankChange } from './rankingCacheService';
import { sendPushNotification } from './notificationService';
import User from '../models/userModel';

interface RankNotificationData {
  userId: string;
  title: string;
  body: string;
  data: {
    type: 'rank_change';
    category: string;
    oldRank?: number;
    newRank: number;
    change: number;
  };
}

class RankNotificationService {
  /**
   * Générer et envoyer les notifications de changement de rang
   */
  async notifyRankChanges(changes: RankChange[]): Promise<void> {
    console.log(`[RankNotification] Processing ${changes.length} rank changes`);

    for (const change of changes) {
      try {
        const notification = this.createNotification(change);
        if (notification) {
          await this.sendNotification(notification);
        }
      } catch (error) {
        console.error(`[RankNotification] Error processing change for user ${change.userId}:`, error);
      }
    }
  }

  /**
   * Créer une notification basée sur le type de changement
   */
  private createNotification(change: RankChange): RankNotificationData | null {
    const categoryNames = {
      creators: 'Créateurs',
      ratings: 'Meilleures Notes',
      active: 'Plus Actifs',
    };

    const categoryName = categoryNames[change.category as keyof typeof categoryNames] || change.category;

    // Devenu #1
    if (change.becameFirst) {
      return {
        userId: change.userId,
        title: '🏆 Félicitations Champion!',
        body: `Vous êtes maintenant #1 dans le classement ${categoryName}!`,
        data: {
          type: 'rank_change',
          category: change.category,
          oldRank: change.oldRank || undefined,
          newRank: change.newRank,
          change: change.change,
        },
      };
    }

    // Entré dans le Top 10
    if (change.enteredTop10) {
      return {
        userId: change.userId,
        title: '⭐ Top 10!',
        body: `Bravo! Vous êtes maintenant #${change.newRank} dans le classement ${categoryName}!`,
        data: {
          type: 'rank_change',
          category: change.category,
          oldRank: change.oldRank || undefined,
          newRank: change.newRank,
          change: change.change,
        },
      };
    }

    // Amélioration significative (5+ places)
    if (change.change >= 5) {
      return {
        userId: change.userId,
        title: '📈 Belle progression!',
        body: `Vous avez gagné ${change.change} places! Vous êtes maintenant #${change.newRank} dans ${categoryName}.`,
        data: {
          type: 'rank_change',
          category: change.category,
          oldRank: change.oldRank || undefined,
          newRank: change.newRank,
          change: change.change,
        },
      };
    }

    // Baisse significative (5+ places)
    if (change.change <= -5) {
      return {
        userId: change.userId,
        title: '💪 Continuez vos efforts!',
        body: `Votre rang a changé dans ${categoryName}. Créez plus d'activités pour remonter!`,
        data: {
          type: 'rank_change',
          category: change.category,
          oldRank: change.oldRank || undefined,
          newRank: change.newRank,
          change: change.change,
        },
      };
    }

    return null;
  }

  /**
   * Envoyer la notification à l'utilisateur
   */
  private async sendNotification(notification: RankNotificationData): Promise<void> {
    try {
      const user = await User.findById(notification.userId).select('pushToken');
      
      if (!user) {
        console.log(`[RankNotification] User ${notification.userId} not found`);
        return;
      }

      // Envoyer via Socket.IO si l'utilisateur est connecté
      try {
        const { getIO } = await import('../socket/socketHandler');
        const io = getIO();
        
        io.to(notification.userId).emit('rank_change', {
          title: notification.title,
          body: notification.body,
          data: notification.data,
        });
        
        console.log(`[RankNotification] Sent socket notification to user ${notification.userId}`);
      } catch (socketError) {
        console.log(`[RankNotification] Socket not available or user not connected:`, socketError);
      }

      // Envoyer aussi une notification push si l'utilisateur a un token
      if (user.pushToken) {
        await sendPushNotification(
          user.pushToken,
          notification.title,
          notification.body,
          notification.data
        );
        console.log(`[RankNotification] Sent push notification to user ${notification.userId}: ${notification.title}`);
      } else {
        console.log(`[RankNotification] No push token for user ${notification.userId}`);
      }
    } catch (error) {
      console.error(`[RankNotification] Error sending notification:`, error);
    }
  }

  /**
   * Envoyer une notification personnalisée de rang
   */
  async sendCustomRankNotification(
    userId: string,
    title: string,
    body: string,
    category: string,
    rank: number
  ): Promise<void> {
    const notification: RankNotificationData = {
      userId,
      title,
      body,
      data: {
        type: 'rank_change',
        category,
        newRank: rank,
        change: 0,
      },
    };

    await this.sendNotification(notification);
  }
}

export const rankNotificationService = new RankNotificationService();
