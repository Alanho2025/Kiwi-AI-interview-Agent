/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export {
  createSession,
  getSessionById,
  getOwnedSessionById,
  listSessionsByUserId,
  updateSession,
  softDeleteOwnedSession,
} from './session/sessionLifecycleService.js';

export { appendTranscriptTurn } from './session/sessionTranscriptService.js';

export {
  createInterviewQuestion,
  getLatestQuestionForSession,
  createInterviewResponse,
} from './session/sessionQuestionService.js';
