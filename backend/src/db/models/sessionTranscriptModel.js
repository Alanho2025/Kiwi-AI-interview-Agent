import mongoose from 'mongoose';

const TranscriptTurnSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, required: true },
    questionId: { type: String },
    source: { type: String, default: 'app' },
    durationSeconds: { type: Number },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const SessionTranscriptSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    turns: { type: [TranscriptTurnSchema], default: [] },
    fullTranscript: { type: String, default: '' },
    redactedTranscript: { type: String, default: '' },
    lastTurnOrder: { type: Number, default: 0 },
    containsSensitiveData: { type: Boolean, default: true },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    encryptionMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    accessScope: { type: String, default: 'private' },
    redactionStatus: { type: String, default: 'not_redacted' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const SessionTranscript = mongoose.models.SessionTranscript || mongoose.model('SessionTranscript', SessionTranscriptSchema);
