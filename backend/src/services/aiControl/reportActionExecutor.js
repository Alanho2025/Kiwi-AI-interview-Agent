import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';
import { runReportQaRepairLoop } from '../report/reportQaRepairOrchestratorService.js';

export const executeReportAction = async ({
  selectedAction,
  decisionContext,
  agentRegistry,
  session,
  retrievalBundle = null,
} = {}) => {
  if (selectedAction !== AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT) {
    return {
      report: null,
      qaResult: null,
      repairHistory: [],
      isComplete: true,
      completedBecause: 'no_viable_action',
    };
  }

  const initialReport = await agentRegistry.reportGenerator({
    session,
    analysisResult: session.analysisResult || {},
    interviewPlan: session.interviewPlan || {},
    retrievalBundle,
    evidenceBundle: decisionContext?.evidenceBundle,
    decisionContext,
  });

  const initialQaResult = await agentRegistry.reportQa({
    report: initialReport,
    analysisResult: session.analysisResult || {},
    retrievalBundle,
  });

  const repairResult = await runReportQaRepairLoop({
    report: initialReport,
    qaResult: initialQaResult,
    session,
    retrievalBundle,
    maxAttempts: 2,
    agentRegistry,
  });

  return { 
    report: repairResult.report, 
    qaResult: repairResult.qaResult, 
    repairHistory: repairResult.repairHistory || [],
    tools: [AGENT_TOOL_NAMES.DRAFT_INTERVIEW_REPORT, AGENT_TOOL_NAMES.REVIEW_REPORT_QUALITY], 
    isComplete: true, 
    completedBecause: repairResult.qaResult?.passed ? 'report_generated_and_qa_passed' : 'report_generated_needs_review',
  };
};
