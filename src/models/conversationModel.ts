import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: String,
    },
    lastMessageAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour rechercher rapidement les conversations d'un utilisateur
conversationSchema.index({ participants: 1 });

// Méthode pour vérifier si un utilisateur fait partie de la conversation
conversationSchema.methods.hasParticipant = function (userId: string): boolean {
  return this.participants.some((id: mongoose.Types.ObjectId) => id.toString() === userId);
};

const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

export default Conversation;
