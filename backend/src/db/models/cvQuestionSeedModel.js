import mongoose from 'mongoose';

const CvQuestionSeedSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    cvFileId: { type: String, required: true, index: true },
    seedId: { type: String, required: true, unique: true, index: true },
    schemaVersion: { type: String, default: 'v1' },
    sourceStage: { type: String, default: 'cv_parse' },
    sourceType: { type: String, default: '' },
    topic: { type: String, default: '' },
    category: { type: String, default: '' },
    competency: { type: String, default: '' },
    questionIntent: { type: String, default: '' },
    draftQuestion: { type: String, default: '' },
    fallbackText: { type: String, default: '' },
    evidenceRefs: { type: [mongoose.Schema.Types.Mixed], default: [] },
    evidenceSummary: { type: String, default: '' },
    expectedSignal: { type: [String], default: [] },
    riskTags: { type: [String], default: [] },
    skillTags: { type: [String], default: [] },
    projectTags: { type: [String], default: [] },
    priorityWeight: { type: Number, default: 0.5 },
    confidence: { type: Number, default: 0.5 },
    status: { type: String, default: 'active', index: true },
    generationMethod: { type: String, default: 'deterministic' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    retentionUntil: { type: Date },
  },
  { timestamps: true }
);

CvQuestionSeedSchema.index({ userId: 1, cvFileId: 1 });
CvQuestionSeedSchema.index({ userId: 1, cvFileId: 1, status: 1 });
CvQuestionSeedSchema.index({ retentionUntil: 1 });

export const CvQuestionSeed = mongoose.models.CvQuestionSeed || mongoose.model('CvQuestionSeed', CvQuestionSeedSchema);
