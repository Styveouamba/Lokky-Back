import mongoose, { Document, Schema } from 'mongoose';

export interface IBlock extends Document {
  blocker: mongoose.Types.ObjectId; // Celui qui bloque
  blocked: mongoose.Types.ObjectId; // Celui qui est bloqué
  createdAt: Date;
}

const blockSchema = new Schema<IBlock>(
  {
    blocker: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    blocked: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index unique pour éviter les doublons
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export default mongoose.model<IBlock>('Block', blockSchema);
