import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityReminder extends Document {
  activityId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reminderType: '24h' | '2h';
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const activityReminderSchema = new Schema<IActivityReminder>(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reminderType: {
      type: String,
      enum: ['24h', '2h'],
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    sent: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour les requêtes fréquentes
activityReminderSchema.index({ scheduledFor: 1, sent: 1 });
activityReminderSchema.index({ activityId: 1, userId: 1, reminderType: 1 }, { unique: true });

// TTL index - supprimer automatiquement les rappels après 7 jours
activityReminderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export default mongoose.model<IActivityReminder>('ActivityReminder', activityReminderSchema);
