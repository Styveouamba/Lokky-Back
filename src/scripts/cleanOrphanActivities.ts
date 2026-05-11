import mongoose from 'mongoose';
import Activity from '../models/activityModel';
import User from '../models/userModel';

/**
 * Script pour nettoyer les activités orphelines (dont le créateur a été supprimé)
 * Peut être exécuté manuellement ou via un cron job
 */
export async function cleanOrphanActivities(): Promise<void> {
  try {
    console.log('[CleanOrphanActivities] Starting cleanup...');

    // Récupérer toutes les activités
    const activities = await Activity.find({}).select('_id createdBy title');
    
    console.log(`[CleanOrphanActivities] Found ${activities.length} activities to check`);

    let deletedCount = 0;
    const orphanIds: string[] = [];

    // Vérifier chaque activité
    for (const activity of activities) {
      const userExists = await User.exists({ _id: activity.createdBy });
      
      if (!userExists) {
        orphanIds.push(activity._id.toString());
        console.log(`[CleanOrphanActivities] Found orphan activity: ${activity.title} (${activity._id})`);
      }
    }

    // Supprimer toutes les activités orphelines en une seule requête
    if (orphanIds.length > 0) {
      const result = await Activity.deleteMany({
        _id: { $in: orphanIds }
      });
      
      deletedCount = result.deletedCount || 0;
      console.log(`[CleanOrphanActivities] Deleted ${deletedCount} orphan activities`);
    } else {
      console.log('[CleanOrphanActivities] No orphan activities found');
    }

    return;
  } catch (error) {
    console.error('[CleanOrphanActivities] Error:', error);
    throw error;
  }
}

// Si le script est exécuté directement
if (require.main === module) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';
  
  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log('Connected to MongoDB');
      await cleanOrphanActivities();
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
      process.exit(0);
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    });
}
