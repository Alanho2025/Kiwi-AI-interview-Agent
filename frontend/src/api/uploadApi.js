/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: uploadApi should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { apiClient } from './client.js';

/**
 * Purpose: Execute the main responsibility for uploadCV.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const uploadCV = (file) => {
  const formData = new FormData();
  formData.append('cv', file);
  return apiClient('/upload/cv', { method: 'POST', body: formData });
};

/**
 * Purpose: Execute the main responsibility for getRecentCVs.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getRecentCVs = () => apiClient('/upload/recent-cvs');
export const selectCV = (cvId) => apiClient('/upload/select-cv', { method: 'POST', body: { cvId } });

export const rebuildCvProfile = (cvId) => apiClient(`/upload/cv/${cvId}/rebuild-profile`, { method: 'POST' });
export const deleteCv = (cvId) => apiClient(`/upload/cv/${cvId}`, { method: 'DELETE' });
export const exportCv = (cvId) => apiClient(`/upload/cv/${cvId}/export`);
