/**
 * File responsibility: MongoDB model for stage-level AI usage and execution cost events.
 */

import mongoose from 'mongoose';

export const AI_USAGE_PROVIDERS = ['deepseek', 'azure_speech', 'elevenlabs', 'local'];
export const AI_USAGE_MODALITIES = ['llm', 'speech', 'local'];
export const AI_USAGE_STAGES = ['cv_parse', 'jd_parse', 'cv_jd_match', 'interview', 'report_generated', 'report_qa'];
export const AI_USAGE_OPERATIONS = ['llm_chat', 'llm_json', 'speech_to_text', 'text_to_speech', 'local_parse', 'local_match'];

const AiUsageEventSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, default: null, index: true },
    provider: { type: String, required: true, enum: AI_USAGE_PROVIDERS },
    modality: { type: String, required: true, enum: AI_USAGE_MODALITIES },
    stage: { type: String, required: true, enum: AI_USAGE_STAGES },
    operation: { type: String, required: true, enum: AI_USAGE_OPERATIONS },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    estimatedCost: { type: Number, required: true, min: 0, default: 0 },
    pricingVersion: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AiUsageEventSchema.index({ userId: 1, createdAt: -1 });
AiUsageEventSchema.index({ userId: 1, sessionId: 1, createdAt: -1 });
AiUsageEventSchema.index({ userId: 1, sessionId: 1, stage: 1 });

export const AiUsageEvent = mongoose.models.AiUsageEvent || mongoose.model('AiUsageEvent', AiUsageEventSchema);
