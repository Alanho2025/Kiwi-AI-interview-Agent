import { ensureArray, normalizeKey, normalizeText, tokenize } from '../../utils/commonHelpers.js';
import { extractAnswerEvidenceSignals } from './answerEvidenceSignalService.js';

const EXCLUDED_ANSWER_TYPES = new Set([
  'repair_prompt',
  'transcript_confirmation',
  'transcript_confirmation_response',
  'clarification',
  'repeat_request',
  'system',
  'bridge_acknowledgement',
  'barge_in_acknowledgement',
  'acknowledgement',
]);
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'could', 'from', 'have', 'into',
  'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'through', 'what',
  'when', 'where', 'which', 'with', 'would', 'your',
]);

const clamp = (value, maximum) => Math.max(0, Math.min(maximum, Math.round(Number(value) || 0)));
const unique = (values = []) => [...new Set(ensureArray(values).filter(Boolean))];

const meaningfulTokens = (value = '') => unique(tokenize(value)
  .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));

const overlapRatio = (source = '', target = '') => {
  const sourceTokens = new Set(meaningfulTokens(source));
  const targetTokens = meaningfulTokens(target);
  if (!sourceTokens.size || !targetTokens.length) return 0;
  return targetTokens.filter((token) => sourceTokens.has(token)).length / targetTokens.length;
};

const isAcceptedPair = (pair = {}) => {
  const answerTurn = pair.answerTurn || {};
  const metadata = answerTurn.metadata || {};
  const turnType = normalizeKey(metadata.turnType || metadata.turnKind || metadata.sourceType);
  const transcriptStatus = normalizeKey(metadata.transcriptStatus);
  if (normalizeKey(answerTurn.role) !== 'user' || !normalizeText(answerTurn.text)) return false;
  if (metadata.countsAsAnswer === false || metadata.countsAsQuestion === false) return false;
  if (EXCLUDED_ANSWER_TYPES.has(turnType)) return false;
  if (metadata.transcriptAcceptance?.accepted === false) return false;
  return !['rejected', 'pending', 'unconfirmed'].includes(transcriptStatus);
};

const getPreparedQuestionId = (questionTurn = {}) => questionTurn.metadata?.preparedQuestionId
  || questionTurn.metadata?.questionDecision?.preparedQuestionId
  || null;

const getRankTrace = (questionTurn = {}) => questionTurn.metadata?.rankTrace
  || questionTurn.metadata?.questionDecision?.rankTrace
  || {};

const resolveQuestionContext = ({ pair = {}, poolById = new Map() } = {}) => {
  const questionTurn = pair.questionTurn || {};
  const preparedQuestionId = getPreparedQuestionId(questionTurn);
  const poolItem = poolById.get(preparedQuestionId)
    || poolById.get(pair.questionId)
    || {};
  const rankTrace = getRankTrace(questionTurn);
  return {
    poolItem,
    proofPointId: poolItem.proofPointId || rankTrace.proofPointId || '',
    testedRoleIntentIds: unique([
      ...ensureArray(poolItem.testedRoleIntentIds),
      ...ensureArray(rankTrace.testedRoleIntentIds),
    ]),
    recommendedEvidenceIds: unique([
      ...ensureArray(poolItem.recommendedEvidenceIds),
      ...ensureArray(rankTrace.recommendedEvidenceIds),
    ]),
    evidenceAngle: poolItem.evidenceAngle || rankTrace.evidenceAngle || '',
    expectedSignals: unique(poolItem.expectedSignal || poolItem.expectedSignals || poolItem.evidenceNeed),
  };
};

const buildEvidenceIndex = (roleEvidenceMap = {}) => {
  const index = new Map();
  ensureArray(roleEvidenceMap.items).forEach((mapItem) => {
    ensureArray(mapItem.sourceEvidence).forEach((evidence) => {
      if (!evidence.evidenceId) return;
      index.set(evidence.evidenceId, { ...evidence, mapItem });
    });
  });
  return index;
};

const detectEvidenceUsed = ({ answer = '', recommendedEvidenceIds = [], evidenceIndex, evidenceAngle = '' } = {}) => (
  unique(recommendedEvidenceIds)
    .map((evidenceId) => ({ evidenceId, evidence: evidenceIndex.get(evidenceId) }))
    .filter(({ evidence }) => evidence?.sourceTrace)
    .map(({ evidenceId, evidence }) => {
      const overlap = overlapRatio(answer, evidence.text || evidence.normalizedSummary || '');
      if (overlap < 0.18) return null;
      return {
        evidenceId,
        confidence: overlap >= 0.45 ? 'high' : overlap >= 0.28 ? 'medium' : 'low',
        angleUsed: evidenceAngle || 'general_example',
      };
    })
    .filter(Boolean)
);

const alignmentLabel = (score) => {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'partial';
  if (score >= 35) return 'weak';
  return 'off_target';
};

const buildMissedSignals = (signals = {}) => [
  !signals.hasPastContext ? 'specific context' : null,
  !signals.hasPersonalAction ? 'personal ownership' : null,
  !signals.hasValidation ? 'validation' : null,
  !signals.hasOutcome ? 'outcome' : null,
  !signals.metricMatches?.length ? 'measurable result' : null,
].filter(Boolean);

const buildScoreBreakdown = ({ answer, question, roleIntentText, mapItems, detectedEvidenceUsed, signals }) => {
  const questionOverlap = overlapRatio(answer, question);
  const roleIntentOverlap = overlapRatio(answer, roleIntentText);
  const bestClassification = mapItems.find((item) => item.classification === 'direct')?.classification
    || mapItems.find((item) => item.classification === 'adjacent')?.classification
    || mapItems[0]?.classification;
  const questionAlignment = clamp(
    questionOverlap >= 0.15 ? 22 : signals.hasPastContext && signals.hasPersonalAction ? 18 : 8,
    25,
  );
  const roleIntentFit = clamp(
    roleIntentOverlap >= 0.35 ? 25 : roleIntentOverlap >= 0.15 ? 20 : questionOverlap >= 0.15 ? 15 : 5,
    25,
  );
  const evidenceFit = clamp(
    detectedEvidenceUsed.length
      ? bestClassification === 'direct' ? 20 : bestClassification === 'adjacent' ? 16 : 10
      : signals.isDirectPastExperience ? 9 : 2,
    20,
  );
  const evidenceClarity = clamp([
    signals.hasPastContext,
    signals.hasPersonalAction,
    signals.hasValidation,
    signals.hasOutcome || signals.metricMatches?.length,
  ].filter(Boolean).length * 5, 20);
  const wordCount = normalizeText(answer).split(/\s+/).filter(Boolean).length;
  const naturalness = clamp(wordCount >= 12 && wordCount <= 180 ? 10 : wordCount >= 6 ? 7 : 3, 10);
  return { questionAlignment, roleIntentFit, evidenceFit, evidenceClarity, naturalness };
};

const buildMainIssue = ({ label, missedSignals = [], groundingStatus }) => {
  if (groundingStatus === 'blocked') return 'This answer could not be linked safely to the role focus.';
  if (label === 'strong') return 'Your answer directly addressed this focus area with clear evidence.';
  if (missedSignals.length) return `The answer needs clearer ${missedSignals.slice(0, 2).join(' and ')}.`;
  return 'The answer needs a more direct connection to this part of the role.';
};

export const buildAnswerAlignments = ({
  questionAnswerPairs = [],
  interviewPlan = {},
  analysisResult = {},
} = {}) => {
  const poolById = new Map(ensureArray(interviewPlan.questionPool)
    .map((item) => [item.questionId, item]));
  const roleEvidenceItems = ensureArray(analysisResult.roleEvidenceMap?.items);
  const evidenceIndex = buildEvidenceIndex(analysisResult.roleEvidenceMap);

  return ensureArray(questionAnswerPairs).filter(isAcceptedPair).map((pair, index) => {
    const context = resolveQuestionContext({ pair, poolById });
    if (!context.proofPointId && !context.testedRoleIntentIds.length) return null;
    const answer = normalizeText(pair.answerTurn?.text);
    const mapItems = roleEvidenceItems.filter((item) => context.testedRoleIntentIds.includes(item.roleIntentId));
    const roleIntentLabels = unique(mapItems.map((item) => normalizeText(item.roleIntent)).filter(Boolean));
    const detectedEvidenceUsed = detectEvidenceUsed({
      answer,
      recommendedEvidenceIds: context.recommendedEvidenceIds,
      evidenceIndex,
      evidenceAngle: context.evidenceAngle,
    });
    const signals = extractAnswerEvidenceSignals(answer);
    const scoreBreakdown = buildScoreBreakdown({
      answer,
      question: pair.questionTurn?.text || context.poolItem.text || '',
      roleIntentText: roleIntentLabels.join(' '),
      mapItems,
      detectedEvidenceUsed,
      signals,
    });
    const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
    const label = alignmentLabel(score);
    const missedSignals = buildMissedSignals(signals);
    const groundingStatus = !mapItems.length
      ? 'blocked'
      : detectedEvidenceUsed.length ? 'grounded' : 'limited';

    return {
      schemaVersion: 'answer_alignment_v1',
      turnId: pair.answerTurn?.id || `answer-${pair.questionId || index + 1}`,
      questionId: pair.questionId || pair.questionTurn?.questionId || '',
      question: normalizeText(pair.questionTurn?.text || context.poolItem.text),
      proofPointId: context.proofPointId || null,
      testedRoleIntentIds: context.testedRoleIntentIds,
      roleIntentLabels,
      expectedSignals: context.expectedSignals,
      candidateAnswerSummary: answer.slice(0, 360),
      detectedEvidenceUsed,
      score,
      label,
      scoreBreakdown,
      diagnosis: {
        mainIssue: buildMainIssue({ label, missedSignals, groundingStatus }),
        missedSignals,
        overuseRisk: 'low',
      },
      betterAnswerPlan: {
        useSameExample: detectedEvidenceUsed.length > 0,
        changeAngleTo: missedSignals[0] || null,
        structure: context.poolItem.evidenceMode === 'past_example' ? 'STAR' : 'direct',
        spokenRewrite: null,
        direction: missedSignals.length
          ? `Keep the answer focused and add ${missedSignals.slice(0, 2).join(' and ')}.`
          : 'Keep the example and make the result easy to hear.',
      },
      groundingStatus,
      evidenceAngle: context.evidenceAngle || '',
      topic: normalizeText(context.poolItem.topic),
    };
  }).filter(Boolean);
};

const buildRoleIntentCoverage = ({ proofStrategy = {}, alignments = [], roleEvidenceMap = {} } = {}) => {
  const roleEvidenceById = new Map(ensureArray(roleEvidenceMap.items)
    .map((item) => [item.roleIntentId, item]));
  const items = ensureArray(proofStrategy.mustCover).map((coverage) => {
    const aligned = alignments.filter((alignment) => alignment.proofPointId === coverage.coverageId
      || alignment.testedRoleIntentIds.includes(coverage.roleIntentId));
    const best = [...aligned].sort((left, right) => right.score - left.score)[0];
    const status = coverage.status === 'degraded'
      ? 'unavailable'
      : !best ? 'missing' : best.label === 'strong' ? 'covered' : 'partial';
    return {
      coverageId: coverage.coverageId,
      roleIntentId: coverage.roleIntentId || null,
      label: normalizeText(roleEvidenceById.get(coverage.roleIntentId)?.roleIntent || 'Role focus'),
      status,
      answerCount: aligned.length,
      bestScore: best?.score ?? null,
    };
  });
  return {
    total: items.length,
    covered: items.filter((item) => item.status === 'covered').length,
    partial: items.filter((item) => item.status === 'partial').length,
    missing: items.filter((item) => item.status === 'missing').length,
    unavailable: items.filter((item) => item.status === 'unavailable').length,
    items,
  };
};

const buildEvidenceUsageMap = ({ alignments = [], evidenceIndex = new Map() } = {}) => {
  const usage = new Map();
  alignments.forEach((alignment) => alignment.detectedEvidenceUsed.forEach((detected) => {
    const current = usage.get(detected.evidenceId) || {
      evidenceId: detected.evidenceId,
      label: `Evidence for ${evidenceIndex.get(detected.evidenceId)?.mapItem?.roleIntent || 'this role'}`,
      useCount: 0,
      angles: [],
    };
    current.useCount += 1;
    current.angles = unique([...current.angles, detected.angleUsed]);
    usage.set(detected.evidenceId, current);
  }));
  const items = [...usage.values()];
  return { totalUses: items.reduce((sum, item) => sum + item.useCount, 0), items };
};

export const buildRoleFitReportSummary = ({
  questionAnswerPairs = [],
  interviewPlan = {},
  analysisResult = {},
  session = {},
} = {}) => {
  const proofStrategy = interviewPlan.roleFit?.proofStrategy || {};
  const hasRoleFitContract = ensureArray(proofStrategy.mustCover).length > 0;
  if (!hasRoleFitContract) {
    return {
      schemaVersion: 'role_fit_report_v1',
      status: 'legacy',
      answerAlignments: [],
      roleIntentCoverage: { total: 0, covered: 0, partial: 0, missing: 0, unavailable: 0, items: [] },
      evidenceUsageMap: { totalUses: 0, items: [] },
      questionReasoning: [],
      ownership: { verified: false, source: 'legacy_snapshot' },
      knownRoleIntentIds: [],
      knownEvidenceIds: [],
      requiredCoverageIds: [],
      companyClaims: [],
    };
  }

  const answerAlignments = buildAnswerAlignments({ questionAnswerPairs, interviewPlan, analysisResult });
  const roleEvidenceMap = analysisResult.roleEvidenceMap || {};
  const evidenceIndex = buildEvidenceIndex(roleEvidenceMap);
  const roleIntentCoverage = buildRoleIntentCoverage({ proofStrategy, alignments: answerAlignments, roleEvidenceMap });
  const evidenceUsageMap = buildEvidenceUsageMap({ alignments: answerAlignments, evidenceIndex });
  const poolById = new Map(ensureArray(interviewPlan.questionPool).map((item) => [item.questionId, item]));
  const questionReasoning = answerAlignments.map((alignment) => {
    const pair = questionAnswerPairs.find((item) => item.questionId === alignment.questionId);
    const poolItem = poolById.get(getPreparedQuestionId(pair?.questionTurn)) || {};
    return {
      questionId: alignment.questionId,
      topic: normalizeText(poolItem.topic || alignment.topic || alignment.roleIntentLabels[0] || 'Role fit'),
      reason: alignment.roleIntentLabels.length
        ? `This question checked ${alignment.roleIntentLabels.join(' and ')}.`
        : 'This question checked an important part of the role.',
    };
  });
  const hasUnavailable = proofStrategy.artifactStatus !== 'ready' || !answerAlignments.length;
  const hasLimits = answerAlignments.some((item) => item.groundingStatus !== 'grounded')
    || roleIntentCoverage.partial > 0
    || roleIntentCoverage.missing > 0
    || roleIntentCoverage.unavailable > 0;

  return {
    schemaVersion: 'role_fit_report_v1',
    status: hasUnavailable ? 'unavailable' : hasLimits ? 'limited' : 'ready',
    answerAlignments,
    roleIntentCoverage,
    evidenceUsageMap,
    questionReasoning,
    ownership: { verified: Boolean(session.id && session.userId), source: 'session_owner' },
    knownRoleIntentIds: unique(ensureArray(roleEvidenceMap.items).map((item) => item.roleIntentId)),
    knownEvidenceIds: unique([...evidenceIndex.keys()]),
    requiredCoverageIds: unique(ensureArray(proofStrategy.mustCover).map((item) => item.coverageId)),
    companyClaims: [],
  };
};
