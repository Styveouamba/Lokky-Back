require('dotenv').config();
const mongoose = require('mongoose');

// Schéma Activity
const activitySchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  tags: [String],
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
    name: String,
    city: String,
  },
  date: Date,
  duration: Number,
  createdBy: mongoose.Schema.Types.ObjectId,
  participants: [mongoose.Schema.Types.ObjectId],
  maxParticipants: Number,
  imageUrl: String,
  status: String,
  groupId: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const Activity = mongoose.model('Activity', activitySchema);

async function showStats() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Statistiques globales
    const totalActivities = await Activity.countDocuments();
    const seededActivities = await Activity.countDocuments({ title: { $regex: /#\d+$/ } });
    const realActivities = totalActivities - seededActivities;

    console.log('📊 STATISTIQUES GLOBALES');
    console.log('═══════════════════════════════════════');
    console.log(`Total d'activités:        ${totalActivities}`);
    console.log(`  - Activités réelles:    ${realActivities}`);
    console.log(`  - Activités de test:    ${seededActivities}`);
    console.log('');

    // Statistiques par catégorie
    const categoryStats = await Activity.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          withImages: {
            $sum: { $cond: [{ $ne: ['$imageUrl', null] }, 1, 0] }
          },
          avgParticipants: { $avg: { $size: '$participants' } },
          avgMaxParticipants: { $avg: '$maxParticipants' },
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('📈 RÉPARTITION PAR CATÉGORIE');
    console.log('═══════════════════════════════════════');
    categoryStats.forEach(stat => {
      const percentage = ((stat.count / totalActivities) * 100).toFixed(1);
      console.log(`\n${stat._id.toUpperCase()}`);
      console.log(`  Nombre:              ${stat.count} (${percentage}%)`);
      console.log(`  Avec images:         ${stat.withImages}`);
      console.log(`  Participants moy:    ${stat.avgParticipants.toFixed(1)}`);
      console.log(`  Max participants:    ${stat.avgMaxParticipants.toFixed(1)}`);
    });

    // Statistiques par statut
    console.log('\n\n📋 RÉPARTITION PAR STATUT');
    console.log('═══════════════════════════════════════');
    const statusStats = await Activity.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    statusStats.forEach(stat => {
      const percentage = ((stat.count / totalActivities) * 100).toFixed(1);
      console.log(`${stat._id.padEnd(15)} ${stat.count} (${percentage}%)`);
    });

    // Statistiques par ville
    console.log('\n\n🌍 RÉPARTITION PAR VILLE');
    console.log('═══════════════════════════════════════');
    const cityStats = await Activity.aggregate([
      {
        $group: {
          _id: '$location.city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    cityStats.forEach(stat => {
      const percentage = ((stat.count / totalActivities) * 100).toFixed(1);
      console.log(`${(stat._id || 'Non spécifié').padEnd(20)} ${stat.count} (${percentage}%)`);
    });

    // Statistiques sur les images
    const withImages = await Activity.countDocuments({ imageUrl: { $exists: true, $ne: null } });
    const withoutImages = totalActivities - withImages;

    console.log('\n\n🖼️  STATISTIQUES IMAGES');
    console.log('═══════════════════════════════════════');
    console.log(`Avec images:         ${withImages} (${((withImages / totalActivities) * 100).toFixed(1)}%)`);
    console.log(`Sans images:         ${withoutImages} (${((withoutImages / totalActivities) * 100).toFixed(1)}%)`);

    // Statistiques temporelles
    const now = new Date();
    const upcoming = await Activity.countDocuments({ date: { $gte: now }, status: 'upcoming' });
    const past = await Activity.countDocuments({ date: { $lt: now } });

    console.log('\n\n📅 STATISTIQUES TEMPORELLES');
    console.log('═══════════════════════════════════════');
    console.log(`Activités à venir:   ${upcoming}`);
    console.log(`Activités passées:   ${past}`);

    // Activités les plus populaires
    console.log('\n\n⭐ TOP 5 ACTIVITÉS (par participants)');
    console.log('═══════════════════════════════════════');
    const topActivities = await Activity.find()
      .sort({ 'participants': -1 })
      .limit(5)
      .select('title category participants maxParticipants');

    topActivities.forEach((activity, index) => {
      const participantCount = activity.participants ? activity.participants.length : 0;
      console.log(`${index + 1}. ${activity.title}`);
      console.log(`   Catégorie: ${activity.category}`);
      console.log(`   Participants: ${participantCount}/${activity.maxParticipants}`);
      console.log('');
    });

    // Statistiques sur les tags
    console.log('🏷️  TOP 10 TAGS');
    console.log('═══════════════════════════════════════');
    const tagStats = await Activity.aggregate([
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    tagStats.forEach((stat, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${stat._id.padEnd(20)} ${stat.count} activités`);
    });

    console.log('\n═══════════════════════════════════════\n');

    await mongoose.connection.close();
    console.log('🔌 Déconnecté de MongoDB');

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter le script
showStats();
