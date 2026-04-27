import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  plan: 'monthly' | 'annual';
  status: 'pending' | 'trial' | 'active' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  trialEndDate?: Date;
  autoRenew: boolean;
  paymentMethod: 'wave' | 'orange_money' | 'visa';
  amount: number;
  currency: 'XOF' | 'EUR';
  nabooTransactionId?: string;
  nabooCustomerId?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['monthly', 'annual'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'trial', 'active', 'expired', 'cancelled'],
      required: true,
      default: 'pending',
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    trialEndDate: {
      type: Date,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      enum: ['wave', 'orange_money', 'visa'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['XOF', 'EUR'],
      default: 'XOF',
    },
    nabooTransactionId: {
      type: String,
    },
    nabooCustomerId: {
      type: String,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user subscription queries
subscriptionSchema.index({ userId: 1, status: 1 });

// Pre-save hook for date validation
subscriptionSchema.pre('save', function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  } else {
    next();
  }
});

export default mongoose.model<ISubscription>('Subscription', subscriptionSchema);
