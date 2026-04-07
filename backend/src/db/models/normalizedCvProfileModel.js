import mongoose from 'mongoose';

const NormalizedCvProfileSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    candidateName: { type: String, default: '' },
    profile: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const NormalizedCvProfile = mongoose.models.NormalizedCvProfile || mongoose.model('NormalizedCvProfile', NormalizedCvProfileSchema);
