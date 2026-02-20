import mongoose from 'mongoose';
import Activity from '../models/activityModel';
import User from '../models/userModel';
import Message from '../models/messageModel';
import Conversation from '../models/conversationModel';
import Group from '../models/groupModel';

/**
 * Crée tous les index nécessaires pour optimiser les requêtes
 */
export async function createIndexes() {
  try {
    console.log('Creating database indexes...');

    // Index pour les utilisateurs
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ location: '2dsphere' });
    await User.collection.createIndex({ interests: 1 });
    await User.collection.createIndex({ goals: 1 });
    console.log('✓ User indexes created');

    // Index pour les activités
    await Activity.collection.createIndex({ 
      location: '2dsphere',
      status: 1,
      date: 1 
    });
    await Activity.collection.createIndex({ tags: 1, status: 1 });
    await Activity.collection.createIndex({ category: 1, status: 1 });
    await Activity.collection.createIndex({ createdBy: 1, status: 1 });
    await Activity.collection.createIndex({ date: 1, status: 1 });
    await Activity.collection.createIndex({ status: 1, createdAt: -1 });
    console.log('✓ Activity indexes created');

    // Index pour les messages
    await Message.collection.createIndex({ conversation: 1, createdAt: -1 });
    await Message.collection.createIndex({ group: 1, createdAt: -1 });
    await Message.collection.createIndex({ sender: 1, createdAt: -1 });
    console.log('✓ Message indexes created');

    // Index pour les conversations
    await Conversation.collection.createIndex({ participants: 1 });
    await Conversation.collection.createIndex({ lastMessageAt: -1 });
    console.log('✓ Conversation indexes created');

    // Index pour les groupes
    await Group.collection.createIndex({ members: 1 });
    await Group.collection.createIndex({ createdBy: 1 });
    await Group.collection.createIndex({ isPrivate: 1 });
    console.log('✓ Group indexes created');

    console.log('All indexes created successfully!');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}
