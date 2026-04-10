require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

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

// Interface pour poser des questions
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function cleanActivities() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Compter les activités qui correspondent au pattern de seed
    const seededActivities = await Activity.find({
      title: { $regex: /#\d+$/ } // Activités avec #nombre à la fin
    });

    if (seededActivities.length === 0) {
      console.log('ℹ️  Aucune activité de test trouvée (pattern: titre se terminant par #nombre)');
      await mongoose.connection.close();
      rl.close();
      return;
    }

    console.log(`🔍 ${seededActivities.length} activités de test trouvées\n`);

    // Afficher les statistiques
    const categoryStats = {};
    const withImages = seededActivities.filter(a => a.imageUrl).length;
    
    seededActivities.forEach(activity => {
      categoryStats[activity.category] = (categoryStats[activity.category] || 0) + 1;
    });

    console.log('📊 Statistiques des activités à supprimer:');
    console.log(`   - Total: ${seededActivities.length} activités`);
    console.log(`   - Avec images: ${withImages}`);
    console.log(`   - Sans images: ${seededActivities.length - withImages}\n`);
    
    console.log('📈 Répartition par catégorie:');
    Object.entries(categoryStats).forEach(([cat, count]) => {
      console.log(`   - ${cat}: ${count} activités`);
    });

    console.log('\n⚠️  ATTENTION: Cette action est irréversible!\n');

    // Options de suppression
    console.log('Options de suppression:');
    console.log('1. Supprimer TOUTES les activités de test');
    console.log('2. Supprimer par catégorie');
    console.log('3. Supprimer uniquement celles avec images');
    console.log('4. Supprimer uniquement celles sans images');
    console.log('5. Annuler\n');

    const choice = await askQuestion('Votre choix (1-5): ');

    let filter = { title: { $regex: /#\d+$/ } };
    let toDelete = [];

    switch (choice.trim()) {
      case '1':
        toDelete = seededActivities;
        break;

      case '2':
        console.log('\nCatégories disponibles:');
        Object.keys(categoryStats).forEach((cat, index) => {
          console.log(`${index + 1}. ${cat} (${categoryStats[cat]} activités)`);
        });
        
        const catChoice = await askQuestion('\nChoisir une catégorie (numéro): ');
        const selectedCat = Object.keys(categoryStats)[parseInt(catChoice) - 1];
        
        if (selectedCat) {
          filter.category = selectedCat;
          toDelete = seededActivities.filter(a => a.category === selectedCat);
        } else {
          console.log('❌ Catégorie invalide');
          await mongoose.connection.close();
          rl.close();
          return;
        }
        break;

      case '3':
        filter.imageUrl = { $exists: true, $ne: null };
        toDelete = seededActivities.filter(a => a.imageUrl);
        break;

      case '4':
        filter.imageUrl = { $exists: false };
        toDelete = seededActivities.filter(a => !a.imageUrl);
        break;

      case '5':
        console.log('❌ Opération annulée');
        await mongoose.connection.close();
        rl.close();
        return;

      default:
        console.log('❌ Choix invalide');
        await mongoose.connection.close();
        rl.close();
        return;
    }

    if (toDelete.length === 0) {
      console.log('\nℹ️  Aucune activité correspondante trouvée');
      await mongoose.connection.close();
      rl.close();
      return;
    }

    console.log(`\n⚠️  ${toDelete.length} activités seront supprimées`);
    const confirm = await askQuestion('\nConfirmer la suppression? (oui/non): ');

    if (confirm.toLowerCase() === 'oui' || confirm.toLowerCase() === 'o') {
      console.log('\n🗑️  Suppression en cours...');
      const result = await Activity.deleteMany(filter);
      
      console.log(`\n✅ ${result.deletedCount} activités supprimées avec succès!`);
    } else {
      console.log('\n❌ Opération annulée');
    }

    await mongoose.connection.close();
    console.log('🔌 Déconnecté de MongoDB');
    rl.close();

  } catch (error) {
    console.error('❌ Erreur:', error);
    rl.close();
    process.exit(1);
  }
}

// Exécuter le script
cleanActivities();
