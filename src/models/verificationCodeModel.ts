import mongoose, { Document, Schema } from 'mongoose';

export interface IVerificationCode extends Document {
  email: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
}

const verificationCodeSchema = new Schema<IVerificationCode>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  },
  {
    timestamps: true,
  }
);

// Index pour supprimer automatiquement les codes expirés
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index pour rechercher rapidement par email
verificationCodeSchema.index({ email: 1 });

export default mongoose.model<IVerificationCode>('VerificationCode', verificationCodeSchema);
