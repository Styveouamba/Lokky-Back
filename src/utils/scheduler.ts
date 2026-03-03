import { updateAllActivityStatuses, processScheduledNotifications } from '../services/activityLifecycleService';
import { rankingCacheService } from '../services/rankingCacheService';

/**
 * Démarre les tâches planifiées
 */
export function startScheduler(): void {
  console.log('Starting scheduler...');

  // Exécuter immédiatement au démarrage
  runScheduledTasks();

  // Tâches principales toutes les 10 minutes
  setInterval(() => {
    runScheduledTasks();
  }, 10 * 60 * 1000); // 10 minutes

  // Pré-calcul des rankings toutes les 5 minutes
  setInterval(() => {
    runRankingPrecomputation();
  }, 5 * 60 * 1000); // 5 minutes

  console.log('✓ Scheduler started');
  console.log('  - Activity status update: every 10 minutes');
  console.log('  - Ranking precomputation: every 5 minutes');
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

/**
 * Pré-calcule les rankings en background
 */
async function runRankingPrecomputation(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Running ranking precomputation...`);
    await rankingCacheService.precomputeRankings();
    console.log(`[${new Date().toISOString()}] Ranking precomputation completed`);
  } catch (error) {
    console.error('Error running ranking precomputation:', error);
  }
}
