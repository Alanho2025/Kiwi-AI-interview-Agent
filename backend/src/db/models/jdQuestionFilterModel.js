import mongoose from 'mongoose';

const JdQuestionFilterSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    jdFingerprint: { type: String, default: '', index: true },
    matchAnalysisId: { type: String, default: null },
    schemaVersion: { type: String, default: 'v1' },
    roleCanonical: { type: String, default: '' },
    roleFamily: { type: String, default: '' },
    roleLevel: { type: String, default: '' },
    companyName: { type: String, default: '' },
    mustHaveRequirements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    prioritySkills: { type: [String], default: [] },
    behaviouralFocus: { type: [String], default: [] },
    companyValues: { type: [String], default: [] },
    cultureFitDimensions: { type: [String], default: [] },
    boostedSeedIds: { type: [String], default: [] },
    suppressedSeedIds: { type: [String], default: [] },
    adaptedSeedIds: { type: [String], default: [] },
    filterDecisions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    retentionUntil: { type: Date, index: true },
  },
  { timestamps: true }
);

JdQuestionFilterSchema.index({ userId: 1, jdFingerprint: 1 });
JdQuestionFilterSchema.index({ matchAnalysisId: 1 });

export const JdQuestionFilter = mongoose.models.JdQuestionFilter || mongoose.model('JdQuestionFilter', JdQuestionFilterSchema);
