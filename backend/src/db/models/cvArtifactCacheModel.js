import mongoose from 'mongoose';

const DAY_MS = 24 * 60 * 60 * 1000;

const CvArtifactCacheSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    cvHash: { type: String, required: true, index: true },
    parsedCvProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    cvEvidenceProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    cvAnalysis: { type: mongoose.Schema.Types.Mixed, default: {} },
    artifactMeta: {
      parserVersion: { type: String, default: 'v1' },
      evidenceProfileVersion: { type: String, default: 'v1' },
    },
    lastUsedAt: { type: Date, default: Date.now, index: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * DAY_MS),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

CvArtifactCacheSchema.index({ userId: 1, cvHash: 1 }, { unique: true });

export const CvArtifactCache = mongoose.models.CvArtifactCache || mongoose.model('CvArtifactCache', CvArtifactCacheSchema);
