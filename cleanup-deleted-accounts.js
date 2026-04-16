const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';

async function cleanupDeletedAccounts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.model('User');
    const Activity = mongoose.model('Activity');
    const Message = mongoose.model('Message');
    const Conversation = mongoose.model('Conversation');
    const Review = mongoose.model('Review');

    // Trouver les comptes dont la période de grâce est expirée
    const now = new Date();
    const usersToDelete = await User.find({
      'deletion.isDeleted': true,
      'deletion.scheduledFor': { $lte: now },
    });

    console.log(`📋 Found ${usersToDelete.length} accounts to permanently delete`);

    for (const user of usersToDelete) {
      console.log(`\n🗑️  Deleting user: ${user.name} (${user.email})`);

      // Supprimer les activités créées par l'utilisateur
      const deletedActivities = await Activity.deleteMany({ createdBy: user._id });
      console.log(`   ✓ Deleted ${deletedActivities.deletedCount} activities`);

      // Retirer l'utilisateur des participants des activités
      const updatedActivities = await Activity.updateMany(
        { participants: user._id },
        { $pull: { participants: user._id } }
      );
      console.log(`   ✓ Removed from ${updatedActivities.modifiedCount} activities`);

      // Supprimer les messages de l'utilisateur
      const deletedMessages = await Message.deleteMany({ sender: user._id });
      console.log(`   ✓ Deleted ${deletedMessages.deletedCount} messages`);

      // Supprimer les conversations où l'utilisateur est participant
      const deletedConversations = await Conversation.deleteMany({
        participants: user._id,
      });
      console.log(`   ✓ Deleted ${deletedConversations.deletedCount} conversations`);

      // Supprimer les avis donnés par l'utilisateur
      const deletedReviews = await Review.deleteMany({ reviewer: user._id });
      console.log(`   ✓ Deleted ${deletedReviews.deletedCount} reviews`);

      // Supprimer l'utilisateur
      await User.findByIdAndDelete(user._id);
      console.log(`   ✅ User permanently deleted`);
    }

    console.log(`\n✅ Cleanup completed! ${usersToDelete.length} accounts permanently deleted`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupDeletedAccounts();
