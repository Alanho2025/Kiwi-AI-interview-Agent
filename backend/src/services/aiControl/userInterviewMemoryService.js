import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { ensureArray } from '../../utils/commonHelpers.js';

export const USER_INTERVIEW_MEMORY_POLICY_VERSION = 'user_interview_memory_v0';

const DEFAULT_FRESHNESS_DAYS = 90;
const MIN_INDEPENDENT_SESSIONS = 2;
const STRONG_EVIDENCE_THRESHOLD = 0.72;
const WEAK_EVIDENCE_THRESHOLD = 0.45;
const REVALIDATION_PRIORITY_BOOST = 0.18;

const toKey = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const asIsoString = (value, fallback) => {
  const parsed = new Date(value || fallback);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback).toISOString() : parsed.toISOString();
};

export const resolveAnalysisRoleKey = (analysis = {}) => toKey(
  analysis.matchingDetails?.questionPlanHints?.roleCanonical
  || analysis.parsedJdProfile?.roleCanonical
  || analysis.roleEvidenceMap?.roleCanonical
  || analysis.matchSummary?.jobTitle
);

const resolveEvidenceGainScore = (trajectory = {}) => Number(
  trajectory.evaluator?.evidenceGainScore
  ?? trajectory.plannerSignals?.evidenceGainScore
  ?? 0
);

const resolveSpecificity = (trajectory = {}) => String(
  trajectory.evaluator?.specificity
  || trajectory.plannerSignals?.specificity
  || 'unknown'
).toLowerCase();

const classifyStrength = ({ evidenceGainScore, specificity }) => {
  if (evidenceGainScore >= STRONG_EVIDENCE_THRESHOLD && ['high', 'medium'].includes(specificity)) return 'strong';
  if (evidenceGainScore < WEAK_EVIDENCE_THRESHOLD || specificity === 'low') return 'weak';
  return 'partial';
};

const classifyDepth = ({ evidenceGainScore, specificity }) => {
  if (evidenceGainScore >= 0.88 && specificity === 'high') return 'advanced';
  if (evidenceGainScore >= STRONG_EVIDENCE_THRESHOLD) return 'intermediate';
  return 'basic';
};

const toContribution = ({ analysis, trajectory, now }) => {
  const answeredQuestion = trajectory?.answeredQuestion;
  if (!answeredQuestion?.topic || !answeredQuestion?.questionFamily) return null;
  const roleKey = resolveAnalysisRoleKey(analysis);
  const competencyKey = toKey(answeredQuestion.topic);
  const questionFamilyKey = toKey(answeredQuestion.questionFamily);
  const evidenceGainScore = resolveEvidenceGainScore(trajectory);
  const specificity = resolveSpecificity(trajectory);
  const createdAt = asIsoString(trajectory.createdAt, analysis.updatedAt || now);
  return {
    contributionId: `user_interview:${analysis.sessionId}:${trajectory.trajectoryId || trajectory.workflowRunId}`,
    roleKey,
    competencyKey,
    questionFamilyKey,
    answerStrength: classifyStrength({ evidenceGainScore, specificity }),
    demonstratedDepth: classifyDepth({ evidenceGainScore, specificity }),
    evidenceGainScore,
    specificity,
    createdAt,
    source: {
      sessionId: analysis.sessionId,
      workflowRunId: trajectory.workflowRunId,
      trajectoryId: trajectory.trajectoryId || null,
      evidenceRefs: [
        `workflow_run:${trajectory.workflowRunId}`,
        ...(trajectory.trajectoryId ? [`trajectory:${trajectory.trajectoryId}`] : []),
      ],
    },
    policy: {
      canAffectPlanning: true,
      canAffectQuestionSelection: true,
      canAffectQuestionDepth: true,
      canSuppressRoutineRepeat: false,
      canAffectScoring: false,
      candidateVisible: false,
      sourceDeletePolicy: 'recompute',
    },
  };
};

const isSourceComplete = (contribution = {}) => Boolean(
  contribution?.roleKey
  && contribution?.competencyKey
  && contribution?.questionFamilyKey
  && contribution?.source?.sessionId
  && contribution?.source?.workflowRunId
);

const groupContributions = (contributions = []) => ensureArray(contributions).reduce((groups, contribution) => {
  const key = `${contribution.roleKey}|${contribution.competencyKey}|${contribution.questionFamilyKey}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(contribution);
  return groups;
}, new Map());

const daysBetween = (later, earlier) => (
  (new Date(later).getTime() - new Date(earlier).getTime()) / (24 * 60 * 60 * 1000)
);

const recommendedNextDepth = (contributions = []) => (
  contributions.some((item) => item.demonstratedDepth === 'advanced') ? 'advanced_plus' : 'advanced'
);

const isRoutineRootCandidate = (item = {}) => (
  item.questionRole === 'root_question'
  && !['opening', 'closing'].includes(toKey(item.category || item.stage))
);

const matchesMemoryTarget = (item = {}, memoryTarget = {}) => (
  toKey(item.topic) === toKey(memoryTarget.competencyKey)
  && toKey(item.questionFamily) === toKey(memoryTarget.questionFamilyKey)
);

export const applyUserInterviewMemoryQuestionPolicy = ({
  items = [],
  projection = null,
} = {}) => {
  const sourceItems = ensureArray(items);
  if (!projection?.planningEnabled || projection?.policy?.canAffectScoring !== false) {
    return {
      items: sourceItems,
      decision: { status: 'not_applied', reasonCode: 'planning_disabled_or_scoring_policy_invalid' },
    };
  }

  const suppressions = ensureArray(projection.routineRepeatSuppressions)
    .filter((item) => item?.canSuppressRoutineRepeat);
  const priorities = ensureArray(projection.routineRepeatPriorities);
  const suppressedItems = sourceItems.filter((item) => (
    isRoutineRootCandidate(item) && suppressions.some((target) => matchesMemoryTarget(item, target))
  ));
  const retainedItems = sourceItems.filter((item) => !suppressedItems.includes(item));
  let boostedRootCount = 0;
  const adjustedItems = retainedItems.map((item) => {
    const priority = priorities.find((target) => isRoutineRootCandidate(item) && matchesMemoryTarget(item, target));
    if (!priority) return item;
    boostedRootCount += 1;
    return {
      ...item,
      priorityWeight: Math.min(
        1,
        Number((Number(item.priorityWeight || 0) + REVALIDATION_PRIORITY_BOOST).toFixed(2)),
      ),
      crossSessionMemoryPolicy: {
        policyVersion: projection.policyVersion,
        reasonCode: priority.reasonCode,
        action: 'retain_and_boost_for_revalidation',
      },
    };
  });

  return {
    items: adjustedItems,
    decision: {
      status: 'applied',
      roleKey: projection.currentRoleKey,
      suppressedRootCount: suppressedItems.length,
      boostedRootCount,
      canAffectScoring: false,
    },
  };
};

export const buildUserInterviewMemoryProjection = ({
  analyses = [],
  currentRoleKey = '',
  planningEnabled = false,
  freshnessDays = DEFAULT_FRESHNESS_DAYS,
  now = new Date(),
} = {}) => {
  const normalizedRoleKey = toKey(currentRoleKey);
  const contributions = ensureArray(analyses)
    .flatMap((analysis) => ensureArray(analysis.trajectoryRecords)
      .map((trajectory) => toContribution({ analysis, trajectory, now })))
    .filter(isSourceComplete);
  const applicable = contributions.filter((item) => item.roleKey === normalizedRoleKey);
  const routineRepeatSuppressions = [];
  const routineRepeatPriorities = [];
  const revalidationDue = [];
  const gateResults = [];

  groupContributions(applicable).forEach((items) => {
    const first = items[0];
    const fresh = items.filter((item) => daysBetween(now, item.createdAt) <= freshnessDays);
    const independentSessionCount = new Set(fresh.map((item) => item.source.sessionId)).size;
    const strong = fresh.filter((item) => item.answerStrength === 'strong');
    const insufficient = fresh.filter((item) => ['weak', 'partial'].includes(item.answerStrength));
    const hasConflict = insufficient.length > 0 && strong.length > 0;
    const strongSessionCount = new Set(strong.map((item) => item.source.sessionId)).size;
    const canSuppress = strongSessionCount >= MIN_INDEPENDENT_SESSIONS && !hasConflict;
    let reasonCode = 'promotion_threshold_not_met';
    if (!fresh.length) reasonCode = 'memory_stale_revalidation_required';
    else if (hasConflict) reasonCode = 'conflicting_cross_session_evidence';
    else if (canSuppress) reasonCode = 'cross_session_evidence_promoted';

    gateResults.push({
      gateType: 'memory_promotion_applicability_freshness',
      roleKey: first.roleKey,
      competencyKey: first.competencyKey,
      questionFamilyKey: first.questionFamilyKey,
      status: canSuppress ? 'pass' : 'review',
      reasonCode,
      independentSessionCount,
      strongSessionCount,
      canAffectScoring: false,
    });

    if (canSuppress) {
      routineRepeatSuppressions.push({
        roleKey: first.roleKey,
        competencyKey: first.competencyKey,
        questionFamilyKey: first.questionFamilyKey,
        independentSessionCount,
        sourceEvidenceCount: strong.length,
        demonstratedDepth: strong.some((item) => item.demonstratedDepth === 'advanced') ? 'advanced' : 'intermediate',
        recommendedNextDepth: recommendedNextDepth(strong),
        canSuppressRoutineRepeat: true,
        sourceContributionRefs: strong.map((item) => item.contributionId),
      });
    } else {
      revalidationDue.push({
        roleKey: first.roleKey,
        competencyKey: first.competencyKey,
        questionFamilyKey: first.questionFamilyKey,
        reasonCode,
        independentSessionCount,
      });
    }

    if (insufficient.length) {
      routineRepeatPriorities.push({
        roleKey: first.roleKey,
        competencyKey: first.competencyKey,
        questionFamilyKey: first.questionFamilyKey,
        reasonCode: hasConflict ? 'conflicting_evidence_requires_revalidation' : 'weak_or_partial_evidence_requires_revalidation',
        independentSessionCount,
        sourceEvidenceCount: insufficient.length,
        canAffectScoring: false,
      });
    }
  });

  return {
    schemaVersion: 'user_interview_memory_projection_v0',
    policyVersion: USER_INTERVIEW_MEMORY_POLICY_VERSION,
    sourceKind: 'recomputable_session_analysis_projection',
    currentRoleKey: normalizedRoleKey,
    generatedAt: new Date(now).toISOString(),
    freshnessDays,
    minimumIndependentSessions: MIN_INDEPENDENT_SESSIONS,
    planningEnabled: Boolean(planningEnabled),
    contributions,
    routineRepeatSuppressions,
    routineRepeatPriorities,
    revalidationDue,
    gateResults,
    policy: {
      allowedReaders: ['decision_context_builder', 'action_planner', 'developer_harness_diagnostics'],
      canAffectPlanning: true,
      canAffectQuestionSelection: true,
      canAffectQuestionDepth: true,
      canSuppressRoutineRepeat: true,
      canAffectScoring: false,
      candidateVisible: false,
      sourceDeletePolicy: 'recompute',
    },
  };
};

const loadHistoricalAnalyses = ({ userId, currentSessionId }) => SessionAnalysis
  .find({ userId, sessionId: { $ne: currentSessionId }, deletedAt: null })
  .sort({ updatedAt: -1 })
  .limit(20)
  .lean();

const persistSessionProjection = ({ sessionId, projection }) => SessionAnalysis.findOneAndUpdate(
  { sessionId },
  { $set: { 'agentMemory.userInterviewProjection': projection } },
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
);

export const refreshUserInterviewMemoryProjection = async ({
  userId,
  currentSessionId,
  currentRoleKey,
  planningEnabled = false,
  now = new Date(),
  loadAnalyses = loadHistoricalAnalyses,
  persistProjection = persistSessionProjection,
} = {}) => {
  if (!userId || !currentSessionId) return null;
  if (!planningEnabled) return null;
  const analyses = await loadAnalyses({ userId, currentSessionId });
  const projection = buildUserInterviewMemoryProjection({
    analyses,
    currentRoleKey,
    planningEnabled,
    now,
  });
  await persistProjection({ sessionId: currentSessionId, projection });
  return projection;
};
