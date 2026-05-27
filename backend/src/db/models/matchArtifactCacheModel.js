import mongoose from 'mongoose';

const DAY_MS = 24 * 60 * 60 * 1000;

const MatchArtifactCacheSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    cvHash: { type: String, required: true, index: true },
    jdHash: { type: String, required: true, index: true },
    settingsHash: { type: String, required: true, index: true },
    matchResult: { type: mongoose.Schema.Types.Mixed, default: {} },
    cacheMeta: {
      matchEngine: { type: String, default: 'default' },
      source: { type: String, default: 'cv_jd_match' },
      ttlDays: { type: Number, default: 7 },
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

MatchArtifactCacheSchema.index({ userId: 1, cvHash: 1, jdHash: 1, settingsHash: 1 });

export const MatchArtifactCache = mongoose.models.MatchArtifactCache || mongoose.model('MatchArtifactCache', MatchArtifactCacheSchema);
