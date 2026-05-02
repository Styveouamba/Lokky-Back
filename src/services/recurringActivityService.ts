import Activity from '../models/activityModel';
import Group from '../models/groupModel';
import { sendPushNotificationToUser } from './notificationService';

/**
 * Service pour gérer les activités récurrentes
 */

/**
 * Génère la prochaine instance d'une activité récurrente
 */
export const generateNextRecurringInstance = async (parentActivity: any): Promise<void> => {
  try {
    if (!parentActivity.isRecurring || !parentActivity.recurringPattern) {
      return;
    }

    const { dayOfWeek, time, endDate } = parentActivity.recurringPattern;
    
    // Calculer la prochaine date
    const now = new Date();
    const nextDate = getNextOccurrence(dayOfWeek, time, now);

    // Vérifier si on a dépassé la date de fin
    if (endDate && nextDate > new Date(endDate)) {
      console.log(`[RecurringActivity] End date reached for activity ${parentActivity._id}`);
      return;
    }

    // Vérifier si une instance existe déjà pour cette date
    const existingInstance = await Activity.findOne({
      parentActivityId: parentActivity._id,
      date: {
        $gte: new Date(nextDate.setHours(0, 0, 0, 0)),
        $lt: new Date(nextDate.setHours(23, 59, 59, 999)),
      },
    });

    if (existingInstance) {
      console.log(`[RecurringActivity] Instance already exists for ${nextDate}`);
      return;
    }

    // Créer le groupe de discussion pour la nouvelle instance
    const group = await Group.create({
      name: parentActivity.title,
      description: parentActivity.description || `Groupe de discussion pour ${parentActivity.title}`,
      avatar: parentActivity.imageUrl,
      createdBy: parentActivity.createdBy,
      members: [parentActivity.createdBy],
      admins: [parentActivity.createdBy],
      isPrivate: false,
    });

    // Créer la nouvelle instance
    const newInstance = await Activity.create({
      title: parentActivity.title,
      description: parentActivity.description,
      category: parentActivity.category,
      tags: parentActivity.tags,
      location: parentActivity.location,
      date: nextDate,
      duration: parentActivity.duration,
      maxParticipants: parentActivity.maxParticipants,
      imageUrl: parentActivity.imageUrl,
      createdBy: parentActivity.createdBy,
      participants: [parentActivity.createdBy],
      status: 'upcoming',
      groupId: group._id,
      parentActivityId: parentActivity._id,
      isRecurring: false, // Les instances ne sont pas récurrentes
    });

    console.log(`[RecurringActivity] Created new instance ${newInstance._id} for ${nextDate}`);

    // Notifier le créateur
    await sendPushNotificationToUser(
      parentActivity.createdBy.toString(),
      'Nouvelle instance créée',
      `Votre activité récurrente "${parentActivity.title}" a été programmée pour ${nextDate.toLocaleDateString('fr-FR')}`,
      { type: 'recurring_instance_created', activityId: newInstance._id.toString() }
    );
  } catch (error) {
    console.error('[RecurringActivity] Error generating instance:', error);
  }
};

/**
 * Calcule la prochaine occurrence d'une activité récurrente
 */
function getNextOccurrence(dayOfWeek: number, time: string, fromDate: Date): Date {
  const [hours, minutes] = time.split(':').map(Number);
  
  const nextDate = new Date(fromDate);
  nextDate.setHours(hours, minutes, 0, 0);

  // Si l'heure est déjà passée aujourd'hui, commencer à partir de demain
  if (nextDate <= fromDate) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  // Trouver le prochain jour de la semaine correspondant
  const currentDay = nextDate.getDay();
  let daysToAdd = dayOfWeek - currentDay;
  
  if (daysToAdd < 0) {
    daysToAdd += 7;
  }

  nextDate.setDate(nextDate.getDate() + daysToAdd);
  
  return nextDate;
}

/**
 * Génère les instances pour toutes les activités récurrentes
 * À exécuter quotidiennement via un cron job
 */
export const generateAllRecurringInstances = async (): Promise<void> => {
  try {
    console.log('[RecurringActivity] Starting daily generation...');

    // Trouver toutes les activités récurrentes actives
    const recurringActivities = await Activity.find({
      isRecurring: true,
      status: { $in: ['upcoming', 'active'] },
    }).populate('createdBy', 'name email premium');

    console.log(`[RecurringActivity] Found ${recurringActivities.length} recurring activities`);

    // Vérifier que le créateur est toujours premium
    const activeRecurringActivities = recurringActivities.filter(activity => {
      const creator = activity.createdBy as any;
      return creator?.premium?.isActive;
    });

    console.log(`[RecurringActivity] ${activeRecurringActivities.length} with active premium creators`);

    // Générer les instances pour les 2 prochaines semaines
    for (const activity of activeRecurringActivities) {
      await generateNextRecurringInstance(activity);
    }

    console.log('[RecurringActivity] Daily generation completed');
  } catch (error) {
    console.error('[RecurringActivity] Error in daily generation:', error);
  }
};

/**
 * Annule toutes les instances futures d'une activité récurrente
 */
export const cancelRecurringActivity = async (parentActivityId: string): Promise<void> => {
  try {
    // Trouver toutes les instances futures
    const futureInstances = await Activity.find({
      parentActivityId,
      date: { $gt: new Date() },
      status: { $in: ['upcoming', 'active'] },
    });

    // Annuler chaque instance
    for (const instance of futureInstances) {
      instance.status = 'cancelled';
      await instance.save();
    }

    console.log(`[RecurringActivity] Cancelled ${futureInstances.length} future instances`);
  } catch (error) {
    console.error('[RecurringActivity] Error cancelling instances:', error);
  }
};

export default {
  generateNextRecurringInstance,
  generateAllRecurringInstances,
  cancelRecurringActivity,
  getNextOccurrence,
};
