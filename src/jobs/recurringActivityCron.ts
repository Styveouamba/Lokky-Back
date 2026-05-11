import cron from 'node-cron';
import { generateAllRecurringInstances } from '../services/recurringActivityService';

/**
 * Cron job pour générer les instances des activités récurrentes
 * S'exécute tous les jours à 2h du matin
 */
export const startRecurringActivityCron = () => {
  // Exécuter tous les jours à 2h du matin
  cron.schedule('0 2 * * *', async () => {
    try {
      await generateAllRecurringInstances();
    } catch (error) {
      console.error('[Cron] Error in recurring activity generation:', error);
    }
  });

};

export default startRecurringActivityCron;
