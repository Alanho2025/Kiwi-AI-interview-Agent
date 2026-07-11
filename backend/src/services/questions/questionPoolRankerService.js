import { ensureArray, normalizeKey } from '../../utils/commonHelpers.js';
import { normalizeCategory } from './questionArtifactHelpers.js';
import { buildQuestionHistory, filterNovelQuestionCandidates } from './questionDeduplicationService.js';
import { trackInterviewCoverage } from './interviewCoverageContractService.js';
import { getEvidenceUsageCounts } from './evidenceUsageLedgerService.js';

const weight = (value, fallback = 0.5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

const countHiringLogicLinks = (coverage = {}) => [
  ...ensureArray(coverage.businessProblemIds),
  ...ensureArray(coverage.workflowPainPointIds),
  ...ensureArray(coverage.idealCandidateSignalIds),
  ...ensureArray(coverage.interviewProbeIds),
].filter(Boolean).length;

const topicMatches = (topic = '', values = []) => {
  const topicKey = normalizeKey(topic);
  if (!topicKey) return false;
  return ensureArray(values).some((value) => {
    const key = normalizeKey(value);
    return key && (topicKey.includes(key) || key.includes(topicKey));
  });
};

const getAskedTopicKeys = (session = {}) => new Set(ensureArray(session.transcript)
  .filter((turn) => turn.role === 'ai')
  .map((turn) => normalizeKey(turn.metadata?.topic || turn.metadata?.questionDecision?.topic || turn.text))
  .filter(Boolean));

const computeModeFit = (item = {}, focusArea = 'combined') => {
  const category = normalizeCategory(item.category || item.stage);
  const compatibility = item.modeCompatibility || {};
  const normalizedFocus = normalizeKey(focusArea).replace('behavioral', 'behavioural');
  if (!normalizedFocus || normalizedFocus === 'combined') return 1;
  if (compatibility[normalizedFocus] === true) return 1;
  if (normalizedFocus === 'technical') return category === 'technical' || category === 'role_competency' ? 1 : 0;
  if (normalizedFocus === 'behavioural') return category === 'behavioural' ? 1 : 0;
  return 0.7;
};

const computeTimeFit = (session = {}) => {
  const remaining = Number(session.questionLimit || session.totalQuestions || 8) - Number(session.currentQuestionIndex || 1);
  if (remaining <= 1) return 0.9;
  if (remaining <= 3) return 0.7;
  return 0.5;
};

const scorePoolItem = ({ 
  item, 
  session, 
  decisionContext, 
  evaluatorState, 
  actionInput, 
  askedTopicKeys,
  trackedMustCover = [],
  evidenceCounts = {},
}) => {
  const focusArea = decisionContext?.interviewStructure?.focusAreaKey || session?.settings?.focusArea || actionInput?.category || 'combined';
  const modeFit = computeModeFit(item, focusArea);
  const missingEvidenceFit = topicMatches(item.topic, decisionContext?.coverageState?.missingTopics)
    || topicMatches(item.topic, decisionContext?.matchState?.validationTargets)
    ? 1
    : 0.35;
  const freshnessScore = askedTopicKeys.has(normalizeKey(item.topic)) ? 0 : 1;
  const timeFit = computeTimeFit(session);
  const repetitionPenalty = askedTopicKeys.has(normalizeKey(item.topic)) ? 0.35 : 0;
  const answeredPenalty = item.status === 'asked' ? 2 : 0;
  const selectedTopicFit = actionInput?.targetTopic && topicMatches(item.topic, [actionInput.targetTopic]) ? 0.18 : 0;
  const validationFit = actionInput?.actionType === 'ASK_VALIDATION_QUESTION' && ['match_gap', 'match_validation'].includes(item.sourceStage) ? 0.2 : 0;

  const roleIntentCoverageBoost = ensureArray(item.testedRoleIntentIds).length ? 0.10 : 0;
  const unmetCoverage = trackedMustCover.find(cov => 
    cov.status === 'pending' && 
    (cov.coverageId === item.proofPointId || (cov.roleIntentId && ensureArray(item.testedRoleIntentIds).includes(cov.roleIntentId)))
  );
  const unmetCoverageBoost = unmetCoverage ? 0.25 : 0;
  const evidenceMapStrengthBoost = weight(item.evidenceMapStrength, 0) * 0.10;
  const hasSpecificProofAngle = Boolean(item.preparationGuidance?.proofAngle || item.evidenceAngle)
    && !['technical_ownership', 'behavioural', 'gap_validation'].includes(item.evidenceAngle);
  const proofAngleFitBoost = hasSpecificProofAngle ? 0.06 : 0;
  const hiringLogicLinkBoost = Math.min(0.08, countHiringLogicLinks(item.hiringLogicCoverage) * 0.02);

  // Gap risk boost
  let gapRiskBoost = 0;
  if (item.sourceStage === 'match_gap' || item.coveragePriority === 'should_cover') {
    gapRiskBoost = 0.20;
  }

  // Evidence overuse penalty
  let evidenceOverusePenalty = 0;
  ensureArray(item.recommendedEvidenceIds).forEach(evId => {
    const count = evidenceCounts[evId] || 0;
    if (count >= 2) {
      evidenceOverusePenalty += 0.35 * (count - 1);
    }
  });

  const baseScore = (
    weight(item.priorityWeight) * 0.30
    + weight(item.coverageWeight) * 0.20
    + weight(item.riskWeight) * 0.15
    + modeFit * 0.15
    + missingEvidenceFit * 0.10
    + freshnessScore * 0.05
    + timeFit * 0.05
    + selectedTopicFit
    + validationFit
    - repetitionPenalty
    - answeredPenalty
  );
  const roleFitAdjustment = {
    roleIntentCoverageBoost,
    evidenceMapStrengthBoost,
    unmetCoverageBoost,
    gapRiskBoost,
    proofAngleFitBoost,
    hiringLogicLinkBoost,
    evidenceOverusePenalty,
  };
  roleFitAdjustment.total = Number((
    roleIntentCoverageBoost
    + evidenceMapStrengthBoost
    + unmetCoverageBoost
    + gapRiskBoost
    + proofAngleFitBoost
    + hiringLogicLinkBoost
    - evidenceOverusePenalty
  ).toFixed(3));
  const normalizedBaseScore = Number(baseScore.toFixed(3));
  const score = Number((normalizedBaseScore + roleFitAdjustment.total).toFixed(3));

  const reasons = [];
  const penalties = [];
  if (modeFit > 0) reasons.push(`mode_fit:${focusArea}`);
  if (missingEvidenceFit >= 1) reasons.push('matches_missing_or_validation_target');
  if (selectedTopicFit) reasons.push('matches_action_topic');
  if (validationFit) reasons.push('validation_action_fit');
  if (freshnessScore === 1) reasons.push('fresh_topic');
  if (roleIntentCoverageBoost > 0) reasons.push('role_intent_coverage_boost');
  if (evidenceMapStrengthBoost > 0) reasons.push('evidence_map_strength_boost');
  if (unmetCoverageBoost > 0) reasons.push('unmet_must_cover_boost');
  if (gapRiskBoost > 0) reasons.push('gap_validation_boost');
  if (proofAngleFitBoost > 0) reasons.push('proof_angle_fit_boost');
  if (hiringLogicLinkBoost > 0) reasons.push('hiring_logic_link_boost');
  
  if (repetitionPenalty) penalties.push('repeated_topic');
  if (answeredPenalty) penalties.push('already_asked');
  if (modeFit === 0) penalties.push(`mode_mismatch:${focusArea}`);
  if (evidenceOverusePenalty > 0) penalties.push('evidence_overuse_penalty');

  const rankTrace = {
    questionId: item.questionId,
    score,
    baseScore: normalizedBaseScore,
    roleFitAdjustment,
    reasons,
    penalties,
    matchedSignals: [
      ...(missingEvidenceFit >= 1 ? ['missing_evidence_or_validation_target'] : []),
      ...(evaluatorState?.interactionStatus ? [`interaction:${evaluatorState.interactionStatus}`] : []),
      ...(unmetCoverageBoost > 0 ? ['unmet_must_cover'] : []),
    ],
    sourceType: item.sourceType,
    topic: item.topic,
    category: item.category,
    proofPointId: item.proofPointId || '',
    testedRoleIntentIds: item.testedRoleIntentIds || [],
    recommendedEvidenceIds: item.recommendedEvidenceIds || [],
    evidenceAngle: item.evidenceAngle || '',
    preparationGuidance: item.preparationGuidance || null,
    hiringLogicCoverage: item.hiringLogicCoverage || {},
  };

  return {
    ...item,
    score,
    reasons,
    penalties,
    matchedSignals: rankTrace.matchedSignals,
    rankTrace,
  };
};

export const rankPreparedQuestionPool = ({ poolItems = [], session = {}, decisionContext = {}, evaluatorState = {}, actionInput = {} } = {}) => {
  const askedTopicKeys = getAskedTopicKeys(session);
  const historyStartedAt = Date.now();
  const history = buildQuestionHistory(session.transcript);
  const dedupeIndexBuildMs = Date.now() - historyStartedAt;
  const filterStartedAt = Date.now();
  const novelty = filterNovelQuestionCandidates({ candidates: poolItems, history });
  const candidateNoveltyFilterMs = Date.now() - filterStartedAt;

  // Reconcile Role-Fit coverage and evidence ledger
  const proofStrategy = session?.interviewPlan?.roleFit?.proofStrategy || {};
  let trackedMustCover = [];
  let evidenceCounts = {};
  if (proofStrategy?.mustCover) {
    trackedMustCover = trackInterviewCoverage({
      proofStrategy,
      transcript: session.transcript || [],
      poolItems,
    });
    const ledger = getEvidenceUsageCounts({ transcript: session.transcript || [] });
    evidenceCounts = ledger.evidenceCounts || {};
  }

  const ranked = ensureArray(novelty.accepted)
    .filter((item) => item && item.status !== 'suppressed' && item.status !== 'expired')
    .map((item) => scorePoolItem({ 
      item, 
      session, 
      decisionContext, 
      evaluatorState, 
      actionInput, 
      askedTopicKeys,
      trackedMustCover,
      evidenceCounts,
    }))
    .sort((a, b) => b.score - a.score);
  ranked.rejectedCandidates = novelty.rejected;
  ranked.deduplication = { dedupeIndexBuildMs, candidateNoveltyFilterMs };
  return ranked;
};

export const selectBestPreparedQuestion = (rankedItems = [], options = {}) => {
  const minimumScore = Number(options.minimumScore ?? 0.25);
  return ensureArray(rankedItems).find((item) => item.status === 'active' && item.score >= minimumScore && !item.penalties?.some((penalty) => penalty.startsWith('mode_mismatch'))) || null;
};
