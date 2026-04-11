/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: analyzeApi should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { apiClient } from './client.js';

/**
 * Purpose: Execute the main responsibility for paraphraseJD.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const paraphraseJD = (rawJD) => apiClient('/job-description/paraphrase', { method: 'POST', body: { rawJD } });
export const matchCV = (cvText, rawJD, jdRubric, settings) => apiClient('/analyze/match', { method: 'POST', body: { cvText, rawJD, jdRubric, settings } });
export const generateInterviewPlan = (payload) => apiClient('/analyze/interview-plan', { method: 'POST', body: payload });
