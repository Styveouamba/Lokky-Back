import ActivityReminder from '../models/activityReminderModel';
import Activity from '../models/activityModel';
import { sendPushNotificationToUser } from './notificationService';
import mongoose from 'mongoose';

/**
 * Crée des rappels pour une activité et un utilisateur
 * Appelé quand un utilisateur rejoint une activité
 */
export const createRemindersForActivity = async (
  activityId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId
): Promise<void> => {
  try {
    const activity = await Activity.findById(activityId);
    
    if (!activity || !activity.date) {
      console.error(`Activity ${activityId} not found or has no date`);
      return;
    }

    const activityDate = new Date(activity.date);
    const now = new Date();

    // Calculer les dates de rappel
    const reminder24h = new Date(activityDate.getTime() - 24 * 60 * 60 * 1000); // 24h avant
    const reminder2h = new Date(activityDate.getTime() - 2 * 60 * 60 * 1000);   // 2h avant

    // Créer le rappel 24h si la date n'est pas dépassée
    if (reminder24h > now) {
      await ActivityReminder.findOneAndUpdate(
        {
          activityId,
          userId,
          reminderType: '24h',
        },
        {
          activityId,
          userId,
          reminderType: '24h',
          scheduledFor: reminder24h,
          sent: false,
        },
        { upsert: true, new: true }
      );
      console.log(`Created 24h reminder for activity ${activityId}, user ${userId}`);
    }

    // Créer le rappel 2h si la date n'est pas dépassée
    if (reminder2h > now) {
      await ActivityReminder.findOneAndUpdate(
        {
          activityId,
          userId,
          reminderType: '2h',
        },
        {
          activityId,
          userId,
          reminderType: '2h',
          scheduledFor: reminder2h,
          sent: false,
        },
        { upsert: true, new: true }
      );
      console.log(`Created 2h reminder for activity ${activityId}, user ${userId}`);
    }
  } catch (error) {
    console.error('Error creating reminders:', error);
  }
};

/**
 * Supprime les rappels d'un utilisateur pour une activité
 * Appelé quand un utilisateur quitte une activité
 */
export const deleteRemindersForActivity = async (
  activityId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId
): Promise<void> => {
  try {
    await ActivityReminder.deleteMany({
      activityId,
      userId,
    });
    console.log(`Deleted reminders for activity ${activityId}, user ${userId}`);
  } catch (error) {
    console.error('Error deleting reminders:', error);
  }
};

/**
 * Supprime tous les rappels d'une activité
 * Appelé quand une activité est supprimée ou annulée
 */
export const deleteAllRemindersForActivity = async (
  activityId: string | mongoose.Types.ObjectId
): Promise<void> => {
  try {
    await ActivityReminder.deleteMany({ activityId });
    console.log(`Deleted all reminders for activity ${activityId}`);
  } catch (error) {
    console.error('Error deleting all reminders:', error);
  }
};

/**
 * Formate l'heure d'une date en format lisible
 */
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formate la date complète
 */
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

/**
 * Envoie les rappels qui doivent être envoyés maintenant
 * Cette fonction doit être appelée régulièrement (toutes les 5-10 minutes)
 */
export const sendPendingReminders = async (): Promise<void> => {
  try {
    const now = new Date();
    
    // Récupérer tous les rappels non envoyés dont la date est passée
    const pendingReminders = await ActivityReminder.find({
      sent: false,
      scheduledFor: { $lte: now },
    })
      .populate('activityId', 'title date location')
      .populate('userId', 'pushToken')
      .limit(100); // Limiter à 100 par batch pour éviter la surcharge

    console.log(`[ActivityReminder] Found ${pendingReminders.length} pending reminders to send`);

    for (const reminder of pendingReminders) {
      try {
        const activity = reminder.activityId as any;
        const user = reminder.userId as any;

        if (!activity || !user) {
          console.error(`Missing activity or user for reminder ${reminder._id}`);
          await ActivityReminder.findByIdAndUpdate(reminder._id, {
            sent: true,
            sentAt: new Date(),
            error: 'Activity or user not found',
          });
          continue;
        }

        const activityDate = new Date(activity.date);
        const activityTime = formatTime(activityDate);
        const activityDateStr = formatDate(activityDate);

        let title = '';
        let body = '';

        if (reminder.reminderType === '24h') {
          title = `📅 Rappel : ${activity.title}`;
          body = `Votre activité est demain à ${activityTime}. Préparez-vous pour passer un bon moment ! 🎉`;
        } else if (reminder.reminderType === '2h') {
          title = `⏰ C'est bientôt ! ${activity.title}`;
          body = `Votre activité commence dans 2 heures (${activityTime}). Rendez-vous à ${activity.location?.name || 'l\'adresse indiquée'}. Bon moment ! 😊`;
        }

        // Envoyer la notification
        const sent = await sendPushNotificationToUser(
          user._id,
          title,
          body,
          {
            type: 'activity_reminder',
            activityId: activity._id.toString(),
            reminderType: reminder.reminderType,
          }
        );

        // Marquer comme envoyé
        await ActivityReminder.findByIdAndUpdate(reminder._id, {
          sent: true,
          sentAt: new Date(),
          error: sent ? undefined : 'Failed to send notification',
        });

        console.log(`Sent ${reminder.reminderType} reminder for activity ${activity._id} to user ${user._id}`);
      } catch (error: any) {
        console.error(`Error sending reminder ${reminder._id}:`, error);
        
        // Marquer comme envoyé avec erreur pour ne pas réessayer indéfiniment
        await ActivityReminder.findByIdAndUpdate(reminder._id, {
          sent: true,
          sentAt: new Date(),
          error: error.message || 'Unknown error',
        });
      }
    }

    if (pendingReminders.length > 0) {
      console.log(`[ActivityReminder] Sent ${pendingReminders.length} reminders`);
    }
  } catch (error) {
    console.error('Error in sendPendingReminders:', error);
  }
};

/**
 * Crée des rappels pour tous les participants d'une activité
 * Utile lors de la création d'une activité ou de la mise à jour de sa date
 */
export const createRemindersForAllParticipants = async (
  activityId: string | mongoose.Types.ObjectId
): Promise<void> => {
  try {
    const activity = await Activity.findById(activityId).populate('participants', '_id');
    
    if (!activity) {
      console.error(`Activity ${activityId} not found`);
      return;
    }

    const participants = activity.participants as any[];
    
    for (const participant of participants) {
      await createRemindersForActivity(activityId, participant._id);
    }

    console.log(`Created reminders for ${participants.length} participants of activity ${activityId}`);
  } catch (error) {
    console.error('Error creating reminders for all participants:', error);
  }
};

/**
 * Nettoie les rappels expirés (activités passées)
 * À appeler périodiquement pour nettoyer la base de données
 */
export const cleanupExpiredReminders = async (): Promise<void> => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await ActivityReminder.deleteMany({
      scheduledFor: { $lt: oneDayAgo },
    });

    if (result.deletedCount > 0) {
      console.log(`[ActivityReminder] Cleaned up ${result.deletedCount} expired reminders`);
    }
  } catch (error) {
    console.error('Error cleaning up expired reminders:', error);
  }
};
