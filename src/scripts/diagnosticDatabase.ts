import mongoose from 'mongoose';
import Activity from '../models/activityModel';
import User from '../models/userModel';

/**
 * Script de diagnostic pour vérifier l'état de la base de données
 */
async function diagnosticDatabase(): Promise<void> {
  try {
    console.log('[Diagnostic] Starting database diagnostic...\n');

    // 1. Compter les utilisateurs
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 'moderation.status': 'active' });
    const suspendedUsers = await User.countDocuments({ 'moderation.status': 'suspended' });
    const deletedUsers = await User.countDocuments({ 'deletion.isDeleted': true });

    console.log('=== USERS ===');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Active users: ${activeUsers}`);
    console.log(`Suspended users: ${suspendedUsers}`);
    console.log(`Deleted users: ${deletedUsers}\n`);

    // 2. Compter les activités
    const totalActivities = await Activity.countDocuments();
    const upcomingActivities = await Activity.countDocuments({ status: 'upcoming' });
    const ongoingActivities = await Activity.countDocuments({ status: 'ongoing' });
    const completedActivities = await Activity.countDocuments({ status: 'completed' });
    const cancelledActivities = await Activity.countDocuments({ status: 'cancelled' });

    console.log('=== ACTIVITIES ===');
    console.log(`Total activities: ${totalActivities}`);
    console.log(`Upcoming: ${upcomingActivities}`);
    console.log(`Ongoing: ${ongoingActivities}`);
    console.log(`Completed: ${completedActivities}`);
    console.log(`Cancelled: ${cancelledActivities}\n`);

    // 3. Vérifier les activités orphelines
    console.log('=== CHECKING FOR ORPHAN ACTIVITIES ===');
    
    const activities = await Activity.find({}).select('_id title createdBy status').lean();
    
    if (activities.length === 0) {
      console.log('No activities found in database\n');
      return;
    }

    let orphanCount = 0;
    const orphanActivities: any[] = [];

    for (const activity of activities) {
      const userExists = await User.exists({ _id: activity.createdBy });
      
      if (!userExists) {
        orphanCount++;
        orphanActivities.push({
          id: activity._id,
          title: activity.title,
          status: activity.status,
          createdBy: activity.createdBy,
        });
      }
    }

    if (orphanCount > 0) {
      console.log(`Found ${orphanCount} orphan activities:\n`);
      orphanActivities.forEach((activity, index) => {
        console.log(`${index + 1}. ${activity.title}`);
        console.log(`   ID: ${activity.id}`);
        console.log(`   Status: ${activity.status}`);
        console.log(`   CreatedBy: ${activity.createdBy}\n`);
      });
    } else {
      console.log('No orphan activities found ✓\n');
    }

    // 4. Vérifier les activités avec populate
    console.log('=== CHECKING ACTIVITIES WITH POPULATE ===');
    const populatedActivities = await Activity.find({})
      .populate('createdBy', 'name')
      .limit(5)
      .lean();

    if (populatedActivities.length > 0) {
      console.log(`Sample of ${populatedActivities.length} activities:`);
      populatedActivities.forEach((activity: any, index) => {
        console.log(`${index + 1}. ${activity.title}`);
        console.log(`   Creator: ${activity.createdBy ? activity.createdBy.name : 'NULL (ORPHAN)'}\n`);
      });
    }

  } catch (error) {
    console.error('[Diagnostic] Error:', error);
    throw error;
  }
}

// Si le script est exécuté directement
if (require.main === module) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';
  
  console.log(`Connecting to: ${MONGODB_URI}\n`);
  
  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log('✓ Connected to MongoDB\n');
      await diagnosticDatabase();
      await mongoose.disconnect();
      console.log('✓ Disconnected from MongoDB');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ MongoDB connection error:', error);
      process.exit(1);
    });
}

export { diagnosticDatabase };
