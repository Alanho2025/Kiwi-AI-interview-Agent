import { QUESTION_CATALOG_SEED, QUESTION_CATALOG_VERSION } from '../../data/questionCatalogSeed2026_1.js';
import {
  buildCatalogQuestionSnapshots,
  buildFollowUpVsNextRootComparison,
  resolveCatalogReservationPlan,
} from './questionCatalogSelectionService.js';

const REVIEW_SCENARIOS = [
  {
    scenarioId: 'software_junior_8',
    description: 'Software, Junior, eight questions, no explicit AI-delivery signal',
    jobTitle: 'Junior Software Engineer',
    roleFamily: 'software_development',
    rawJD: 'Build and test web services.',
    seniorityLevel: 'Junior/Grad',
    questionLimit: 8,
  },
  {
    scenarioId: 'data_intermediate_15',
    description: 'Data, Intermediate, fifteen questions',
    jobTitle: 'Data Engineer',
    roleFamily: 'data_engineering',
    rawJD: 'Build reliable data pipelines and analytics datasets.',
    seniorityLevel: 'Intermediate',
    questionLimit: 15,
  },
  {
    scenarioId: 'ai_solution_senior_8',
    description: 'Explicit AI Solution role with agent, RAG, evaluation, and safety signals',
    jobTitle: 'Senior AI Solution Engineer',
    roleFamily: 'ai_ml',
    rawJD: 'Build RAG agents with MCP tools, evaluations, and safety guardrails.',
    seniorityLevel: 'Senior',
    questionLimit: 8,
  },
  {
    scenarioId: 'provider_only_software_8',
    description: 'Software role mentioning only one model provider',
    jobTitle: 'Senior Software Engineer',
    roleFamily: 'software_development',
    rawJD: 'Azure OpenAI exposure is preferred.',
    seniorityLevel: 'Senior',
    questionLimit: 8,
  },
  {
    scenarioId: 'ml_intermediate_15',
    description: 'Intermediate ML role with explicit training and monitoring responsibility',
    jobTitle: 'Intermediate Machine Learning Engineer',
    roleFamily: 'machine_learning',
    rawJD: 'Train and evaluate machine learning models, then monitor drift in production.',
    seniorityLevel: 'Intermediate',
    questionLimit: 15,
  },
  {
    scenarioId: 'ml_senior_15',
    description: 'Senior ML role with explicit training and monitoring responsibility',
    jobTitle: 'Senior Machine Learning Engineer',
    roleFamily: 'machine_learning',
    rawJD: 'Train and evaluate machine learning models, then monitor drift in production.',
    seniorityLevel: 'Senior',
    questionLimit: 15,
  },
  {
    scenarioId: 'non_tech_no_signal_8',
    description: 'Non-tech role without AI or digital-work signal',
    jobTitle: 'People Operations Coordinator',
    roleFamily: 'people_operations',
    rawJD: 'Support onboarding and internal policy administration.',
    seniorityLevel: 'Intermediate',
    questionLimit: 8,
  },
  {
    scenarioId: 'non_tech_ai_signal_8',
    description: 'Non-tech role with an explicit AI-enabled workflow signal',
    jobTitle: 'People Operations Coordinator',
    roleFamily: 'people_operations',
    rawJD: 'Improve AI-enabled workflows while keeping human review for sensitive cases.',
    seniorityLevel: 'Intermediate',
    questionLimit: 8,
  },
  {
    scenarioId: 'software_senior_5',
    description: 'Software role with fewer than eight question slots',
    jobTitle: 'Senior Software Engineer',
    roleFamily: 'software_development',
    rawJD: 'Build and test web services.',
    seniorityLevel: 'Senior',
    questionLimit: 5,
  },
];

const approvedCatalog = () => QUESTION_CATALOG_SEED.map((item) => ({
  ...item,
  lifecycle: 'approved',
}));

const buildScenarioOutput = (scenario) => {
  const context = {
    userId: 'policy-review-user',
    sessionId: `policy-review-${scenario.scenarioId}`,
    settings: {
      seniorityLevel: scenario.seniorityLevel,
      questionLimit: scenario.questionLimit,
      focusArea: 'combined',
    },
    analysisResult: {
      jobTitle: scenario.jobTitle,
      parsedJdProfile: {
        roleFamily: scenario.roleFamily,
        rawJD: scenario.rawJD,
      },
    },
  };
  const snapshots = buildCatalogQuestionSnapshots({
    catalogItems: approvedCatalog(),
    context,
  });
  const reservationPlan = resolveCatalogReservationPlan({
    poolItems: snapshots.items,
    session: {
      analysisResult: context.analysisResult,
      settings: context.settings,
      currentQuestionIndex: 1,
      questionLimit: scenario.questionLimit,
      transcript: [],
    },
  });
  const aiJudgement = snapshots.items.find((item) => item.catalogQuestionId === 'ai_literacy_responsible_use');
  const aiJudgementRejection = snapshots.rejected.find((item) => item.catalogQuestionId === 'ai_literacy_responsible_use');
  const requiredReservations = reservationPlan.reservations
    .filter((reservation) => reservation.minAsked > 0)
    .map((reservation) => ({
      coverageSlot: reservation.coverageSlot,
      questionFamily: reservation.questionFamily,
      minAsked: reservation.minAsked,
      maxAsked: reservation.maxAsked,
      reservationPriority: reservation.reservationPriority,
      initialStatus: reservation.status,
    }));

  return {
    scenarioId: scenario.scenarioId,
    description: scenario.description,
    resolvedRoleFamily: snapshots.selectionContext.roleFamily,
    targetLevel: snapshots.selectionContext.targetLevel,
    questionLimit: snapshots.selectionContext.questionLimit,
    strongestAiSignal: snapshots.selectionContext.signalProfile.strongestSignal,
    explicitAiDelivery: snapshots.selectionContext.signalProfile.explicitAiDelivery,
    hasMlSignal: snapshots.selectionContext.signalProfile.hasMlSignal,
    hasAiOrDigitalSignal: snapshots.selectionContext.hasAiOrDigitalSignal,
    eligibleCatalogItemCount: snapshots.items.length,
    rejectedCatalogItemCount: snapshots.rejected.length,
    aiJudgementEligibility: aiJudgement
      ? 'eligible_optional'
      : aiJudgementRejection?.reason || 'not_present',
    requiredCoverageSlots: requiredReservations.map((reservation) => reservation.coverageSlot),
    requiredReservations,
  };
};

const buildFollowUpComparisons = () => [
  {
    scenarioId: 'minor_gap_high_value_root',
    description: 'A complete-enough answer has one validation gap while a fresh root has high value.',
    result: buildFollowUpVsNextRootComparison({
      answerSignals: { isShallow: false, missingEvidence: ['result_or_validation'] },
      nextRootCandidate: { score: 0.9 },
      targetLevel: 'intermediate',
      followUpIntent: 'validation',
    }),
  },
  {
    scenarioId: 'shallow_senior_material_deficits',
    description: 'A shallow Senior answer is missing ownership, validation, and trade-off evidence.',
    result: buildFollowUpVsNextRootComparison({
      answerSignals: {
        isShallow: true,
        missingEvidence: ['ownership_or_action', 'result_or_validation', 'tradeoff_or_constraint'],
      },
      nextRootCandidate: { score: 0.45 },
      targetLevel: 'senior',
      followUpIntent: 'tradeoff',
    }),
  },
].map(({ scenarioId, description, result }) => ({
  scenarioId,
  description,
  decision: result.decision,
  followUpIntent: result.followUpIntent,
  followUpValue: result.followUpValue,
  nextRootValue: result.nextRootValue,
  missingEvidence: result.missingEvidence,
  reason: result.reason,
}));

export const buildVoiceSelectionPolicyReviewSnapshot = () => ({
  catalogVersion: QUESTION_CATALOG_VERSION,
  generatedFrom: [
    'questionCatalogSeed2026_1.js',
    'questionCatalogSelectionService.js',
  ],
  scenarios: REVIEW_SCENARIOS.map(buildScenarioOutput),
  followUpComparisons: buildFollowUpComparisons(),
});

const formatRequiredReservations = (reservations = []) => (
  reservations.length
    ? reservations
      .map((reservation) => `\`${reservation.coverageSlot}\` (min ${reservation.minAsked}, max ${reservation.maxAsked}, priority ${reservation.reservationPriority})`)
      .join('<br>')
    : '_none_'
);

const renderScenarioRow = (scenario) => [
  `| \`${scenario.scenarioId}\`<br>${scenario.description}`,
  `\`${scenario.resolvedRoleFamily}\` / \`${scenario.targetLevel}\` / ${scenario.questionLimit}`,
  `strongest \`${scenario.strongestAiSignal}\`<br>explicit delivery \`${scenario.explicitAiDelivery}\`<br>ML \`${scenario.hasMlSignal}\``,
  `\`${scenario.aiJudgementEligibility}\``,
  `${formatRequiredReservations(scenario.requiredReservations)} |`,
].join(' | ');

const renderFollowUpRow = (comparison) => [
  `| \`${comparison.scenarioId}\`<br>${comparison.description}`,
  `\`${comparison.followUpIntent}\``,
  comparison.missingEvidence.map((item) => `\`${item}\``).join(', '),
  `${comparison.followUpValue.toFixed(3)} / ${comparison.nextRootValue.toFixed(3)}`,
  `\`${comparison.decision}\``,
  `\`${comparison.reason}\` |`,
].join(' | ');

export const renderVoiceSelectionPolicyReviewMarkdown = ({ policyReviewRecord = {} } = {}) => {
  const snapshot = buildVoiceSelectionPolicyReviewSnapshot();
  return [
    '# CP2 Full Human Review — Executable Voice Selection Policy',
    '',
    '> Generated from the executable catalog and selection policy. Do not edit this file directly.',
    '',
    `Catalog version: \`${snapshot.catalogVersion}\``,
    `Review decision: **${policyReviewRecord.decision || 'pending'}**`,
    `Reviewer: \`${policyReviewRecord.reviewer || 'not_recorded'}\``,
    `Decided at: \`${policyReviewRecord.decidedAt || 'not_recorded'}\``,
    `Candidate policy digest: \`${policyReviewRecord.candidatePolicyDigest || 'not_provided'}\``,
    `Approved policy digest: \`${policyReviewRecord.approvedPolicyDigest || 'not_approved'}\``,
    `Decision reason: ${policyReviewRecord.decisionReason || 'not recorded'}`,
    `Generated from: ${snapshot.generatedFrom.map((source) => `\`${source}\``).join(', ')}`,
    '',
    'Policy review scope:',
    '',
    ...(policyReviewRecord.policyScope || []).map((scope) => `- \`${scope}\``),
    '',
    'The scenarios below simulate approved catalog items to bind this review to deterministic policy output. Database lifecycle and activation evidence are recorded separately in the compact decision sheet.',
    '',
    '## Role, level, question-count and reservation matrix',
    '',
    '| Scenario | Resolved role / level / questions | AI/ML signal result | AI judgement | Required coverage |',
    '| --- | --- | --- | --- | --- |',
    ...snapshot.scenarios.map(renderScenarioRow),
    '',
    '## Follow-up versus next-root comparisons',
    '',
    '| Scenario | Follow-up intent | Missing evidence | Follow-up / next-root score | Decision | Reason |',
    '| --- | --- | --- | --- | --- | --- |',
    ...snapshot.followUpComparisons.map(renderFollowUpRow),
    '',
    '## Candidate and activation boundary',
    '',
    '- These are developer/reviewer policy outputs, not candidate-visible payloads.',
    '- Candidate completion output remains limited to safe status and counts; coverage slot names, scores, ranking alternatives, and private evidence remain internal.',
    '- This artifact does not approve CP1 content, activate Mongo, authorize CP3/CP4, or prove the Voice three-second audio SLO.',
    '',
    'Record the final decision in the compact [CP2 decision sheet](./cp2-voice-selection-review.md).',
    '',
  ].join('\n');
};
