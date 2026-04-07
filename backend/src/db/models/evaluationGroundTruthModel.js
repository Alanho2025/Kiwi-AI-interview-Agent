import mongoose from 'mongoose';

const EvaluationGroundTruthSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const EvaluationGroundTruth = mongoose.models.EvaluationGroundTruth || mongoose.model('EvaluationGroundTruth', EvaluationGroundTruthSchema);
