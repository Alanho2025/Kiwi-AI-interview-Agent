import mongoose from 'mongoose';

const SessionAnalysisSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    cvDocumentId: { type: String },
    jdInputId: { type: String },
    jdStructuredText: { type: String, default: '' },
    jdRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchingDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    analysisStatus: { type: String, default: 'completed' },
    promptVersion: { type: String, default: 'v1' },
    redactionStatus: { type: String, default: 'not_redacted' },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    containsSensitiveData: { type: Boolean, default: true },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const SessionAnalysis = mongoose.models.SessionAnalysis || mongoose.model('SessionAnalysis', SessionAnalysisSchema);
