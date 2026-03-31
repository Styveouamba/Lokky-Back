/**
 * Script pour créer les index nécessaires au système de rappels d'activités
 * 
 * Usage: node create-reminder-indexes.js
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
    const collection = db.collection('activityreminders');

    console.log('\n📊 Création des index pour le système de rappels...\n');

    // Index 1: activityId
    console.log('1️⃣ Création de l\'index activityId...');
    await collection.createIndex(
      { activityId: 1 },
      { name: 'activityId_idx' }
    );
    console.log('✅ Index activityId créé');

    // Index 2: userId
    console.log('2️⃣ Création de l\'index userId...');
    await collection.createIndex(
      { userId: 1 },
      { name: 'userId_idx' }
    );
    console.log('✅ Index userId créé');

    // Index 3: scheduledFor
    console.log('3️⃣ Création de l\'index scheduledFor...');
    await collection.createIndex(
      { scheduledFor: 1 },
      { name: 'scheduledFor_idx' }
    );
    console.log('✅ Index scheduledFor créé');

    // Index 4: sent
    console.log('4️⃣ Création de l\'index sent...');
    await collection.createIndex(
      { sent: 1 },
      { name: 'sent_idx' }
    );
    console.log('✅ Index sent créé');

    // Index 5: scheduledFor + sent (composé pour les requêtes de rappels en attente)
    console.log('5️⃣ Création de l\'index composé scheduledFor + sent...');
    await collection.createIndex(
      { scheduledFor: 1, sent: 1 },
      { name: 'scheduledFor_sent_idx' }
    );
    console.log('✅ Index composé scheduledFor_sent créé');

    // Index 6: activityId + userId + reminderType (unique pour éviter les doublons)
    console.log('6️⃣ Création de l\'index unique activityId + userId + reminderType...');
    await collection.createIndex(
      { activityId: 1, userId: 1, reminderType: 1 },
      { name: 'activity_user_type_unique_idx', unique: true }
    );
    console.log('✅ Index unique créé');

    // Index 7: TTL sur createdAt (suppression automatique après 7 jours)
    console.log('7️⃣ Création de l\'index TTL sur createdAt...');
    await collection.createIndex(
      { createdAt: 1 },
      { 
        name: 'createdAt_ttl_idx',
        expireAfterSeconds: 7 * 24 * 60 * 60 // 7 jours
      }
    );
    console.log('✅ Index TTL créé (suppression automatique après 7 jours)');

    // Vérifier les index créés
    console.log('\n📋 Liste des index créés:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.expireAfterSeconds) {
        console.log(`     (TTL: ${index.expireAfterSeconds / 86400} jours)`);
      }
      if (index.unique) {
        console.log(`     (UNIQUE)`);
      }
    });

    console.log('\n✅ Tous les index ont été créés avec succès!');
    console.log('\n💡 Le système de rappels d\'activités est maintenant opérationnel.');
    console.log('   Les rappels seront envoyés automatiquement 24h et 2h avant chaque activité.');

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
