/**
 * Run Question Intelligence Evaluation Benchmark Script (QI-CP5)
 *
 * Executes frozen scenario benchmarks across Seniority, Role Families, Clarification Turns,
 * and Report Candidate Safety checks. Outputs a structured Evaluation Scorecard.
 *
 * Usage: node src/scripts/runQuestionIntelligenceEval.js
 */

import {
  EVIDENCE_CATEGORIES,
  evaluateScenarioParity,
  buildEvaluationScorecard,
} from '../services/questions/questionEvaluationService.js';
import {
  DEFAULT_ROLLOUT_MODE,
  ROLLOUT_MODES,
  evaluateRolloutDecision,
} from '../services/questions/questionRolloutModeService.js';

const FROZEN_SCENARIOS = [
  {
    scenarioId: 'scen_01_senior_software_ai_delivery',
    targetLevel: 'senior',
    roleFamily: 'software',
    questionSelection: { catalogQuestionId: 'ai_assisted_delivery', questionType: 'ai_workflow' },
    scopeClarificationTurn: { incrementsQuestionCount: false, createsScoredAnswer: false },
    reportCoaching: { summary: 'Framed system trade-offs well.', clarificationScoreBand: 'strong' },
  },
  {
    scenarioId: 'scen_02_intermediate_data_ml_evaluation',
    targetLevel: 'intermediate',
    roleFamily: 'data',
    questionSelection: { catalogQuestionId: 'ml_model_evaluation', questionType: 'ml_theory' },
    scopeClarificationTurn: { incrementsQuestionCount: false, createsScoredAnswer: false },
    reportCoaching: { summary: 'Good understanding of metric selection.', clarificationScoreBand: 'adequate' },
  },
  {
    scenarioId: 'scen_03_junior_non_tech_behavioral',
    targetLevel: 'junior',
    roleFamily: 'non_tech',
    questionSelection: { catalogQuestionId: 'customer_conflict_resolution', questionType: 'behavioral' },
    scopeClarificationTurn: null,
    reportCoaching: { summary: 'Clear communication of personal ownership.', clarificationScoreBand: 'not_applicable' },
  },
  {
    scenarioId: 'scen_04_senior_ai_solution_architect',
    targetLevel: 'senior',
    roleFamily: 'ai_solution',
    questionSelection: { catalogQuestionId: 'llm_eval_harness_design', questionType: 'ai_workflow' },
    scopeClarificationTurn: { incrementsQuestionCount: false, createsScoredAnswer: false },
    reportCoaching: { summary: 'Strong evaluation criteria framing.', clarificationScoreBand: 'strong' },
  },
  {
    scenarioId: 'scen_05_intermediate_software_tradeoff',
    targetLevel: 'intermediate',
    roleFamily: 'software',
    questionSelection: { catalogQuestionId: 'db_indexing_strategy', questionType: 'technical_depth' },
    scopeClarificationTurn: null,
    reportCoaching: { summary: 'Identified index scan vs heap lookup trade-offs.', clarificationScoreBand: 'adequate' },
  },
  {
    scenarioId: 'scen_06_senior_data_pipeline_architecture',
    targetLevel: 'senior',
    roleFamily: 'data',
    questionSelection: { catalogQuestionId: 'streaming_data_decoupling', questionType: 'technical_depth' },
    scopeClarificationTurn: { incrementsQuestionCount: false, createsScoredAnswer: false },
    reportCoaching: { summary: 'Addressed backpressure and idempotency.', clarificationScoreBand: 'strong' },
  },
  {
    scenarioId: 'scen_07_junior_software_scaffold_probe',
    targetLevel: 'junior',
    roleFamily: 'software',
    questionSelection: { catalogQuestionId: 'unit_testing_basics', questionType: 'technical_depth' },
    scopeClarificationTurn: null,
    reportCoaching: { summary: 'Demonstrated good isolation in test fixtures.', clarificationScoreBand: 'adequate' },
  },
  {
    scenarioId: 'scen_08_senior_ml_observability',
    targetLevel: 'senior',
    roleFamily: 'ml',
    questionSelection: { catalogQuestionId: 'feature_drift_detection', questionType: 'ml_theory' },
    scopeClarificationTurn: { incrementsQuestionCount: false, createsScoredAnswer: false },
    reportCoaching: { summary: 'Framed data drift vs concept drift monitoring.', clarificationScoreBand: 'strong' },
  },
  {
    scenarioId: 'scen_09_open_scope_probe_ambiguity',
    targetLevel: 'senior',
    roleFamily: 'software',
    questionSelection: { catalogQuestionId: 'legacy_monolith_migration', questionType: 'scenario_constraint' },
    scopeClarificationTurn: { incrementsQuestionCount: false, createsScoredAnswer: false },
    reportCoaching: { summary: 'Asked essential clarification questions before designing.', clarificationScoreBand: 'strong' },
  },
  {
    scenarioId: 'scen_10_intermediate_ml_serving_latency',
    targetLevel: 'intermediate',
    roleFamily: 'ml',
    questionSelection: { catalogQuestionId: 'model_quantization_tradeoff', questionType: 'ml_theory' },
    scopeClarificationTurn: null,
    reportCoaching: { summary: 'Balanced INT8 precision loss against latency target.', clarificationScoreBand: 'adequate' },
  },
  {
    scenarioId: 'scen_11_candidate_safe_report_grounding',
    targetLevel: 'senior',
    roleFamily: 'data',
    questionSelection: { catalogQuestionId: 'data_governance_retention', questionType: 'behavioral' },
    scopeClarificationTurn: null,
    reportCoaching: { summary: 'Clear alignment with PII governance without leaking internal IDs.', clarificationScoreBand: 'strong' },
  },
  {
    scenarioId: 'scen_12_junior_non_tech_stakeholder_comm',
    targetLevel: 'junior',
    roleFamily: 'non_tech',
    questionSelection: { catalogQuestionId: 'cross_team_prioritization', questionType: 'behavioral' },
    scopeClarificationTurn: null,
    reportCoaching: { summary: 'Clear communication of trade-offs and updates.', clarificationScoreBand: 'adequate' },
  },
];

const RAW_EVIDENCE_RECORDS = Array(12).fill({ hasCodeArtifact: true, hasLocalTestsPassing: true });

export function runEvaluationSuite() {
  const activeMode = process.env.QUESTION_INTELLIGENCE_ROLLOUT_MODE || DEFAULT_ROLLOUT_MODE;

  console.log('====================================================');
  console.log(`  QI-CP5 Expanded Evaluation Benchmark (${activeMode.toUpperCase()} Mode)  `);
  console.log('====================================================\n');

  const verdicts = FROZEN_SCENARIOS.map((scen) => evaluateScenarioParity(scen));

  verdicts.forEach((v) => {
    const statusSymbol = v.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${statusSymbol}] Scenario '${v.scenarioId}' (${v.targetLevel} / ${v.roleFamily})`);
    v.checks.forEach((c) => {
      const checkSymbol = c.passed ? '  ✓' : '  ✗';
      console.log(`${checkSymbol} ${c.name}: ${c.detail}`);
    });
    console.log('');
  });

  const scorecard = buildEvaluationScorecard(verdicts, RAW_EVIDENCE_RECORDS);

  console.log('----------------------------------------------------');
  console.log('                EVALUATION SCORECARD                ');
  console.log('----------------------------------------------------');
  console.log(`Total Scenarios Evaluated : ${scorecard.totalScenarios}`);
  console.log(`Passed Scenarios          : ${scorecard.passedScenarios}`);
  console.log(`Failed Scenarios          : ${scorecard.failedScenarios}`);
  console.log(`Pass Rate                 : ${scorecard.passRatePercent}%`);
  console.log('\nEvidence Taxonomy Breakdown:');
  Object.entries(scorecard.evidenceSummary).forEach(([cat, count]) => {
    console.log(` - ${cat}: ${count} entry/entries`);
  });

  // Rollout decision evaluation
  const rolloutDemo = evaluateRolloutDecision({
    mode: activeMode,
    legacyOutput: { text: 'What is your background?' },
    newDecision: { catalogQuestionId: 'ai_assisted_delivery', text: 'How do you structure and verify AI-assisted code delivery in production?' },
  });

  console.log('\n----------------------------------------------------');
  console.log('              ROLLOUT MODE DIAGNOSTIC               ');
  console.log('----------------------------------------------------');
  console.log(`Active Rollout Mode       : ${rolloutDemo.rolloutMode}`);
  console.log(`Is New Decision Exposed   : ${rolloutDemo.isNewDecisionExposed}`);
  console.log(`Candidate Visible Question: "${rolloutDemo.candidateVisibleOutput.text}"`);
  console.log(`Redacted Trace Status     : ${rolloutDemo.redactedTrace.hasNewDecision ? 'Recorded' : 'None'}`);
  console.log('====================================================\n');

  return { verdicts, scorecard, rolloutDemo };
}

// Run directly if invoked from CLI
if (process.argv[1]?.includes('runQuestionIntelligenceEval.js')) {
  runEvaluationSuite();
}
