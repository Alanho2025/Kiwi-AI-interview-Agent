import mongoose from 'mongoose';

const NormalizedJdRubricSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    rubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const NormalizedJdRubric = mongoose.models.NormalizedJdRubric || mongoose.model('NormalizedJdRubric', NormalizedJdRubricSchema);
