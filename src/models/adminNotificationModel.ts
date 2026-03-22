import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminNotification extends Document {
  user: mongoose.Types.ObjectId;
  type: 'warning' | 'suspension' | 'ban' | 'reactivation' | 'custom';
  title: string;
  message: string;
  reason?: string;
  duration?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['warning', 'suspension', 'ban', 'reactivation', 'custom'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
    },
    duration: {
      type: String,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour récupérer rapidement les notifications non lues d'un utilisateur
adminNotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.model<IAdminNotification>('AdminNotification', adminNotificationSchema);
