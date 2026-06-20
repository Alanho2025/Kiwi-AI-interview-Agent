import mongoose from 'mongoose';
import { applyRuntimeRetentionIndex } from '../runtimeRetentionIndex.js';

const InterviewQuestionPoolItemSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    matchAnalysisId: { type: String, default: null },
    cvFileId: { type: String, default: null },
    jdFingerprint: { type: String, default: '' },
    questionId: { type: String, required: true, unique: true, index: true },
    schemaVersion: { type: String, default: 'v1' },
    sourceStage: { type: String, default: '' },
    sourceSeedId: { type: String, default: '' },
    questionRole: { type: String, enum: ['root_question', 'fallback_root', 'wrap_up'], default: 'root_question', index: true },
    maxFollowUps: { type: Number, default: 2 },
    followUpStrategies: { type: [String], default: [] },
    sourceType: { type: String, default: '' },
    category: { type: String, default: '', index: true },
    stage: { type: String, default: '' },
    topic: { type: String, default: '', index: true },
    competency: { type: String, default: '' },
    questionIntent: { type: String, default: '' },
    text: { type: String, default: '' },
    fallbackText: { type: String, default: '' },
    spokenDraft: { type: String, default: '' },
    linkedCvEvidence: { type: [mongoose.Schema.Types.Mixed], default: [] },
    linkedJdRequirement: { type: [mongoose.Schema.Types.Mixed], default: [] },
    matchGapId: { type: String, default: '' },
    requirementId: { type: String, default: '' },
    cultureFitDimension: { type: String, default: '' },
    expectedSignal: { type: [String], default: [] },
    evidenceNeed: { type: [String], default: [] },
    followUpStrategy: { type: String, default: '' },
    constraints: { type: [String], default: [] },
    priorityWeight: { type: Number, default: 0.5 },
    coverageWeight: { type: Number, default: 0.5 },
    riskWeight: { type: Number, default: 0.5 },
    modeCompatibility: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'active', index: true },
    askedAt: { type: Date },
    askedTurnIndex: { type: Number },
    lastRankScore: { type: Number },
    rankTrace: { type: mongoose.Schema.Types.Mixed, default: {} },
    generationMethod: { type: String, default: 'deterministic' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    retentionUntil: { type: Date },
  },
  { timestamps: true }
);

InterviewQuestionPoolItemSchema.index({ sessionId: 1, status: 1 });
InterviewQuestionPoolItemSchema.index({ sessionId: 1, category: 1, status: 1 });
InterviewQuestionPoolItemSchema.index({ sessionId: 1, topic: 1 });
InterviewQuestionPoolItemSchema.index({ matchAnalysisId: 1 });
applyRuntimeRetentionIndex(InterviewQuestionPoolItemSchema);

export const InterviewQuestionPoolItem = mongoose.models.InterviewQuestionPoolItem || mongoose.model('InterviewQuestionPoolItem', InterviewQuestionPoolItemSchema);
