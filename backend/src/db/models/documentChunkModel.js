import mongoose from 'mongoose';

const DocumentChunkSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true, unique: true, index: true },
    sourceType: { type: String, required: true, index: true },
    sourceId: { type: String, required: true, index: true },
    documentType: { type: String, required: true, index: true },
    sessionId: { type: String, index: true },
    userId: { type: String, index: true },
    text: { type: String, required: true },
    normalizedText: { type: String, default: '' },
    embedding: { type: [Number], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const DocumentChunk = mongoose.models.DocumentChunk || mongoose.model('DocumentChunk', DocumentChunkSchema);
