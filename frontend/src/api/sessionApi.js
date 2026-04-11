/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: sessionApi should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { apiClient } from './client.js';

/**
 * Purpose: Execute the main responsibility for saveSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const saveSession = (sessionId, data) => apiClient('/session/save', { method: 'POST', body: { sessionId, data } });
export const getSession = (sessionId) => apiClient(`/session/${sessionId}`);
export const getSessionHistory = (limit = 20) => apiClient(`/session/history?limit=${limit}`);
/**
 * Purpose: Execute the main responsibility for deleteSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const deleteSession = (sessionId) => apiClient(`/session/${sessionId}`, { method: 'DELETE' });
/**
 * Purpose: Execute the main responsibility for resumeSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const resumeSession = (sessionId) => apiClient('/session/resume', { method: 'POST', body: { sessionId } });
