import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityViewHistory extends Document {
  userId: mongoose.Types.ObjectId;
  activityId: mongoose.Types.ObjectId;
  viewedAt: Date;
  interacted: boolean; // Si l'utilisateur a cliqué pour voir les détails
}

const activityViewHistorySchema = new Schema<IActivityViewHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    activityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    interacted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour les requêtes fréquentes
activityViewHistorySchema.index({ userId: 1, viewedAt: -1 });
activityViewHistorySchema.index({ userId: 1, activityId: 1 });

// TTL index - supprimer automatiquement les vues après 30 jours
activityViewHistorySchema.index({ viewedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model<IActivityViewHistory>('ActivityViewHistory', activityViewHistorySchema);
