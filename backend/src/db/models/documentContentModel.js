/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: documentContentModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

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
    parseWarnings: { type: [String], default: [] },
    parseConfidence: { type: Number, default: 0.5 },
    extractedSections: { type: [Object], default: [] },
    redactedText: { type: String, default: '' },
    cvProfile: { type: Object, default: null },
    cvProfileVersion: { type: String, default: 'cv_profile_v1' },
    displayProfile: { type: Object, default: null },
    containsSensitiveData: { type: Boolean, default: true },
    retentionUntil: { type: Date },
    deletedAt: { type: Date },
    accessScope: { type: String, default: 'private' },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const DocumentContent = mongoose.models.DocumentContent || mongoose.model('DocumentContent', DocumentContentSchema);
