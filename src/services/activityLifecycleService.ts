import Activity, { IActivity } from '../models/activityModel';
import User from '../models/userModel';
import ScheduledNotification from '../models/scheduledNotificationModel';
import { sendPushNotification } from './notificationService';

/**
 * Calcule le statut dynamique d'une activité basé sur la date et la durée
 */
export function calculateActivityStatus(activity: IActivity): 'upcoming' | 'ongoing' | 'completed' | 'cancelled' {
  // Si l'activité est annulée, garder ce statut
  if (activity.status === 'cancelled') {
    return 'cancelled';
  }

  const now = new Date();
  const activityDate = new Date(activity.date);
  const duration = activity.duration || 2; // Durée par défaut de 2 heures
  const endDate = new Date(activityDate.getTime() + duration * 60 * 60 * 1000);

  if (now < activityDate) {
    return 'upcoming';
  } else if (now >= activityDate && now <= endDate) {
    return 'ongoing';
  } else {
    return 'completed';
  }
}

/**
 * Met à jour le statut d'une activité si nécessaire
 */
export async function updateActivityStatus(activityId: string): Promise<IActivity | null> {
  try {
    const activity = await Activity.findById(activityId);
    if (!activity) return null;

    const newStatus = calculateActivityStatus(activity);
    
    // Si le statut a changé, mettre à jour
    if (activity.status !== newStatus) {
      const oldStatus = activity.status;
      activity.status = newStatus;
      await activity.save();

      // Si l'activité vient de se terminer, envoyer des notifications
      if (newStatus === 'completed' && oldStatus !== 'completed') {
        await notifyActivityCompleted(activity);
      }
    }

    return activity;
  } catch (error) {
    console.error('Error updating activity status:', error);
    return null;
  }
}

/**
 * Met à jour les statuts de toutes les activités
 * À appeler périodiquement (cron job)
 */
export async function updateAllActivityStatuses(): Promise<void> {
  try {
    const activities = await Activity.find({
      status: { $in: ['upcoming', 'ongoing'] }
    });

    for (const activity of activities) {
      await updateActivityStatus(activity._id.toString());
    }

    console.log(`Updated ${activities.length} activity statuses`);
  } catch (error) {
    console.error('Error updating all activity statuses:', error);
  }
}

/**
 * Envoie une notification à tous les participants quand une activité se termine
 * La notification est envoyée 1h après la fin de l'activité
 */
async function notifyActivityCompleted(activity: IActivity): Promise<void> {
  try {
    // Calculer le moment d'envoi: 1h après la fin de l'activité
    const duration = activity.duration || 2;
    const endDate = new Date(activity.date.getTime() + duration * 60 * 60 * 1000);
    const notificationTime = new Date(endDate.getTime() + 60 * 60 * 1000); // +1h après la fin

    // Créer ou mettre à jour la notification planifiée dans la DB
    await ScheduledNotification.findOneAndUpdate(
      { activityId: activity._id, type: 'activity_completed' },
      {
        activityId: activity._id,
        scheduledFor: notificationTime,
        type: 'activity_completed',
        status: 'pending',
      },
      { upsert: true, new: true }
    );

    console.log(`Scheduled completion notification for activity ${activity._id} at ${notificationTime.toISOString()}`);
  } catch (error) {
    console.error('Error scheduling activity completion notification:', error);
  }
}

/**
 * Envoie les notifications de fin d'activité à tous les participants
 */
async function sendCompletionNotifications(activity: IActivity): Promise<void> {
  try {
    // Récupérer tous les participants avec leurs push tokens
    const participants = await User.find({
      _id: { $in: activity.participants },
      pushToken: { $exists: true, $ne: null }
    });

    if (participants.length === 0) {
      console.log(`No participants with push tokens for activity ${activity._id}`);
      return;
    }

    // Envoyer des notifications push à tous les participants
    const notificationPromises = participants.map(participant =>
      sendPushNotification(
        participant.pushToken!,
        `${activity.title} 🎉`,
        `Comment s'est passée cette activité ? Partage ton expérience avec les autres !`,
        {
          type: 'activity_completed',
          activityId: activity._id.toString(),
          groupId: activity.groupId?.toString(),
        }
      ).catch(error => {
        console.error(`Failed to send notification to ${participant._id}:`, error);
      })
    );

    await Promise.all(notificationPromises);
    console.log(`Sent ${participants.length} completion notifications for activity ${activity._id}`);
  } catch (error) {
    console.error('Error sending completion notifications:', error);
  }
}

/**
 * Traite les notifications planifiées qui doivent être envoyées
 * À appeler périodiquement (toutes les 5-10 minutes)
 */
export async function processScheduledNotifications(): Promise<void> {
  try {
    const now = new Date();
    
    // Récupérer toutes les notifications en attente dont l'heure est passée
    const pendingNotifications = await ScheduledNotification.find({
      status: 'pending',
      scheduledFor: { $lte: now }
    }).limit(50); // Traiter max 50 à la fois

    if (pendingNotifications.length === 0) {
      return;
    }

    console.log(`Processing ${pendingNotifications.length} scheduled notifications`);

    for (const notification of pendingNotifications) {
      try {
        // Récupérer l'activité
        const activity = await Activity.findById(notification.activityId)
          .populate('participants', '_id');

        if (!activity) {
          // Activité supprimée, marquer comme failed
          notification.status = 'failed';
          await notification.save();
          continue;
        }

        // Envoyer les notifications
        await sendCompletionNotifications(activity);

        // Marquer comme envoyée
        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();
      } catch (error) {
        console.error(`Error processing notification ${notification._id}:`, error);
        notification.status = 'failed';
        await notification.save();
      }
    }

    console.log(`Processed ${pendingNotifications.length} scheduled notifications`);
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
  }
}

/**
 * Récupère les activités auxquelles un utilisateur a participé (passées)
 */
export async function getUserPastActivities(userId: string): Promise<IActivity[]> {
  try {
    const activities = await Activity.find({
      participants: userId,
      status: 'completed'
    })
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .populate('groupId', '_id name avatar')
      .sort({ date: -1 }); // Plus récentes en premier

    return activities;
  } catch (error) {
    console.error('Error getting user past activities:', error);
    return [];
  }
}

/**
 * Récupère les activités à venir d'un utilisateur
 */
export async function getUserUpcomingActivities(userId: string): Promise<IActivity[]> {
  try {
    const activities = await Activity.find({
      participants: userId,
      status: { $in: ['upcoming', 'ongoing'] }
    })
      .populate('createdBy', 'name avatar')
      .populate('participants', 'name avatar')
      .populate('groupId', '_id name avatar')
      .sort({ date: 1 }); // Plus proches en premier

    return activities;
  } catch (error) {
    console.error('Error getting user upcoming activities:', error);
    return [];
  }
}
