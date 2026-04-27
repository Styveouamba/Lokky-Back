const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';

async function createSubscriptionIndexes() {
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Migration] Connected successfully');

    const db = mongoose.connection.db;

    // Create indexes for Subscription collection
    console.log('[Migration] Creating indexes for Subscription collection...');
    const subscriptionsCollection = db.collection('subscriptions');

    await subscriptionsCollection.createIndex({ userId: 1 });
    console.log('[Migration] Created index: userId');

    await subscriptionsCollection.createIndex({ status: 1 });
    console.log('[Migration] Created index: status');

    await subscriptionsCollection.createIndex({ endDate: 1 });
    console.log('[Migration] Created index: endDate');

    await subscriptionsCollection.createIndex({ userId: 1, status: 1 });
    console.log('[Migration] Created compound index: userId + status');

    // Create indexes for Transaction collection
    console.log('[Migration] Creating indexes for Transaction collection...');
    const transactionsCollection = db.collection('transactions');

    await transactionsCollection.createIndex({ nabooTransactionId: 1 }, { unique: true });
    console.log('[Migration] Created unique index: nabooTransactionId');

    await transactionsCollection.createIndex({ userId: 1 });
    console.log('[Migration] Created index: userId');

    await transactionsCollection.createIndex({ subscriptionId: 1 });
    console.log('[Migration] Created index: subscriptionId');

    await transactionsCollection.createIndex({ status: 1 });
    console.log('[Migration] Created index: status');

    console.log('[Migration] ✅ All indexes created successfully');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Disconnected from MongoDB');
  }
}

// Rollback function
async function dropSubscriptionIndexes() {
  try {
    console.log('[Rollback] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Rollback] Connected successfully');

    const db = mongoose.connection.db;

    // Drop indexes for Subscription collection
    console.log('[Rollback] Dropping indexes for Subscription collection...');
    const subscriptionsCollection = db.collection('subscriptions');

    const subscriptionIndexes = ['userId_1', 'status_1', 'endDate_1', 'userId_1_status_1'];
    for (const indexName of subscriptionIndexes) {
      try {
        await subscriptionsCollection.dropIndex(indexName);
        console.log(`[Rollback] Dropped index: ${indexName}`);
      } catch (error) {
        console.log(`[Rollback] Index ${indexName} may not exist, skipping...`);
      }
    }

    // Drop indexes for Transaction collection
    console.log('[Rollback] Dropping indexes for Transaction collection...');
    const transactionsCollection = db.collection('transactions');

    const transactionIndexes = [
      'nabooTransactionId_1',
      'userId_1',
      'subscriptionId_1',
      'status_1',
    ];
    for (const indexName of transactionIndexes) {
      try {
        await transactionsCollection.dropIndex(indexName);
        console.log(`[Rollback] Dropped index: ${indexName}`);
      } catch (error) {
        console.log(`[Rollback] Index ${indexName} may not exist, skipping...`);
      }
    }

    console.log('[Rollback] ✅ All indexes dropped successfully');
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
  dropSubscriptionIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  createSubscriptionIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
