import mongoose from 'mongoose';

export const USAGE_ROLLUP_SOURCES = ['ai_usage_event', 'token_usage'];

const UsageDailyRollupSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    source: { type: String, required: true, enum: USAGE_ROLLUP_SOURCES },
    day: { type: Date, required: true },
    summary: { type: mongoose.Schema.Types.Mixed, required: true },
    providerTotals: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sessionIds: { type: [String], default: [] },
    sourceEventIds: { type: [String], default: [] },
    sourceEventCount: { type: Number, required: true, min: 0 },
    sourceChecksum: { type: String, required: true },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UsageDailyRollupSchema.index({ userId: 1, source: 1, day: 1 }, { unique: true });
UsageDailyRollupSchema.index({ source: 1, day: 1 });

export const UsageDailyRollup = mongoose.models.UsageDailyRollup
  || mongoose.model('UsageDailyRollup', UsageDailyRollupSchema);
