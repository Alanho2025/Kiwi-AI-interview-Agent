import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

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
      isComplete: true,
      completedBecause: 'no_viable_action',
    };
  }

  const report = await agentRegistry.reportGenerator({
    session,
    analysisResult: session.analysisResult || {},
    interviewPlan: session.interviewPlan || {},
    retrievalBundle,
    evidenceBundle: decisionContext?.evidenceBundle,
    decisionContext,
  });

  const qaResult = await agentRegistry.reportQa({
    report,
    analysisResult: session.analysisResult || {},
    retrievalBundle,
  });

  return { report, qaResult, tools: [AGENT_TOOL_NAMES.DRAFT_INTERVIEW_REPORT, AGENT_TOOL_NAMES.REVIEW_REPORT_QUALITY], isComplete: true, completedBecause: 'report_generated' };
};
