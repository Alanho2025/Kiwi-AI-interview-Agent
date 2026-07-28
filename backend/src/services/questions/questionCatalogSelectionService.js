import { normalizeSeniorityLevelKey } from '../../config/interviewBlueprints.js';
import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';
import { stableQuestionId } from './questionArtifactHelpers.js';
import { resolveAiDeliverySignalProfile } from './questionCatalogService.js';

const SOFTWARE_ROLE_FAMILIES = new Set(['software', 'software_development', 'software_engineering', 'frontend', 'backend', 'devops']);
const DATA_ROLE_FAMILIES = new Set(['data', 'data_science', 'analytics', 'data_engineering']);
const ML_ROLE_FAMILIES = new Set(['ml', 'ai_ml', 'machine_learning', 'data_science']);
const AI_SECOND_FAMILIES = new Set(['prompt_and_context_design', 'rag_retrieval_design', 'agent_reliability_and_safety', 'ai_evaluation_and_cost']);
const DIGITAL_ROLE_SIGNALS = /\b(digital|software|data|analytics|product|technology|automation|e-?commerce|platform|online|systems?)\b/;

const resolveTargetLevel = (value = '') => normalizeSeniorityLevelKey(value);

const buildRoleText = (analysisResult = {}) => [
  analysisResult.jobTitle,
  analysisResult.targetRole,
  analysisResult?.parsedJdProfile?.title,
  analysisResult?.parsedJdProfile?.jobTitle,
  analysisResult?.parsedJdProfile?.rawJD,
  analysisResult?.parsedJdProfile?.rawText,
  analysisResult?.parsedJdProfile?.requirements?.join?.(' '),
].filter(Boolean).join(' ');

const resolveRoleFamily = ({ analysisResult = {}, signalProfile = {} } = {}) => {
  const rawFamily = normalizeKey(analysisResult?.parsedJdProfile?.roleFamily || analysisResult?.roleFamily || '');
  const roleText = normalizeKey(buildRoleText(analysisResult));
  if (/ai solution|ai engineer|llm engineer|applied ai|generative ai/.test(roleText)) return 'ai_solution';
  if (signalProfile.hasMlSignal && /machine learning|ml engineer|data scientist/.test(roleText)) return 'ml';
  if (ML_ROLE_FAMILIES.has(rawFamily)) return signalProfile.hasMlSignal ? 'ml' : 'ai_solution';
  if (SOFTWARE_ROLE_FAMILIES.has(rawFamily)) return 'software';
  if (DATA_ROLE_FAMILIES.has(rawFamily)) return 'data';
  if (/software|frontend|backend|developer|programmer|devops/.test(roleText)) return 'software';
  if (/data analyst|analytics|data engineer/.test(roleText)) return 'data';
  return 'non_tech';
};

const collectCandidateEvidenceText = (value) => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectCandidateEvidenceText);
  if (!value || typeof value !== 'object') return [];
  return [
    value.title,
    value.role,
    value.summary,
    value.description,
    value.details,
    value.rawText,
    value.text,
  ].filter((item) => typeof item === 'string');
};

const deriveExplicitCandidateSignals = (analysisResult = {}) => {
  const cvProfile = analysisResult?.parsedCvProfile || {};
  const candidateEvidenceText = [
    cvProfile.summary,
    cvProfile.personalStatement,
    cvProfile.experience,
    cvProfile.education,
    cvProfile.projects,
    cvProfile.evidenceProfile?.sections?.experience,
    cvProfile.evidenceProfile?.sections?.education,
    cvProfile.evidenceProfile?.sections?.projects,
  ].flatMap(collectCandidateEvidenceText).join(' ').toLowerCase();
  const signals = [];
  if (/\b(hardware engineer|embedded systems?|electronics engineer|electrical engineer|firmware engineer)\b/.test(candidateEvidenceText)) {
    signals.push('hardware_to_ai_solution');
  }
  if (/\b(new zealand|aotearoa)\b/.test(candidateEvidenceText) && /\b(study|studied|studying|education|university|work|worked|working|employment|career)\b/.test(candidateEvidenceText)) {
    signals.push('nz_study_or_work');
  }
  return signals;
};

export const resolveCatalogSelectionContext = ({ analysisResult = {}, settings = {}, explicitCandidateSignals = [] } = {}) => {
  const roleText = buildRoleText(analysisResult);
  const signalProfile = resolveAiDeliverySignalProfile({ text: roleText });
  const normalizedRoleText = normalizeKey(roleText);
  return {
    roleFamily: resolveRoleFamily({ analysisResult, signalProfile }),
    targetLevel: resolveTargetLevel(settings.seniorityLevel || settings.level || 'junior'),
    focusArea: normalizeKey(settings.focusArea || settings.questionType || 'combined').replace('behavioral', 'behavioural'),
    questionLimit: Number(settings.questionLimit || settings.totalQuestions || 8),
    signalProfile,
    hasAiOrDigitalSignal: signalProfile.strongestSignal !== 'none' || DIGITAL_ROLE_SIGNALS.test(normalizedRoleText),
    explicitCandidateSignals: new Set([
      ...ensureArray(explicitCandidateSignals),
      ...deriveExplicitCandidateSignals(analysisResult),
    ].map(normalizeKey)),
  };
};

export const resolveCatalogQuestionEligibility = ({ catalogItem = {}, selectionContext = {} } = {}) => {
  const reasons = [];
  const roleEligibility = catalogItem.roleEligibility || {};
  if (catalogItem.lifecycle !== 'approved') return { eligible: false, reasons: ['catalog_lifecycle_not_approved'] };
  if (!ensureArray(catalogItem.targetLevels).includes(selectionContext.targetLevel)) return { eligible: false, reasons: ['target_level_not_supported'] };
  const allowedRoleFamilies = ensureArray(roleEligibility.roleFamilies).map(normalizeKey).filter(Boolean);
  if (allowedRoleFamilies.length && !allowedRoleFamilies.includes('general') && !allowedRoleFamilies.includes(selectionContext.roleFamily)) {
    return { eligible: false, reasons: ['role_family_not_eligible'] };
  }
  const missingCandidateSignal = ensureArray(roleEligibility.requiredCandidateSignals)
    .map(normalizeKey)
    .find((signal) => !selectionContext.explicitCandidateSignals?.has(signal));
  if (missingCandidateSignal) return { eligible: false, reasons: [`missing_explicit_candidate_signal:${missingCandidateSignal}`] };
  if (roleEligibility.requiresExplicitAiDelivery && !selectionContext.signalProfile?.explicitAiDelivery) {
    return { eligible: false, reasons: ['explicit_ai_delivery_not_confirmed'] };
  }
  if (roleEligibility.requiresAiOrDigitalSignal && !selectionContext.hasAiOrDigitalSignal) {
    return { eligible: false, reasons: ['ai_or_digital_signal_not_confirmed'] };
  }
  if (roleEligibility.requiresMlSignal && !selectionContext.signalProfile?.hasMlSignal) {
    return { eligible: false, reasons: ['ml_signal_not_confirmed'] };
  }
  reasons.push(`role_family:${selectionContext.roleFamily}`, `target_level:${selectionContext.targetLevel}`);
  if (selectionContext.signalProfile?.explicitAiDelivery) reasons.push('explicit_ai_delivery');
  if (selectionContext.hasAiOrDigitalSignal) reasons.push('ai_or_digital_signal');
  return { eligible: true, reasons };
};

const selectPrompt = (catalogItem = {}, targetLevel = '') => {
  const promptVariants = ensureArray(catalogItem.promptVariants)
    .filter((variant) => normalizeText(variant?.text));
  return promptVariants.find((variant) => ensureArray(variant.targetLevels).includes(targetLevel))
    || promptVariants.find((variant) => ensureArray(variant.targetLevels).length === 0)
    || null;
};

const resolveSnapshotPolicy = ({ catalogItem = {}, selectionContext = {} } = {}) => {
  const selectionPolicy = { ...(catalogItem.selectionPolicy || {}) };
  if (selectionContext.questionLimit < 8) {
    return { ...selectionPolicy, minAsked: 0, reservationPriority: 0, coverageSlot: null };
  }
  if (catalogItem.questionFamily === 'ai_assisted_delivery') {
    if (selectionContext.roleFamily === 'ai_solution' && selectionContext.signalProfile?.explicitAiDelivery) {
      return { ...selectionPolicy, coverageSlot: 'ai_solution_delivery', minAsked: 1, reservationPriority: 100 };
    }
    if (['software', 'data'].includes(selectionContext.roleFamily)) {
      return { ...selectionPolicy, coverageSlot: 'software_ai_workflow', minAsked: 1, reservationPriority: 90 };
    }
  }
  if (selectionContext.roleFamily === 'ai_solution' && selectionContext.signalProfile?.explicitAiDelivery && AI_SECOND_FAMILIES.has(catalogItem.questionFamily)) {
    return { ...selectionPolicy, coverageSlot: 'ai_solution_second_family', minAsked: 1, reservationPriority: 80 };
  }
  if (selectionContext.roleFamily === 'ml' && ['ml_problem_framing', 'ml_data_and_evaluation'].includes(catalogItem.questionFamily)) {
    return { ...selectionPolicy, coverageSlot: 'ml_foundation', minAsked: 1, reservationPriority: 85 };
  }
  if (selectionContext.roleFamily === 'ml' && selectionContext.targetLevel === 'senior' && catalogItem.questionFamily === 'ml_delivery_and_monitoring') {
    return { ...selectionPolicy, coverageSlot: 'ml_operations', minAsked: 1, reservationPriority: 55 };
  }
  return selectionPolicy;
};

export const buildCatalogQuestionSnapshots = ({ catalogItems = [], context = {} } = {}) => {
  const selectionContext = resolveCatalogSelectionContext(context);
  const items = [];
  const rejected = [];
  ensureArray(catalogItems).forEach((catalogItem) => {
    const eligibility = resolveCatalogQuestionEligibility({ catalogItem, selectionContext });
    if (!eligibility.eligible) {
      rejected.push({ catalogQuestionId: catalogItem?.catalogQuestionId || null, reason: eligibility.reasons[0] || 'not_eligible' });
      return;
    }
    const prompt = selectPrompt(catalogItem, selectionContext.targetLevel);
    if (!prompt) {
      rejected.push({ catalogQuestionId: catalogItem.catalogQuestionId, reason: 'missing_prompt_variant' });
      return;
    }
    const selectionPolicy = resolveSnapshotPolicy({ catalogItem, selectionContext });
    items.push({
      userId: context.userId,
      sessionId: context.sessionId,
      questionId: stableQuestionId('catalogq', [context.sessionId, catalogItem.catalogVersion, catalogItem.catalogQuestionId]),
      schemaVersion: 'v4',
      sourceStage: 'catalog',
      sourceType: 'question_catalog',
      questionRole: 'root_question',
      category: catalogItem.category || 'technical',
      stage: catalogItem.category || 'technical',
      topic: catalogItem.questionFamily,
      competency: catalogItem.competency,
      questionIntent: catalogItem.questionType,
      questionFamily: catalogItem.questionFamily,
      questionType: catalogItem.questionType,
      text: prompt.text,
      fallbackText: prompt.text,
      expectedSignal: ensureArray(catalogItem.expectedSignals),
      evidenceNeed: ensureArray(catalogItem.expectedSignals),
      priorityWeight: 0.55,
      coverageWeight: selectionPolicy.minAsked > 0 ? 0.9 : 0.55,
      riskWeight: 0.45,
      modeCompatibility: { technical: true, behavioural: catalogItem.category === 'behavioural', combined: true },
      catalogQuestionId: catalogItem.catalogQuestionId,
      catalogVersion: catalogItem.catalogVersion,
      catalogLifecycle: catalogItem.lifecycle,
      targetLevel: selectionContext.targetLevel,
      testedSignals: ensureArray(catalogItem.expectedSignals),
      eligibilityReason: eligibility.reasons,
      selectionPolicy,
      coverageSlot: selectionPolicy.coverageSlot || null,
      ambiguityMode: catalogItem.ambiguityPolicy?.mode || 'none',
      reportDimensions: ensureArray(catalogItem.reportDimensions),
      containsSensitiveData: true,
      accessScope: 'private',
      metadata: { catalogPromptVariantId: prompt.id || 'default' },
    });
  });
  return { items, rejected, selectionContext };
};

const getAskedSlotCounts = (transcript = []) => ensureArray(transcript)
  .filter((turn) => turn?.role === 'ai' && turn?.metadata?.countsAsQuestion !== false)
  .reduce((counts, turn) => {
    const slot = turn.metadata?.coverageSlot || turn.metadata?.questionDecision?.coverageSlot;
    if (slot) counts[slot] = (counts[slot] || 0) + 1;
    return counts;
  }, {});

export const resolveCatalogCoverageExpectations = ({ selectionContext = {} } = {}) => {
  if (Number(selectionContext.questionLimit || 0) < 8) return [];
  if (selectionContext.roleFamily === 'ai_solution' && selectionContext.signalProfile?.explicitAiDelivery) {
    return [
      {
        coverageSlot: 'ai_solution_delivery',
        questionFamily: 'ai_assisted_delivery',
        minAsked: 1,
        maxAsked: 1,
        reservationPriority: 100,
      },
      {
        coverageSlot: 'ai_solution_second_family',
        questionFamily: 'ai_solution_specialist',
        minAsked: 1,
        maxAsked: 1,
        reservationPriority: 80,
      },
    ];
  }
  if (['software', 'data'].includes(selectionContext.roleFamily)) {
    return [{
      coverageSlot: 'software_ai_workflow',
      questionFamily: 'ai_assisted_delivery',
      minAsked: 1,
      maxAsked: 1,
      reservationPriority: 90,
    }];
  }
  if (selectionContext.roleFamily === 'ml') {
    return [
      {
        coverageSlot: 'ml_foundation',
        questionFamily: 'ml_foundation',
        minAsked: 1,
        maxAsked: 1,
        reservationPriority: 85,
      },
      ...(selectionContext.targetLevel === 'senior'
        ? [{
            coverageSlot: 'ml_operations',
            questionFamily: 'ml_delivery_and_monitoring',
            minAsked: 1,
            maxAsked: 1,
            reservationPriority: 55,
          }]
        : []),
    ];
  }
  return [];
};

const isApprovedCatalogPoolItem = (item = {}) => (
  Boolean(item.catalogQuestionId) && ['approved'].includes(item.catalogLifecycle || item.lifecycle)
);

export const resolveCatalogReservationPlan = ({
  poolItems = [],
  session = {},
  selectionContext = null,
  catalogStatus = null,
} = {}) => {
  const askedSlotCounts = getAskedSlotCounts(session.transcript);
  const candidatesBySlot = new Map();
  ensureArray(poolItems).filter((item) => item?.coverageSlot && item?.catalogLifecycle === 'approved').forEach((item) => {
    const entry = candidatesBySlot.get(item.coverageSlot) || [];
    entry.push(item);
    candidatesBySlot.set(item.coverageSlot, entry);
  });
  const approvedCatalogPoolItems = ensureArray(poolItems).filter(isApprovedCatalogPoolItem);
  const resolvedSelectionContext = selectionContext || resolveCatalogSelectionContext({
    analysisResult: session.analysisResult || {},
    settings: {
      ...(session.settings || {}),
      questionLimit: session.questionLimit || session.totalQuestions || session.settings?.questionLimit,
    },
  });
  const catalogIsActive = catalogStatus === 'ready' || approvedCatalogPoolItems.length > 0;
  const expectations = catalogIsActive
    ? resolveCatalogCoverageExpectations({ selectionContext: resolvedSelectionContext })
    : [];
  const expectationsBySlot = new Map(expectations.map((expectation) => [expectation.coverageSlot, expectation]));
  const allCoverageSlots = new Set([...candidatesBySlot.keys(), ...expectationsBySlot.keys()]);
  const remainingQuestionSlots = Math.max(0, Number(session.questionLimit || session.totalQuestions || 8) - Number(session.currentQuestionIndex || 1) + 1);
  const reservations = [...allCoverageSlots].map((coverageSlot) => {
    const candidates = candidatesBySlot.get(coverageSlot) || [];
    const expectation = expectationsBySlot.get(coverageSlot) || {};
    const policy = candidates[0]?.selectionPolicy || expectation;
    const minAsked = Math.max(0, Number(expectation.minAsked ?? policy.minAsked) || 0);
    const askedCount = askedSlotCounts[coverageSlot] || 0;
    const hasEligibleCandidate = candidates.length > 0;
    const status = askedCount >= minAsked ? 'covered' : hasEligibleCandidate ? 'pending' : 'degraded';
    const unmetCount = Math.max(0, minAsked - askedCount);
    return {
      coverageSlot,
      questionFamily: candidates[0]?.questionFamily || expectation.questionFamily || null,
      minAsked,
      maxAsked: Math.max(minAsked, Number(expectation.maxAsked ?? policy.maxAsked) || minAsked),
      askedCount,
      candidateQuestionIds: candidates.map((item) => item.questionId),
      reservationPriority: Number(expectation.reservationPriority ?? policy.reservationPriority) || 0,
      status,
      degradedReason: status === 'degraded' ? 'required_coverage_has_no_eligible_question' : null,
      isUrgent: status === 'pending' && remainingQuestionSlots <= unmetCount + 2,
    };
  }).sort((left, right) => right.reservationPriority - left.reservationPriority || left.coverageSlot.localeCompare(right.coverageSlot));
  return { reservations, remainingQuestionSlots };
};

export const restrictCandidatesToUrgentReservations = ({ candidates = [], reservationPlan = {} } = {}) => {
  const urgent = ensureArray(reservationPlan.reservations).find((item) => item.status === 'pending' && item.isUrgent && item.candidateQuestionIds.length > 0);
  if (!urgent) return { candidates, activeReservation: null };
  const allowedIds = new Set(urgent.candidateQuestionIds);
  return {
    candidates: ensureArray(candidates).filter((item) => allowedIds.has(item.questionId)),
    activeReservation: urgent,
  };
};

export const buildCatalogCoverageOutcome = ({
  poolItems = [],
  session = {},
  completedBecause = null,
} = {}) => {
  const reservationPlan = resolveCatalogReservationPlan({ poolItems, session });
  const requiredReservations = reservationPlan.reservations.filter((reservation) => reservation.minAsked > 0);
  if (!requiredReservations.length) {
    return {
      status: 'not_applicable',
      completedBecause,
      reservations: [],
    };
  }
  const reservations = requiredReservations.map((reservation) => (
    reservation.status === 'pending'
      ? {
          ...reservation,
          status: 'degraded',
          degradedReason: 'session_ended_before_required_coverage',
        }
      : reservation
  ));
  return {
    status: reservations.some((reservation) => reservation.status === 'degraded')
      ? 'coverage_degraded'
      : 'covered',
    completedBecause,
    reservations,
  };
};

export const buildFollowUpVsNextRootComparison = ({
  answerSignals = {},
  nextRootCandidate = null,
  reservationPlan = {},
  targetLevel = 'junior',
  followUpIntent = null,
} = {}) => {
  const missingEvidence = ensureArray(answerSignals.missingEvidence);
  const urgentReservation = ensureArray(reservationPlan.reservations).find((item) => item.status === 'pending' && item.isUrgent);
  const shallowAnswerBoost = answerSignals.isShallow ? 0.45 : 0;
  const followUpValue = Number((
    0.35
    + Math.min(0.4, missingEvidence.length * 0.15)
    + shallowAnswerBoost
    + (targetLevel === 'senior' && missingEvidence.includes('tradeoff_or_constraint') ? 0.2 : 0)
  ).toFixed(3));
  const normalizedNextRootScore = Math.max(0, Math.min(1, Number(nextRootCandidate?.score) || 0));
  const nextRootValue = Number((normalizedNextRootScore + (urgentReservation ? 1 : 0)).toFixed(3));
  const decision = urgentReservation || followUpValue <= nextRootValue ? 'next_root' : 'follow_up';
  return {
    followUpValue,
    nextRootValue,
    decision,
    reason: urgentReservation ? 'pending_coverage_reservation' : decision === 'follow_up' ? 'evidence_deficit_outweighs_next_root' : 'next_root_opportunity_cost',
    missingEvidence,
    followUpIntent,
  };
};
