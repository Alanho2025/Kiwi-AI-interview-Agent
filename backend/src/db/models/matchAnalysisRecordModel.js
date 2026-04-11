import mongoose from 'mongoose';

const MatchAnalysisRecordSchema = new mongoose.Schema(
  {
    matchAnalysisId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    cvFileId: { type: String, required: true, index: true },
    jdStructuredText: { type: String, default: '' },
    jdRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchAnalysis: { type: mongoose.Schema.Types.Mixed, default: {} },
    evidenceRefs: { type: [mongoose.Schema.Types.Mixed], default: [] },
    warnings: { type: [String], default: [] },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    containsSensitiveData: { type: Boolean, default: true },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const MatchAnalysisRecord = mongoose.models.MatchAnalysisRecord || mongoose.model('MatchAnalysisRecord', MatchAnalysisRecordSchema);
