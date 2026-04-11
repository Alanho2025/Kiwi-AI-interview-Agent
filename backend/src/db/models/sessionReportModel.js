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
    latestStatus: { type: String, default: 'draft' },
  },
  { timestamps: true }
);

export const SessionReport = mongoose.models.SessionReport || mongoose.model('SessionReport', SessionReportSchema);
