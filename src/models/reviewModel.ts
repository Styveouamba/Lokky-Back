import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  activity: mongoose.Types.ObjectId;
  reviewer: mongoose.Types.ObjectId; // Celui qui note
  reviewee: mongoose.Types.ObjectId; // Celui qui est noté (créateur)
  activityRating: number; // Note de l'activité (1-5)
  creatorRating: number; // Note du créateur (1-5)
  wasPresent: boolean; // L'utilisateur était-il présent?
  comment?: string;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    activity: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activityRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    creatorRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    wasPresent: {
      type: Boolean,
      required: true,
      default: true,
    },
    comment: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour éviter les doublons (un utilisateur ne peut noter qu'une fois par activité)
reviewSchema.index({ activity: 1, reviewer: 1 }, { unique: true });

export default mongoose.model<IReview>('Review', reviewSchema);
