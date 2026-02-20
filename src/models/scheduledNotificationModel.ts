import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduledNotification extends Document {
  activityId: mongoose.Types.ObjectId;
  scheduledFor: Date;
  type: 'activity_completed';
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  sentAt?: Date;
}

const scheduledNotificationSchema = new Schema<IScheduledNotification>(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['activity_completed'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    sentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour les requêtes de notifications en attente
scheduledNotificationSchema.index({ status: 1, scheduledFor: 1 });

export default mongoose.model<IScheduledNotification>('ScheduledNotification', scheduledNotificationSchema);
