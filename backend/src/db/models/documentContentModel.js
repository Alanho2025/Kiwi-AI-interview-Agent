import mongoose from 'mongoose';

const DocumentContentSchema = new mongoose.Schema(
  {
    fileId: { type: String, unique: true, index: true },
    sessionId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    documentType: { type: String, required: true },
    rawText: { type: String, default: '' },
    normalizedText: { type: String, default: '' },
    parseStatus: { type: String, default: 'completed' },
    parserVersion: { type: String, default: 'v1' },
    redactedText: { type: String, default: '' },
    containsSensitiveData: { type: Boolean, default: true },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const DocumentContent = mongoose.models.DocumentContent || mongoose.model('DocumentContent', DocumentContentSchema);
