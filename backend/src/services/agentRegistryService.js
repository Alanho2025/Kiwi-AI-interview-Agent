/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: agentRegistryService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { runRetrievalAgent } from './agents/retrievalAgent.js';
import { runInterviewerAgent } from './agents/interviewerAgent.js';
import { runReportGeneratorAgent } from './agents/reportGeneratorAgent.js';
import { runReportQaAgent } from './agents/reportQaAgent.js';

export const agentRegistry = {
  retrieval: runRetrievalAgent,
  interviewer: runInterviewerAgent,
  reportGenerator: runReportGeneratorAgent,
  reportQa: runReportQaAgent,
};
