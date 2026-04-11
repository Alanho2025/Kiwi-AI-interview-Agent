/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: retrievalAgent should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { retrieveEvidenceBundle } from '../ragRetrievalService.js';

/**
 * Purpose: Execute the main responsibility for runRetrievalAgent.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const runRetrievalAgent = async ({ query, sessionId = null, sourceTypes = [], topK = 5 } = {}) =>
  retrieveEvidenceBundle({ query, sessionId, sourceTypes, topK });
