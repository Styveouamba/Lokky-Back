/**
 * Script pour mettre à jour les compteurs de reputation pour tous les utilisateurs
 * À exécuter une seule fois pour synchroniser les données existantes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({}, { strict: false });
const activitySchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Activity = mongoose.model('Activity', activitySchema);

async function updateReputationCounters() {
  try {
    console.log('🔄 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky');
    console.log('✅ Connecté à MongoDB');

    console.log('\n📊 Mise à jour des compteurs de reputation...');

    // Récupérer tous les utilisateurs
    const users = await User.find({});
    console.log(`👥 ${users.length} utilisateurs trouvés`);

    let updated = 0;

    for (const user of users) {
      // Compter les activités créées par cet utilisateur
      const activitiesCreated = await Activity.countDocuments({
        createdBy: user._id,
      });

      // Compter les activités auxquelles l'utilisateur participe
      const activitiesCompleted = await Activity.countDocuments({
        participants: user._id,
        status: { $in: ['completed', 'cancelled'] },
      });

      // Mettre à jour le compteur
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            'reputation.activitiesCreated': activitiesCreated,
            'reputation.activitiesCompleted': activitiesCompleted,
          },
        }
      );

      updated++;
      console.log(`✅ ${user.name}: ${activitiesCreated} créées, ${activitiesCompleted} complétées`);
    }

    console.log(`\n🎉 ${updated} utilisateurs mis à jour avec succès!`);
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Déconnecté de MongoDB');
    process.exit(0);
  }
}

updateReputationCounters();
