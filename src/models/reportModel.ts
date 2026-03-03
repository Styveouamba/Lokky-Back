import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  reporter: mongoose.Types.ObjectId; // Celui qui signale
  reportedUser?: mongoose.Types.ObjectId; // Utilisateur signalé
  reportedActivity?: mongoose.Types.ObjectId; // Activité signalée
  reportType: 'user' | 'activity';
  reason: 'spam' | 'inappropriate' | 'harassment' | 'fake' | 'dangerous' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  action?: 'none' | 'warning' | 'content_removed' | 'user_suspended' | 'user_banned';
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reportedActivity: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
    },
    reportType: {
      type: String,
      enum: ['user', 'activity'],
      required: true,
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'harassment', 'fake', 'dangerous', 'other'],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    action: {
      type: String,
      enum: ['none', 'warning', 'content_removed', 'user_suspended', 'user_banned'],
    },
  },
  {
    timestamps: true,
  }
);

// Index pour éviter les signalements en double
reportSchema.index({ reporter: 1, reportedUser: 1, reportedActivity: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IReport>('Report', reportSchema);
