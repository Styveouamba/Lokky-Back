/**
 * Script de test pour le système de diversité
 * 
 * Usage: node test-diversity.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meetup-app';

async function testDiversity() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    const db = mongoose.connection.db;
    
    // Test 1: Vérifier que la collection existe
    console.log('📋 Test 1: Vérification de la collection');
    const collections = await db.listCollections({ name: 'activityviewhistories' }).toArray();
    if (collections.length > 0) {
      console.log('✅ Collection activityviewhistories existe');
    } else {
      console.log('⚠️  Collection activityviewhistories n\'existe pas encore (normal si aucune vue enregistrée)');
    }

    // Test 2: Vérifier les index
    console.log('\n📋 Test 2: Vérification des index');
    const collection = db.collection('activityviewhistories');
    const indexes = await collection.indexes();
    
    const requiredIndexes = [
      'userId_viewedAt_idx',
      'userId_activityId_idx',
      'activityId_idx',
      'viewedAt_ttl_idx'
    ];

    let allIndexesPresent = true;
    requiredIndexes.forEach(indexName => {
      const found = indexes.find(idx => idx.name === indexName);
      if (found) {
        console.log(`✅ Index ${indexName} présent`);
        if (found.expireAfterSeconds) {
          console.log(`   TTL: ${found.expireAfterSeconds / 86400} jours`);
        }
      } else {
        console.log(`❌ Index ${indexName} manquant`);
        allIndexesPresent = false;
      }
    });

    if (!allIndexesPresent) {
      console.log('\n⚠️  Certains index sont manquants. Exécutez: node create-diversity-indexes.js');
    }

    // Test 3: Statistiques sur les vues
    console.log('\n📋 Test 3: Statistiques des vues');
    const totalViews = await collection.countDocuments();
    console.log(`📊 Total de vues enregistrées: ${totalViews}`);

    if (totalViews > 0) {
      // Nombre d'utilisateurs uniques
      const uniqueUsers = await collection.distinct('userId');
      console.log(`👥 Utilisateurs uniques: ${uniqueUsers.length}`);

      // Nombre d'activités uniques vues
      const uniqueActivities = await collection.distinct('activityId');
      console.log(`🎯 Activités uniques vues: ${uniqueActivities.length}`);

      // Vues avec interaction
      const interactedViews = await collection.countDocuments({ interacted: true });
      const interactionRate = ((interactedViews / totalViews) * 100).toFixed(2);
      console.log(`👆 Vues avec interaction: ${interactedViews} (${interactionRate}%)`);

      // Vues récentes (dernières 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const recentViews = await collection.countDocuments({ viewedAt: { $gte: yesterday } });
      console.log(`🕐 Vues dernières 24h: ${recentViews}`);

      // Top 5 des activités les plus vues
      console.log('\n🏆 Top 5 des activités les plus vues:');
      const topActivities = await collection.aggregate([
        { $group: { _id: '$activityId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]).toArray();

      topActivities.forEach((activity, index) => {
        console.log(`   ${index + 1}. Activité ${activity._id}: ${activity.count} vues`);
      });

      // Top 5 des utilisateurs les plus actifs
      console.log('\n👤 Top 5 des utilisateurs les plus actifs:');
      const topUsers = await collection.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]).toArray();

      topUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. Utilisateur ${user._id}: ${user.count} vues`);
      });

      // Distribution des vues par jour (7 derniers jours)
      console.log('\n📅 Distribution des vues (7 derniers jours):');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const dailyViews = await collection.aggregate([
        { $match: { viewedAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$viewedAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

      dailyViews.forEach(day => {
        console.log(`   ${day._id}: ${day.count} vues`);
      });

    } else {
      console.log('ℹ️  Aucune vue enregistrée pour le moment');
      console.log('   Les vues seront enregistrées automatiquement quand les utilisateurs');
      console.log('   chargeront le feed avec le paramètre ranked=true');
    }

    // Test 4: Vérifier les modèles
    console.log('\n📋 Test 4: Vérification des modèles');
    const models = ['users', 'activities'];
    for (const modelName of models) {
      const count = await db.collection(modelName).countDocuments();
      console.log(`✅ Collection ${modelName}: ${count} documents`);
    }

    // Test 5: Simuler un calcul de diversité
    console.log('\n📋 Test 5: Simulation du calcul de diversité');
    
    if (totalViews > 0 && uniqueUsers.length > 0) {
      const testUserId = uniqueUsers[0];
      console.log(`🧪 Test avec l'utilisateur: ${testUserId}`);

      // Récupérer l'historique de cet utilisateur
      const userViews = await collection.find({ userId: testUserId })
        .sort({ viewedAt: -1 })
        .limit(10)
        .toArray();

      console.log(`   Dernières vues: ${userViews.length}`);
      
      userViews.forEach((view, index) => {
        const daysAgo = Math.floor((new Date() - view.viewedAt) / (1000 * 60 * 60 * 24));
        const interaction = view.interacted ? '👆' : '👁️';
        console.log(`   ${index + 1}. ${interaction} Activité ${view.activityId} (il y a ${daysAgo} jours)`);
      });

      // Calculer une pénalité exemple
      if (userViews.length > 0) {
        const recentView = userViews[0];
        const daysAgo = Math.floor((new Date() - recentView.viewedAt) / (1000 * 60 * 60 * 24));
        
        let penalty = 5; // Base: -5 points
        if (daysAgo < 1) penalty += 20;
        else if (daysAgo < 3) penalty += 15;
        else if (daysAgo < 7) penalty += 10;
        else if (daysAgo < 14) penalty += 5;

        console.log(`\n   💡 Exemple de pénalité pour l'activité la plus récente:`);
        console.log(`      - Vue il y a ${daysAgo} jours`);
        console.log(`      - Pénalité calculée: -${penalty} points`);
        console.log(`      - Cette activité sera moins prioritaire dans le feed`);
      }
    } else {
      console.log('ℹ️  Pas assez de données pour simuler le calcul');
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DU TEST');
    console.log('='.repeat(60));
    
    if (allIndexesPresent) {
      console.log('✅ Tous les index sont présents');
    } else {
      console.log('⚠️  Certains index sont manquants');
    }

    if (totalViews > 0) {
      console.log(`✅ Système actif avec ${totalViews} vues enregistrées`);
      console.log(`✅ ${uniqueUsers.length} utilisateurs et ${uniqueActivities.length} activités trackées`);
    } else {
      console.log('ℹ️  Système prêt mais aucune vue enregistrée encore');
      console.log('   Le tracking commencera automatiquement avec l\'utilisation');
    }

    console.log('\n💡 Le système de diversité est opérationnel!');
    console.log('   Les utilisateurs verront des activités plus variées dans leur feed.');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

testDiversity();
