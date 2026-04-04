import mongoose from 'mongoose';

const AiLogSchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true },
    userId: { type: String, index: true },
    stage: { type: String, required: true, index: true },
    status: { type: String, required: true },
    inputPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    errorMessage: { type: String, default: '' },
    traceId: { type: String, default: '' },
    containsPromptData: { type: Boolean, default: false },
    containsUserData: { type: Boolean, default: true },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

AiLogSchema.index({ sessionId: 1, stage: 1, createdAt: -1 });

export const AiLog = mongoose.models.AiLog || mongoose.model('AiLog', AiLogSchema);
