/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewPlanModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import mongoose from 'mongoose';

const QuestionPoolItemSchema = new mongoose.Schema(
  {
    type: String,
    text: String,
    reason: String,
    priority: Number,
    basedOnSkills: [String],
    stage: String,
    topic: String,
    followUpDepth: Number,
    sourceType: String,
    sourceId: String,
    roleCanonical: String,
    roleFamily: String,
  },
  { _id: false }
);

const InterviewPlanSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    settingsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    candidateName: { type: String, default: 'Candidate' },
    jobTitle: { type: String, default: '' },
    matchScore: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    decision: { type: mongoose.Schema.Types.Mixed, default: {} },
    requirementChecks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    explanation: { type: mongoose.Schema.Types.Mixed, default: {} },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
    interviewFocus: { type: [String], default: [] },
    planPreview: { type: String, default: '' },
    strategy: { type: mongoose.Schema.Types.Mixed, default: {} },
    questionPool: { type: [QuestionPoolItemSchema], default: [] },
    fallbackRules: { type: mongoose.Schema.Types.Mixed, default: {} },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    containsSensitiveData: { type: Boolean, default: true },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v3' },
  },
  { timestamps: true }
);

export const InterviewPlan = mongoose.models.InterviewPlan || mongoose.model('InterviewPlan', InterviewPlanSchema);
