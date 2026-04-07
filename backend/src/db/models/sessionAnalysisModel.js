import mongoose from 'mongoose';

const SessionAnalysisSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    cvDocumentId: { type: String },
    jdInputId: { type: String },
    jdStructuredText: { type: String, default: '' },
    jdRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    parsedCvProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    parsedJdProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchingDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    macroScores: { type: [mongoose.Schema.Types.Mixed], default: [] },
    microScores: { type: [mongoose.Schema.Types.Mixed], default: [] },
    requirementChecks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    decision: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0 },
    explanation: { type: mongoose.Schema.Types.Mixed, default: {} },
    evidenceMap: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sourceSnapshots: { type: [mongoose.Schema.Types.Mixed], default: [] },
    retrievalSnapshots: { type: [mongoose.Schema.Types.Mixed], default: [] },
    reportArtifacts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    analysisStatus: { type: String, default: 'completed' },
    promptVersion: { type: String, default: 'v3' },
    redactionStatus: { type: String, default: 'not_redacted' },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    containsSensitiveData: { type: Boolean, default: true },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v3' },
  },
  { timestamps: true }
);

export const SessionAnalysis = mongoose.models.SessionAnalysis || mongoose.model('SessionAnalysis', SessionAnalysisSchema);
