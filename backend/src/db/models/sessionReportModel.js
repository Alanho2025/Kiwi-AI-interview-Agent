import mongoose from 'mongoose';

const SessionReportSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    report: { type: mongoose.Schema.Types.Mixed, default: {} },
    qaResult: { type: mongoose.Schema.Types.Mixed, default: {} },
    latestStatus: { type: String, default: 'draft' },
  },
  { timestamps: true }
);

export const SessionReport = mongoose.models.SessionReport || mongoose.model('SessionReport', SessionReportSchema);
