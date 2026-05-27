import mongoose from 'mongoose';

const DAY_MS = 24 * 60 * 60 * 1000;

const JdArtifactCacheSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    jdHash: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    company: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    rawTextPreview: { type: String, default: '' },
    normalizedJdRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    universalRoleProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    requirements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    interviewTargets: { type: mongoose.Schema.Types.Mixed, default: {} },
    artifactMeta: {
      jdParserVersion: { type: String, default: 'v1' },
      rubricVersion: { type: String, default: 'v1' },
    },
    lastUsedAt: { type: Date, default: Date.now, index: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * DAY_MS),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

JdArtifactCacheSchema.index({ userId: 1, jdHash: 1 }, { unique: true });

export const JdArtifactCache = mongoose.models.JdArtifactCache || mongoose.model('JdArtifactCache', JdArtifactCacheSchema);
