require('dotenv').config();
const mongoose = require('mongoose');

// Utiliser localhost depuis l'hôte, pas le nom du conteneur
const MONGODB_URI = 'mongodb://localhost:27017/lokky';

async function clearDatabase() {
  try {
    console.log('Connexion à MongoDB...');
    console.log('URI:', MONGODB_URI);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log(`\nCollections trouvées: ${collections.length}`);
    collections.forEach(col => console.log(`  - ${col.name}`));

    if (collections.length === 0) {
      console.log('\n⚠️  Aucune collection à supprimer');
      await mongoose.connection.close();
      return;
    }

    console.log('\n🗑️  Suppression de toutes les collections...');
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      await db.collection(collection.name).deleteMany({});
      console.log(`  ✅ ${collection.name}: ${count} documents supprimés`);
    }

    console.log('\n✅ Base de données vidée avec succès!');
    await mongoose.connection.close();
    console.log('Connexion fermée');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

clearDatabase();
