/**
 * File responsibility: Repository / data access module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: documentRepository should centralise data access queries so schema changes touch the fewest files possible.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { DocumentContent } from '../db/models/documentContentModel.js';

/**
 * Purpose: Execute the main responsibility for upsertDocumentContent.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const upsertDocumentContent = async ({
  fileId,
  sessionId = null,
  userId,
  documentType,
  rawText,
  normalizedText,
  redactedText = '',
}) =>
  DocumentContent.findOneAndUpdate(
    { fileId },
    {
      fileId,
      sessionId,
      userId,
      documentType,
      rawText,
      normalizedText,
      redactedText,
      parseStatus: 'completed',
      containsSensitiveData: true,
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

/**
 * Purpose: Execute the main responsibility for findDocumentsByFileIds.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const findDocumentsByFileIds = async (fileIds) =>
  DocumentContent.find({ fileId: { $in: fileIds } }).lean();

export const findDocumentByFileId = async (fileId) =>
  DocumentContent.findOne({ fileId }).lean();
