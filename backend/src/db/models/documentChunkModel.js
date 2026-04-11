/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: documentChunkModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

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
