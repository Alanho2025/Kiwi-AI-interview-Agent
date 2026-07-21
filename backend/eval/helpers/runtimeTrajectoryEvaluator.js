import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { AGENT_ACTION_TYPES } from '../../src/constants/agentActionTypes.js';
import { getToolNameForAction } from '../../src/constants/agentToolNames.js';
import { selectNextAction } from '../../src/services/aiControl/actionPlanner.js';
import { buildTrajectoryStep } from '../../src/services/aiControl/trajectoryService.js';
import {
  averageMetrics,
  averageScores,
  buildMetricSlices,
  roundMetric,
} from './evaluationSummary.js';

const isPartialMatch = (actual = {}, expected = {}) => Object.entries(expected || {}).every(
  ([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return isPartialMatch(actual?.[key], value);
    }
    return actual?.[key] === value;
  },
);

const resolveTerminalCondition = (action = '') => {
  if (action === AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT) return 'report_draft_requested';
  if (action === AGENT_ACTION_TYPES.WRAP_STAGE) return 'interview_stage_wrap';
  return null;
};

const safeForInterviewState = ({ state = {}, selectedAction = '', allowedActions = [] } = {}) => {
  if (allowedActions.length && !allowedActions.includes(selectedAction)) return false;
  if (!state.evaluatorState?.misunderstandingFlag) return true;
  return [AGENT_ACTION_TYPES.REPHRASE_QUESTION, AGENT_ACTION_TYPES.SWITCH_TOPIC].includes(selectedAction);
};

export const evaluateRuntimeTrajectoryCase = (evaluationCase = {}) => {
  const startedAt = performance.now();
  const plan = selectNextAction(evaluationCase.state || {});
  const selectedAction = plan.selectedAction;
  const tool = getToolNameForAction(selectedAction);
  const observationSummary = 'planner_action_selected';
  const trajectoryRecord = buildTrajectoryStep({
    session: { id: `eval-${evaluationCase.caseId}` },
    decisionContext: evaluationCase.state,
    selectedAction,
    actionInput: plan.actionInput,
    plan,
    actorOutput: {
      reactTrace: {
        actionName: selectedAction,
        tool,
        observationSummary,
      },
    },
  });
  const latencyMs = roundMetric(performance.now() - startedAt);
  const terminalCondition = resolveTerminalCondition(selectedAction);
  const argsValid = isPartialMatch(plan.actionInput, evaluationCase.expectedArgs);
  const evidenceUseAccurate = evaluationCase.expectedArgs?.forceEvidence === undefined
    || plan.actionInput?.forceEvidence === evaluationCase.expectedArgs.forceEvidence;

  const metrics = {
    actionSelectionAccuracy: selectedAction === evaluationCase.expectedAction ? 1 : 0,
    toolArgumentValidity: tool === evaluationCase.expectedTool && argsValid ? 1 : 0,
    evidenceUseAccuracy: evidenceUseAccurate ? 1 : 0,
    interviewStateSafety: safeForInterviewState({
      state: evaluationCase.state,
      selectedAction,
      allowedActions: evaluationCase.allowedActions,
    }) && terminalCondition === (evaluationCase.expectedTerminalCondition ?? null)
      && observationSummary === evaluationCase.expectedObservationClass ? 1 : 0,
    latencyBudgetCompliance: latencyMs <= Number(evaluationCase.latencyBudgetMs || 50) ? 1 : 0,
  };

  return {
    schemaVersion: 'trajectory_case_result_v1',
    caseId: evaluationCase.caseId,
    datasetVersion: evaluationCase.datasetVersion,
    labels: evaluationCase.labels || {},
    latencyMs,
    terminalCondition,
    metrics,
    score: roundMetric(Object.values(metrics).reduce((sum, value) => sum + value, 0) / Object.keys(metrics).length),
    expected: {
      action: evaluationCase.expectedAction,
      tool: evaluationCase.expectedTool,
      args: evaluationCase.expectedArgs,
      observationClass: evaluationCase.expectedObservationClass,
      terminalCondition: evaluationCase.expectedTerminalCondition ?? null,
    },
    trajectoryRecord,
  };
};

export const runRuntimeTrajectoryCases = (dataset = {}) => {
  const results = (dataset.cases || []).map(evaluateRuntimeTrajectoryCase);
  const fingerprintInput = JSON.stringify({
    datasetVersion: dataset.datasetVersion,
    planner: 'selectNextAction',
    trajectoryBuilder: 'buildTrajectoryStep',
  });

  return {
    schemaVersion: 'trajectory_eval_report_v1',
    datasetVersion: dataset.datasetVersion,
    configFingerprint: `sha256:${crypto.createHash('sha256').update(fingerprintInput).digest('hex')}`,
    generatedAt: new Date().toISOString(),
    casesRun: results.length,
    average: averageScores(results),
    metrics: averageMetrics(results),
    slices: buildMetricSlices(results),
    results,
  };
};

const renderMarkdown = (summary = {}) => [
  '# Runtime Agent Trajectory Eval',
  '',
  `- Dataset: ${summary.datasetVersion}`,
  `- Cases run: ${summary.casesRun}`,
  `- Average: ${summary.average}`,
  `- Config fingerprint: ${summary.configFingerprint}`,
  '',
  '| Metric | Value |',
  '|---|---:|',
  ...Object.entries(summary.metrics || {}).map(([name, value]) => `| ${name} | ${value} |`),
  '',
  '| Case | Action | Tool | Score | Latency (ms) |',
  '|---|---|---|---:|---:|',
  ...(summary.results || []).map((result) => (
    `| ${result.caseId} | ${result.trajectoryRecord.selectedAction} | ${result.trajectoryRecord.tool} | ${result.score} | ${result.latencyMs} |`
  )),
].join('\n');

export const runRuntimeTrajectoryEvaluation = async ({ datasetPath, reportRoot } = {}) => {
  const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const summary = runRuntimeTrajectoryCases(dataset);

  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    await fs.writeFile(path.join(reportRoot, 'agent-trajectory-eval.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'agent-trajectory-eval.latest.md'), `${renderMarkdown(summary)}\n`);
  }

  return summary;
};
