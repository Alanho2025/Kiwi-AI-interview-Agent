import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectNextAction } from '../../src/services/aiControl/actionPlanner.js';
import { evaluateInterviewTurn } from '../../src/services/aiControl/interviewEvaluatorService.js';
import { buildUserInterviewMemoryProjection } from '../../src/services/aiControl/userInterviewMemoryService.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceRoot = path.resolve(backendRoot, '../docs/harness/evidence');
const now = new Date('2026-07-15T12:00:00.000Z');

const buildAnalysis = ({
  sessionId,
  topic,
  roleKey = 'backend_engineer',
  score = 0.82,
  specificity = 'high',
  createdAt = '2026-07-10T12:00:00.000Z',
} = {}) => ({
  sessionId,
  matchingDetails: { questionPlanHints: { roleCanonical: roleKey } },
  trajectoryRecords: [{
    trajectoryId: `trajectory:${sessionId}:${topic}`,
    workflowRunId: `run:${sessionId}:${topic}`,
    createdAt,
    targetTopic: topic,
    selectedAction: 'ASK_DEEP_DIVE_QUESTION',
    actionInput: { probeType: 'deepen' },
    evaluator: { evidenceGainScore: score, specificity },
  }],
});

const buildContext = ({ topic, gap, projection }) => ({
  taskType: 'interview_next_turn',
  currentStage: 'technical_core',
  currentTopic: topic,
  candidateState: { specificityLevel: 'medium' },
  coverageState: { coveredTopics: [topic], missingTopics: [gap], weakAreas: [] },
  matchState: { validationTargets: [] },
  evaluatorState: { suggestedNextMode: 'deepen', evidenceGainScore: 0.62 },
  dynamicSlotState: {},
  abductiveState: { shouldProbe: false },
  sectionState: { isSectionComplete: false },
  interviewStructure: { focusAreaKey: 'combined', currentTopicState: {} },
  agentMemory: {},
  userInterviewMemory: projection,
});

const planSignature = (plan = {}) => ({
  selectedAction: plan.selectedAction,
  targetTopic: plan.actionInput?.targetTopic,
  probeType: plan.actionInput?.probeType,
});

const stableEvaluation = ({ evaluationId: _evaluationId, createdAt: _createdAt, ...evaluation }) => evaluation;

const percentChange = (baseline, treatment) => baseline === 0
  ? 0
  : ((baseline - treatment) / baseline) * 100;

const main = async () => {
  const eligibleCases = [
    ['system_design', 'observability'],
    ['api_design', 'security'],
    ['database_design', 'reliability'],
    ['incident_response', 'stakeholder_communication'],
    ['delivery_ownership', 'testing_strategy'],
  ];
  const eligibleResults = eligibleCases.map(([topic, gap], index) => {
    const projection = buildUserInterviewMemoryProjection({
      analyses: [
        buildAnalysis({ sessionId: `eligible-${index}-a`, topic }),
        buildAnalysis({ sessionId: `eligible-${index}-b`, topic }),
      ],
      currentRoleKey: 'backend_engineer',
      planningEnabled: true,
      now,
    });
    const baseline = selectNextAction(buildContext({
      topic,
      gap,
      projection: { ...projection, planningEnabled: false },
    }));
    const treatment = selectNextAction(buildContext({ topic, gap, projection }));
    return {
      topic,
      gap,
      baseline: planSignature(baseline),
      treatment: planSignature(treatment),
      baselineSameDepthRepeat: baseline.actionInput?.targetTopic === topic,
      treatmentSameDepthRepeat: treatment.actionInput?.targetTopic === topic
        && treatment.actionInput?.probeType !== 'memory_depth_progression',
      baselineCoversGap: baseline.actionInput?.targetTopic === gap,
      treatmentCoversGap: treatment.actionInput?.targetTopic === gap,
    };
  });

  const baselineRepeatCount = eligibleResults.filter((item) => item.baselineSameDepthRepeat).length;
  const treatmentRepeatCount = eligibleResults.filter((item) => item.treatmentSameDepthRepeat).length;
  const baselineCoverageCount = eligibleResults.filter((item) => item.baselineCoversGap).length;
  const treatmentCoverageCount = eligibleResults.filter((item) => item.treatmentCoversGap).length;
  const sameDepthRepeatReductionPercent = percentChange(baselineRepeatCount, treatmentRepeatCount);
  const coverageIncreasePercent = eligibleCases.length
    ? ((treatmentCoverageCount - baselineCoverageCount) / eligibleCases.length) * 100
    : 0;

  assert.equal(sameDepthRepeatReductionPercent >= 30, true);
  assert.equal(coverageIncreasePercent >= 20, true);

  const invalidProjectionCases = [
    {
      id: 'single_session_not_promoted',
      analyses: [buildAnalysis({ sessionId: 'single-1', topic: 'system_design' })],
      currentRoleKey: 'backend_engineer',
    },
    {
      id: 'role_mismatch_not_applied',
      analyses: [
        buildAnalysis({ sessionId: 'role-1', topic: 'system_design' }),
        buildAnalysis({ sessionId: 'role-2', topic: 'system_design' }),
      ],
      currentRoleKey: 'product_manager',
    },
    {
      id: 'stale_memory_requires_revalidation',
      analyses: [
        buildAnalysis({ sessionId: 'stale-1', topic: 'system_design', createdAt: '2025-01-01T00:00:00.000Z' }),
        buildAnalysis({ sessionId: 'stale-2', topic: 'system_design', createdAt: '2025-01-02T00:00:00.000Z' }),
      ],
      currentRoleKey: 'backend_engineer',
    },
    {
      id: 'conflict_requires_revalidation',
      analyses: [
        buildAnalysis({ sessionId: 'conflict-1', topic: 'system_design' }),
        buildAnalysis({ sessionId: 'conflict-2', topic: 'system_design' }),
        buildAnalysis({ sessionId: 'conflict-3', topic: 'system_design', score: 0.3, specificity: 'low' }),
      ],
      currentRoleKey: 'backend_engineer',
    },
  ];

  const wrongSuppressionResults = invalidProjectionCases.map((fixture) => {
    const projection = buildUserInterviewMemoryProjection({
      analyses: fixture.analyses,
      currentRoleKey: fixture.currentRoleKey,
      planningEnabled: true,
      now,
    });
    const baselineProjection = { ...projection, planningEnabled: false };
    const baseline = selectNextAction(buildContext({
      topic: 'system_design',
      gap: 'observability',
      projection: baselineProjection,
    }));
    const treatment = selectNextAction(buildContext({
      topic: 'system_design',
      gap: 'observability',
      projection,
    }));
    const unchanged = JSON.stringify(planSignature(baseline)) === JSON.stringify(planSignature(treatment));
    assert.equal(unchanged, true);
    return { id: fixture.id, passed: true, suppressionCount: projection.routineRepeatSuppressions.length };
  });

  const environment = {
    latestAnswer: { text: 'I designed the service, measured latency, and reduced failures by 30 percent.' },
    questionContext: { latestQuestionTopic: 'system_design', previousTopics: [] },
    roleContext: { requiredSkills: ['system design'] },
  };
  const evaluatorBaseline = evaluateInterviewTurn({ environment, decisionContext: { currentTopic: 'system_design' } });
  const evaluatorWithMemory = evaluateInterviewTurn({
    environment,
    decisionContext: { currentTopic: 'system_design', userInterviewMemory: { routineRepeatSuppressions: ['ignored'] } },
  });
  assert.deepEqual(stableEvaluation(evaluatorWithMemory), stableEvaluation(evaluatorBaseline));

  const result = {
    generatedAt: new Date().toISOString(),
    executionMode: 'local_shadow_observe',
    verdict: 'LOCAL_MEMORY_OUTCOME_GATE_PASS',
    thresholds: {
      minimumIndependentSessions: 2,
      freshnessDays: 90,
      sameDepthRepeatReductionTargetPercent: 30,
      coverageIncreaseTargetPercent: 20,
      wrongSuppressionTarget: 0,
    },
    metrics: {
      eligibleCaseCount: eligibleCases.length,
      baselineSameDepthRepeatCount: baselineRepeatCount,
      treatmentSameDepthRepeatCount: treatmentRepeatCount,
      sameDepthRepeatReductionPercent,
      baselineCoverageCount,
      treatmentCoverageCount,
      coverageIncreasePercent,
      wrongSuppressionCount: 0,
      evaluatorOutputChangedByMemory: false,
    },
    eligibleResults,
    wrongSuppressionResults,
    runtimePromotion: {
      defaultPlanningEnabled: false,
      candidateBehaviorChangedByDefault: false,
    },
    remainingGates: [
      'product_owner_threshold_approval',
      'user_control_policy',
      'source_delete_invalidation',
      'human_repeated_session_validation',
      'production_observe',
    ],
  };

  await mkdir(evidenceRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'm3-memory-outcomes.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(path.join(evidenceRoot, 'm3-memory-outcomes.md'), `# M3 User Interview Memory Outcomes\n\n- Generated: ${result.generatedAt}\n- Verdict: \`${result.verdict}\`\n- Eligible cases: ${eligibleCases.length}\n- Same-depth repeat reduction: ${sameDepthRepeatReductionPercent.toFixed(2)}% (target >= 30%)\n- Coverage increase: ${coverageIncreasePercent.toFixed(2)}% (target >= 20%)\n- Wrong suppression: 0 (target 0)\n- Evaluator output changed by memory: no\n\n## Safety cases\n\n| Case | Result |\n| --- | --- |\n${wrongSuppressionResults.map((item) => `| \`${item.id}\` | PASS |`).join('\n')}\n\n## Boundary\n\nThe projection is recomputed from session-owned analysis artifacts during warm-up and is stored only on the current session. Runtime planning is off by default. User controls, source-delete invalidation, human repeated-session validation, and production observe remain open gates.\n`),
  ]);

  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
