import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  description?: string;
  avatar?: string;
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  isPrivate: boolean;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSender?: string;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    admins: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    lastMessage: {
      type: String,
    },
    lastMessageAt: {
      type: Date,
    },
    lastMessageSender: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IGroup>('Group', groupSchema);
