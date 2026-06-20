/**
 * File responsibility: MongoDB model for tracking DeepSeek API token usage.
 * Each document records one API call's token consumption and estimated cost.
 * Supports per-user and per-session aggregation.
 */

import mongoose from 'mongoose';
import { applyRuntimeRetentionIndex } from '../runtimeRetentionIndex.js';

const TokenUsageSchema = new mongoose.Schema(
  {
    userId:   { type: String, required: true, index: true },
    sessionId:{ type: String, default: null, index: true },
    action:   { type: String, required: true, enum: ['callDeepSeek', 'callDeepSeekJson'] },
    promptTokens:     { type: Number, required: true, min: 0 },
    completionTokens: { type: Number, required: true, min: 0 },
    estimatedCost:    { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

TokenUsageSchema.index({ userId: 1, createdAt: -1 });
TokenUsageSchema.index({ sessionId: 1, createdAt: -1 });
applyRuntimeRetentionIndex(TokenUsageSchema);

export const TokenUsage = mongoose.models.TokenUsage || mongoose.model('TokenUsage', TokenUsageSchema);
