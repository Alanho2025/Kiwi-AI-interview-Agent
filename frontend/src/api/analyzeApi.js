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
import { streamMatchCV } from './matchStreamApi.js';

/**
 * Purpose: Execute the main responsibility for paraphraseJD.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const paraphraseJD = ({ rawJD, companyWebsiteUrl, userCompanyContext }) => apiClient('/job-description/paraphrase', {
  method: 'POST',
  body: { rawJD, companyWebsiteUrl, userCompanyContext },
});
export const startCompanyValuesEnrichment = ({ rawJD, jdRubric, companyWebsiteUrl }) =>
  apiClient('/job-description/company-values/enrichment', {
    method: 'POST',
    body: { rawJD, jdRubric, companyWebsiteUrl },
  });
export const confirmRoleFitReview = ({ jdFingerprint, baseVersion, jdRubric }) =>
  apiClient(`/job-description/role-fit/reviews/${encodeURIComponent(jdFingerprint)}`, {
    method: 'PUT',
    body: { baseVersion, jdRubric },
  });
export const matchCV = (cvId, rawJD, jdRubric, settings) => apiClient('/analyze/match', { method: 'POST', body: { cvId, rawJD, jdRubric, settings } });

export const matchCVStream = ({ cvId, rawJD, jdRubric, settings, onEvent, signal, requestId }) => streamMatchCV({
  cvId,
  rawJD,
  jdRubric,
  settings,
  onEvent,
  signal,
  requestId,
});
export const generateInterviewPlan = (payload) => apiClient('/analyze/interview-plan', { method: 'POST', body: payload });
export const getSavedJDs = () => apiClient('/job-description/saved', { method: 'GET' });
