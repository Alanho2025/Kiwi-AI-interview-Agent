import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { AGENT_TOOL_NAMES } from '../../../src/constants/agentToolNames.js';
import {
  evaluateRuntimeTrajectoryCase,
  runRuntimeTrajectoryCases,
} from '../../../eval/helpers/runtimeTrajectoryEvaluator.js';

const probingCase = {
  schemaVersion: 'trajectory_case_v1',
  caseId: 'vague_answer_requires_evidence_probe',
  datasetVersion: 'role-fit-trajectory-v1',
  state: {
    taskType: 'interview_next_turn',
    currentStage: 'technical_core',
    currentTopic: 'backend_project',
    candidateState: { specificityLevel: 'low' },
    coverageState: { missingTopics: ['system_design'], coveredTopics: [], weakAreas: ['backend_project'] },
    matchState: { validationTargets: [] },
  },
  allowedActions: [AGENT_ACTION_TYPES.ASK_PROBING_QUESTION],
  expectedAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
  expectedTool: AGENT_TOOL_NAMES.GENERATE_INTERVIEW_QUESTION,
  expectedArgs: { targetTopic: 'backend_project', forceEvidence: true },
  expectedObservationClass: 'planner_action_selected',
  expectedTerminalCondition: null,
  latencyBudgetMs: 50,
  labels: { domain: 'interview', risk: 'high' },
};

describe('runtime agent trajectory evaluation', () => {
  it('executes the production action planner and records its real tool and args', () => {
    const result = evaluateRuntimeTrajectoryCase(probingCase);

    expect(result.trajectoryRecord).toMatchObject({
      selectedAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      chosenAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      tool: AGENT_TOOL_NAMES.GENERATE_INTERVIEW_QUESTION,
      actionInput: { targetTopic: 'backend_project', forceEvidence: true },
      observationSummary: 'planner_action_selected',
    });
    expect(result.metrics).toEqual({
      actionSelectionAccuracy: 1,
      toolArgumentValidity: 1,
      evidenceUseAccuracy: 1,
      interviewStateSafety: 1,
      latencyBudgetCompliance: 1,
    });
  });

  it('captures safe misunderstanding recovery instead of advancing the interview state', () => {
    const result = evaluateRuntimeTrajectoryCase({
      ...probingCase,
      caseId: 'misunderstanding_rephrase',
      state: {
        taskType: 'interview_next_turn',
        currentStage: 'technical_core',
        currentTopic: 'system_design',
        candidateState: { specificityLevel: 'medium' },
        evaluatorState: { misunderstandingFlag: true, suggestedNextMode: 'rephrase', currentTopic: 'system_design' },
        coverageState: { missingTopics: ['system_design'], coveredTopics: [], weakAreas: [] },
        matchState: { validationTargets: [] },
      },
      allowedActions: [AGENT_ACTION_TYPES.REPHRASE_QUESTION],
      expectedAction: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      expectedArgs: { targetTopic: 'system_design', probeType: 'rephrase' },
    });

    expect(result.trajectoryRecord.selectedAction).toBe(AGENT_ACTION_TYPES.REPHRASE_QUESTION);
    expect(result.metrics.interviewStateSafety).toBe(1);
    expect(result.terminalCondition).toBeNull();
  });

  it('persists dataset, config, slice, and aggregate metrics for every case', () => {
    const summary = runRuntimeTrajectoryCases({
      schemaVersion: 'trajectory_dataset_v1',
      datasetVersion: 'role-fit-trajectory-v1',
      cases: [probingCase],
    });

    expect(summary).toMatchObject({
      schemaVersion: 'trajectory_eval_report_v1',
      datasetVersion: 'role-fit-trajectory-v1',
      casesRun: 1,
      slices: {
        'domain:interview': { casesRun: 1 },
        'risk:high': { casesRun: 1 },
      },
    });
    expect(summary.configFingerprint).toMatch(/^sha256:/);
    expect(summary.results[0].trajectoryRecord.trajectoryId).toEqual(expect.any(String));
  });
});
