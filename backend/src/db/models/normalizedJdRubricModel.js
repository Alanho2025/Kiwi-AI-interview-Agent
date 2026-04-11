/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: normalizedJdRubricModel should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import mongoose from 'mongoose';

const NormalizedJdRubricSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    rubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: 'v1' },
  },
  { timestamps: true }
);

export const NormalizedJdRubric = mongoose.models.NormalizedJdRubric || mongoose.model('NormalizedJdRubric', NormalizedJdRubricSchema);
