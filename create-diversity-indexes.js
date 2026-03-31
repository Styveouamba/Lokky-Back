/**
 * Script pour créer les index nécessaires au système de diversité
 * 
 * Usage: node create-diversity-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meetup-app';

async function createIndexes() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('activityviewhistories');

    console.log('\n📊 Création des index pour le système de diversité...\n');

    // Index 1: userId + viewedAt (pour récupérer l'historique récent)
    console.log('1️⃣ Création de l\'index userId + viewedAt...');
    await collection.createIndex(
      { userId: 1, viewedAt: -1 },
      { name: 'userId_viewedAt_idx' }
    );
    console.log('✅ Index userId_viewedAt créé');

    // Index 2: userId + activityId (pour vérifier si une activité a été vue)
    console.log('2️⃣ Création de l\'index userId + activityId...');
    await collection.createIndex(
      { userId: 1, activityId: 1 },
      { name: 'userId_activityId_idx' }
    );
    console.log('✅ Index userId_activityId créé');

    // Index 3: activityId (pour nettoyer l'historique d'une activité)
    console.log('3️⃣ Création de l\'index activityId...');
    await collection.createIndex(
      { activityId: 1 },
      { name: 'activityId_idx' }
    );
    console.log('✅ Index activityId créé');

    // Index 4: TTL sur viewedAt (suppression automatique après 30 jours)
    console.log('4️⃣ Création de l\'index TTL sur viewedAt...');
    await collection.createIndex(
      { viewedAt: 1 },
      { 
        name: 'viewedAt_ttl_idx',
        expireAfterSeconds: 30 * 24 * 60 * 60 // 30 jours
      }
    );
    console.log('✅ Index TTL créé (suppression automatique après 30 jours)');

    // Vérifier les index créés
    console.log('\n📋 Liste des index créés:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.expireAfterSeconds) {
        console.log(`     (TTL: ${index.expireAfterSeconds / 86400} jours)`);
      }
    });

    console.log('\n✅ Tous les index ont été créés avec succès!');
    console.log('\n💡 Le système de diversité est maintenant opérationnel.');
    console.log('   Les vues seront automatiquement supprimées après 30 jours.');

  } catch (error) {
    console.error('❌ Erreur lors de la création des index:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

createIndexes();
