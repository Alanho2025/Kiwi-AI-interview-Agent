import mongoose from 'mongoose';

const SessionFeedbackDetailSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    scores: { type: mongoose.Schema.Types.Mixed, default: {} },
    strengths: { type: [mongoose.Schema.Types.Mixed], default: [] },
    gaps: { type: [mongoose.Schema.Types.Mixed], default: [] },
    jobFitObservations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    improvementSuggestions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    modelMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    redactedFeedback: { type: mongoose.Schema.Types.Mixed, default: {} },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const SessionFeedbackDetail = mongoose.models.SessionFeedbackDetail || mongoose.model('SessionFeedbackDetail', SessionFeedbackDetailSchema);
