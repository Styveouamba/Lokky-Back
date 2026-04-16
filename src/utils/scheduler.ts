import { updateAllActivityStatuses, processScheduledNotifications } from '../services/activityLifecycleService';
import { rankingCacheService } from '../services/rankingCacheService';
import { sendPendingReminders, cleanupExpiredReminders } from '../services/activityReminderService';
import { sendDiscoveryNotifications } from '../services/smartNotificationService';

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

 

  // Envoi des rappels d'activités toutes les 5 minutes
  setInterval(() => {
    runReminderTasks();
  }, 5 * 60 * 1000); // 5 minutes

  // Nettoyage des rappels expirés une fois par jour
  setInterval(() => {
    runCleanupTasks();
  }, 24 * 60 * 60 * 1000); // 24 heures

  // Notifications de découverte aléatoires 1 fois par jour (18h)
  scheduleDiscoveryNotifications();

}

/**
 * Planifie les notifications de découverte à 18h chaque jour
 */
function scheduleDiscoveryNotifications(): void {
  // Calculer le temps jusqu'à la prochaine exécution (13h)
  const now = new Date();
  const currentHour = now.getHours();
  
  const nextRun = new Date();
  nextRun.setHours(13, 0, 0, 0);
  
  // Si on est déjà passé 18h aujourd'hui, planifier pour demain
  if (currentHour >= 13) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const timeUntilNext = nextRun.getTime() - now.getTime();

  console.log(`✓ Scheduler started`);
  console.log(`  - Activity status update: every 10 minutes`);
  console.log(`  - Activity reminders: every 5 minutes`);
  console.log(`  - Cleanup expired reminders: every 24 hours`);
  console.log(`  - Discovery notifications: once daily at 18h`);
  console.log(`  - Next discovery notifications at: ${nextRun.toLocaleString('fr-FR')}`);

  // Planifier la première exécution
  setTimeout(() => {
    runDiscoveryNotifications();
    
    // Puis toutes les 24 heures
    setInterval(() => {
      runDiscoveryNotifications();
    }, 24 * 60 * 60 * 1000); // 24 heures
  }, timeUntilNext);
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

/**
 * Envoie les rappels d'activités en attente
 */
async function runReminderTasks(): Promise<void> {
  try {
    await sendPendingReminders();
  } catch (error) {
    console.error('Error running reminder tasks:', error);
  }
}

/**
 * Nettoie les rappels expirés
 */
async function runCleanupTasks(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Running cleanup tasks...`);
    await cleanupExpiredReminders();
    console.log(`[${new Date().toISOString()}] Cleanup tasks completed`);
  } catch (error) {
    console.error('Error running cleanup tasks:', error);
  }
}

/**
 * Envoie les notifications de découverte aléatoires
 */
async function runDiscoveryNotifications(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Sending discovery notifications...`);
    await sendDiscoveryNotifications();
    console.log(`[${new Date().toISOString()}] Discovery notifications sent`);
  } catch (error) {
    console.error('Error sending discovery notifications:', error);
  }
}
