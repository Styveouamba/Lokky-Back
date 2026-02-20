import { updateAllActivityStatuses, processScheduledNotifications } from '../services/activityLifecycleService';

/**
 * Démarre les tâches planifiées
 */
export function startScheduler(): void {
  console.log('Starting scheduler...');

  // Exécuter immédiatement au démarrage
  runScheduledTasks();

  // Puis toutes les 10 minutes
  setInterval(() => {
    runScheduledTasks();
  }, 10 * 60 * 1000); // 10 minutes

  console.log('Scheduler started - running every 10 minutes');
}

/**
 * Exécute toutes les tâches planifiées
 */
async function runScheduledTasks(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Running scheduled tasks...`);

    // Mettre à jour les statuts des activités
    await updateAllActivityStatuses();

    // Traiter les notifications planifiées
    await processScheduledNotifications();

    console.log(`[${new Date().toISOString()}] Scheduled tasks completed`);
  } catch (error) {
    console.error('Error running scheduled tasks:', error);
  }
}
