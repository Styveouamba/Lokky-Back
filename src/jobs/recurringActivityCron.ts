import cron from 'node-cron';
import { generateAllRecurringInstances } from '../services/recurringActivityService';

/**
 * Cron job pour générer les instances des activités récurrentes
 * S'exécute tous les jours à 2h du matin
 */
export const startRecurringActivityCron = () => {
  // Exécuter tous les jours à 2h du matin
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Running recurring activity generation...');
    try {
      await generateAllRecurringInstances();
      console.log('[Cron] Recurring activity generation completed');
    } catch (error) {
      console.error('[Cron] Error in recurring activity generation:', error);
    }
  });

  console.log('[Cron] Recurring activity cron job started (runs daily at 2:00 AM)');
};

export default startRecurringActivityCron;
