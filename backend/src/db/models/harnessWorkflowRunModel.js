import mongoose from 'mongoose';

const HarnessWorkflowRunSchema = new mongoose.Schema(
  {
    workflowRunId: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, required: true, index: true },
    taskType: { type: String, required: true, index: true },
    executionMode: { type: String, required: true, enum: ['shadow', 'observe'], default: 'shadow' },
    ownerUserId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    clientTurnId: { type: String, default: null },
    channel: { type: String, required: true, enum: ['text', 'voice'] },
    lifecycleStatus: {
      type: String,
      required: true,
      enum: ['running', 'waiting', 'completed', 'failed'],
    },
    qualityStatus: { type: String, required: true, enum: ['pending', 'valid', 'invalid', 'passed', 'warn', 'degraded', 'blocked', 'needs_review'] },
    publicationStatus: { type: String, required: true, enum: ['not_applicable', 'draft', 'ready', 'ready_after_repair', 'needs_review', 'rejected', 'published'] },
    taskContract: { type: mongoose.Schema.Types.Mixed, default: {} },
    contextPackets: { type: [mongoose.Schema.Types.Mixed], default: [] },
    actionContracts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    gateResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    memoryWrites: { type: [mongoose.Schema.Types.Mixed], default: [] },
    failures: { type: [mongoose.Schema.Types.Mixed], default: [] },
    stateRefs: { type: mongoose.Schema.Types.Mixed, default: {} },
    contextPacketRefs: { type: [String], default: [] },
    actionContractRefs: { type: [String], default: [] },
    gateResultRefs: { type: [String], default: [] },
    memoryWriteRefs: { type: [String], default: [] },
    failureRefs: { type: [String], default: [] },
    resultRefs: { type: [String], default: [] },
    timeline: { type: [mongoose.Schema.Types.Mixed], default: [] },
    correlation: { type: mongoose.Schema.Types.Mixed, default: {} },
    latency: { type: mongoose.Schema.Types.Mixed, default: {} },
    privacy: { type: mongoose.Schema.Types.Mixed, default: {} },
    executionControls: { type: mongoose.Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, required: true, index: true },
    completedAt: { type: Date, default: null },
    retentionUntil: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
    containsSensitiveData: { type: Boolean, default: true },
    accessScope: { type: String, default: 'developer_private' },
    schemaVersion: { type: String, default: 'workflow_run_v0' },
  },
  { timestamps: true }
);

HarnessWorkflowRunSchema.index({ ownerUserId: 1, startedAt: -1 });
HarnessWorkflowRunSchema.index({ ownerUserId: 1, sessionId: 1, startedAt: -1 });
HarnessWorkflowRunSchema.index(
  { ownerUserId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

export const HarnessWorkflowRun = mongoose.models.HarnessWorkflowRun
  || mongoose.model('HarnessWorkflowRun', HarnessWorkflowRunSchema);
