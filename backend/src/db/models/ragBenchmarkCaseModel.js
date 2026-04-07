import mongoose from 'mongoose';

const RagBenchmarkCaseSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    label: { type: String, default: '' },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    parsedCvProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    jdRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    groundTruth: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const RagBenchmarkCase = mongoose.models.RagBenchmarkCase || mongoose.model('RagBenchmarkCase', RagBenchmarkCaseSchema);
