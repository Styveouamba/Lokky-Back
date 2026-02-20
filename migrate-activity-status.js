/**
 * Script de migration pour mettre à jour les statuts des activités
 * Convertit 'active' en 'upcoming' et ajoute une durée par défaut si manquante
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Utiliser localhost si l'URI contient 'mongo:' (conteneur Docker)
let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';
if (MONGODB_URI.includes('mongo:')) {
  MONGODB_URI = MONGODB_URI.replace('mongo:', 'localhost:');
  console.log('⚠️  Utilisation de localhost au lieu du conteneur Docker');
}

console.log('📍 MongoDB URI:', MONGODB_URI);

async function migrate() {
  try {
    console.log('Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const Activity = mongoose.model('Activity', new mongoose.Schema({}, { strict: false }));

    // Mettre à jour les activités avec status 'active' vers 'upcoming'
    const result1 = await Activity.updateMany(
      { status: 'active' },
      { $set: { status: 'upcoming' } }
    );
    console.log(`✅ Mis à jour ${result1.modifiedCount} activités de 'active' vers 'upcoming'`);

    // Ajouter une durée par défaut de 2h aux activités qui n'en ont pas
    const result2 = await Activity.updateMany(
      { duration: { $exists: false } },
      { $set: { duration: 2 } }
    );
    console.log(`✅ Ajouté durée par défaut à ${result2.modifiedCount} activités`);

    // Afficher un résumé
    const stats = await Activity.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📊 Résumé des statuts:');
    stats.forEach(stat => {
      console.log(`  - ${stat._id}: ${stat.count} activité(s)`);
    });

    console.log('\n✅ Migration terminée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

migrate();
