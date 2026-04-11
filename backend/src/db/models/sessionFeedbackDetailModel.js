/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionFeedbackDetailModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import mongoose from 'mongoose';

const SessionFeedbackDetailSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    scores: { type: mongoose.Schema.Types.Mixed, default: {} },
    strengths: { type: [mongoose.Schema.Types.Mixed], default: [] },
    gaps: { type: [mongoose.Schema.Types.Mixed], default: [] },
    jobFitObservations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    improvementSuggestions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    modelMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    redactedFeedback: { type: mongoose.Schema.Types.Mixed, default: {} },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const SessionFeedbackDetail = mongoose.models.SessionFeedbackDetail || mongoose.model('SessionFeedbackDetail', SessionFeedbackDetailSchema);
