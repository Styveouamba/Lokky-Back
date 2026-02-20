import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  conversation?: mongoose.Types.ObjectId;
  group?: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  read: boolean;
  edited: boolean;
  deletedFor: mongoose.Types.ObjectId[];
  deletedForEveryone: boolean;
  isSystemMessage: boolean;
  systemMessageType?: 'user_joined' | 'user_left' | 'group_created' | 'activity_updated';
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    group: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    edited: {
      type: Boolean,
      default: false,
    },
    deletedFor: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    isSystemMessage: {
      type: Boolean,
      default: false,
    },
    systemMessageType: {
      type: String,
      enum: ['user_joined', 'user_left', 'group_created', 'activity_updated'],
    },
  },
  {
    timestamps: true,
  }
);

// Index pour récupérer rapidement les messages d'une conversation ou d'un groupe
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ group: 1, createdAt: -1 });

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
