/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewApi should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { apiClient } from './client.js';

/**
 * Purpose: Execute the main responsibility for startInterview.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const startInterview = (sessionId) => apiClient('/interview/start', { method: 'POST', body: { sessionId } });
export const replyInterview = (sessionId, answer) => apiClient('/interview/reply', { method: 'POST', body: { sessionId, answer } });
export const repeatQuestion = (sessionId) => apiClient('/interview/repeat', { method: 'POST', body: { sessionId } });
/**
 * Purpose: Execute the main responsibility for pauseInterview.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const pauseInterview = (sessionId) => apiClient('/interview/pause', { method: 'POST', body: { sessionId } });
export const resumeInterview = (sessionId) => apiClient('/interview/resume', { method: 'POST', body: { sessionId } });
export const endInterview = (sessionId) => apiClient('/interview/end', { method: 'POST', body: { sessionId } });
