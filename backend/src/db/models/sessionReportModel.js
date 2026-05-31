/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionReportModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import mongoose from 'mongoose';

const SessionReportSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    report: { type: mongoose.Schema.Types.Mixed, default: {} },
    qaResult: { type: mongoose.Schema.Types.Mixed, default: {} },
    latestStatus: {
      type: String,
      enum: ['draft', 'ready', 'ready_after_repair', 'needs_review', 'repair_failed'],
      default: 'draft',
    },
    reportVersions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    repairHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
    qaAttemptCount: { type: Number, default: 0 },
    scoreExplanations: { type: mongoose.Schema.Types.Mixed, default: null },
    trustSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    calibrationStatus: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export const SessionReport = mongoose.models.SessionReport || mongoose.model('SessionReport', SessionReportSchema);
