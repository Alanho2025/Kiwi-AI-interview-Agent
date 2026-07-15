import { BLOCKING_REPORT_FLAGS } from '../agents/reportQaAgent.js';
import { buildObservedGateResult } from './harnessObservedContractPolicy.js';

export const REPORT_PUBLICATION_POLICY_VERSION = 'report_publication_v0';

const isTraceableRepairAttempt = (attempt = {}) => (
  Number.isInteger(Number(attempt.attempt))
  && Number(attempt.attempt) > 0
  && ['repaired', 'repair_failed'].includes(attempt.status)
);

export const buildReportPublicationDecision = ({
  workflowRunId,
  executionMode = 'shadow',
  qaResult = {},
  repairHistory = [],
  evaluatedAt = new Date().toISOString(),
} = {}) => {
  const qualityFlags = Array.isArray(qaResult.qualityFlags) ? qaResult.qualityFlags : [];
  const blockingFlags = qualityFlags.filter((flag) => BLOCKING_REPORT_FLAGS.has(flag));
  const passed = qaResult.passed === true;
  const blocked = !passed && blockingFlags.length > 0;
  const repairAttemptCount = Array.isArray(repairHistory) ? repairHistory.length : 0;
  const explicitRepairActionCount = Array.isArray(repairHistory)
    ? repairHistory.filter(isTraceableRepairAttempt).length
    : 0;
  const explicitRepairActionsComplete = explicitRepairActionCount === repairAttemptCount;
  const status = passed ? 'pass' : blocked ? 'block' : 'review';
  const publicationStatus = passed
    ? repairAttemptCount > 0 ? 'ready_after_repair' : 'ready'
    : 'needs_review';
  const reasonCodes = passed
    ? [repairAttemptCount > 0 ? 'report_qa_passed_after_traced_repair_action' : 'report_qa_passed']
    : blockingFlags.length ? blockingFlags : ['report_qa_review_required'];

  return {
    policyVersion: REPORT_PUBLICATION_POLICY_VERSION,
    qualityStatus: passed ? 'passed' : blocked ? 'blocked' : 'needs_review',
    publicationStatus,
    humanReviewRequired: !passed,
    blockingFlags,
    repairLineage: {
      attemptCount: repairAttemptCount,
      legacyInlineRepairObserved: repairAttemptCount > 0,
      explicitRepairActionCount,
      explicitRepairActionsComplete,
      explicitRepairLineageComplete: explicitRepairActionsComplete,
      explicitChildRunsComplete: false,
    },
    gateResult: buildObservedGateResult({
      gateResultId: `gate:${workflowRunId}:report_publication_allowed`,
      workflowRunId,
      gateType: 'report_publication_allowed',
      executionMode,
      evaluatedAt,
      evaluatorRef: 'report_qa_policy_adapter',
      subjectRef: `session_report:${workflowRunId}`,
      status,
      reasonCodes,
      blockingScope: blocked ? 'publication' : 'none',
      humanReadableSummary: passed
        ? 'The report passed the observed publication checks.'
        : 'The report requires review before verified publication.',
      nextStep: passed
        ? { type: 'publish', ref: null }
        : { type: 'wait_for_review', ref: null },
      humanReviewRef: passed ? null : `report_review:${workflowRunId}`,
      enforced: false,
      enforcementSource: 'harness_observe_only',
    }),
  };
};
