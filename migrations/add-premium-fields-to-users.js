const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';

async function addPremiumFieldsToUsers() {
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Migration] Connected successfully');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('[Migration] Adding premium fields to existing users...');

    // Update all users without premium field
    const result = await usersCollection.updateMany(
      { premium: { $exists: false } },
      {
        $set: {
          premium: {
            isActive: false,
            plan: null,
            since: null,
            expiresAt: null,
          },
        },
      }
    );

    console.log(`[Migration] Updated ${result.modifiedCount} users`);

    // Create index on premium.isActive
    console.log('[Migration] Creating index on premium.isActive...');
    await usersCollection.createIndex({ 'premium.isActive': 1 });
    console.log('[Migration] Index created successfully');

    console.log('[Migration] ✅ Migration completed successfully');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Disconnected from MongoDB');
  }
}

// Rollback function
async function rollbackPremiumFields() {
  try {
    console.log('[Rollback] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Rollback] Connected successfully');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('[Rollback] Removing premium fields from users...');

    const result = await usersCollection.updateMany(
      {},
      { $unset: { premium: '' } }
    );

    console.log(`[Rollback] Updated ${result.modifiedCount} users`);

    // Drop index
    console.log('[Rollback] Dropping index on premium.isActive...');
    try {
      await usersCollection.dropIndex('premium.isActive_1');
      console.log('[Rollback] Index dropped successfully');
    } catch (error) {
      console.log('[Rollback] Index may not exist, skipping...');
    }

    console.log('[Rollback] ✅ Rollback completed successfully');
  } catch (error) {
    console.error('[Rollback] ❌ Rollback failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('[Rollback] Disconnected from MongoDB');
  }
}

// Run migration or rollback based on command line argument
const command = process.argv[2];

if (command === 'rollback') {
  rollbackPremiumFields()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  addPremiumFieldsToUsers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
