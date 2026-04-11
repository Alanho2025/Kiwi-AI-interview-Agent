/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: ragBenchmarkCaseModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import mongoose from 'mongoose';

const RagBenchmarkCaseSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    label: { type: String, default: '' },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    parsedCvProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    jdRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    groundTruth: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const RagBenchmarkCase = mongoose.models.RagBenchmarkCase || mongoose.model('RagBenchmarkCase', RagBenchmarkCaseSchema);
