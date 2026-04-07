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
