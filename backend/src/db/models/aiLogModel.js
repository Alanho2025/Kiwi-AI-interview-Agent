/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: aiLogModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import mongoose from 'mongoose';

const AiLogSchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true },
    userId: { type: String, index: true },
    stage: { type: String, required: true, index: true },
    status: { type: String, required: true },
    inputPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    errorMessage: { type: String, default: '' },
    traceId: { type: String, default: '' },
    containsPromptData: { type: Boolean, default: false },
    containsUserData: { type: Boolean, default: true },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

AiLogSchema.index({ sessionId: 1, stage: 1, createdAt: -1 });

export const AiLog = mongoose.models.AiLog || mongoose.model('AiLog', AiLogSchema);
