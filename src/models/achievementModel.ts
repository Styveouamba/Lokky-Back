import mongoose, { Document, Schema } from 'mongoose';

export interface IAchievement extends Document {
  user: mongoose.Types.ObjectId;
  type: 'first_activity_created' | 'first_activity_joined' | 'first_review' | 'first_message' | 'activities_5' | 'activities_10' | 'perfect_attendance' | 'social_butterfly';
  title: string;
  description: string;
  icon: string;
  earnedAt: Date;
  seen: boolean;
}

const achievementSchema = new Schema<IAchievement>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'first_activity_created',
        'first_activity_joined',
        'first_review',
        'first_message',
        'activities_5',
        'activities_10',
        'perfect_attendance',
        'social_butterfly',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour éviter les doublons
achievementSchema.index({ user: 1, type: 1 }, { unique: true });

export default mongoose.model<IAchievement>('Achievement', achievementSchema);
