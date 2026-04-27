import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  nabooTransactionId: string;
  amount: number;
  currency: 'XOF' | 'EUR';
  paymentMethod: 'wave' | 'orange_money' | 'visa';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  nabooStatus?: string;
  nabooResponse?: any;
  webhookReceived: boolean;
  webhookReceivedAt?: Date;
  failureReason?: string;
  metadata?: {
    plan: string;
    isRenewal: boolean;
    isTrial: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    nabooTransactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    paymentMethod: {
      type: String,
      enum: ['wave', 'orange_money', 'visa'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      required: true,
      default: 'pending',
      index: true,
    },
    nabooStatus: {
      type: String,
    },
    nabooResponse: {
      type: Schema.Types.Mixed,
    },
    webhookReceived: {
      type: Boolean,
      default: false,
    },
    webhookReceivedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    metadata: {
      plan: {
        type: String,
      },
      isRenewal: {
        type: Boolean,
        default: false,
      },
      isTrial: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITransaction>('Transaction', transactionSchema);
