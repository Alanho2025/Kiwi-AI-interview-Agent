import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { CvQuestionSeed } from '../../db/models/cvQuestionSeedModel.js';
import { JdQuestionFilter } from '../../db/models/jdQuestionFilterModel.js';
import { InterviewQuestionPoolItem } from '../../db/models/interviewQuestionPoolItemModel.js';
import { ensureArray, normalizeKey } from '../../utils/commonHelpers.js';

const FIRST_SAMPLE_LIMIT = 3;
const SUMMARY_LIMIT = 8;

const shortList = (items = [], limit = SUMMARY_LIMIT) => ensureArray(items)
  .map((item) => {
    if (typeof item === 'string') return item;
    return item?.label || item?.skill || item?.requirement || item?.topic || item?.summary || item?.name || '';
  })
  .map((item) => String(item || '').trim())
  .filter(Boolean)
  .slice(0, limit);

const countBy = (items = [], key) => ensureArray(items).reduce((counts, item) => {
  const value = String(item?.[key] || 'unknown').trim() || 'unknown';
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {});

const isRootPoolItem = (item = {}) => {
  const role = normalizeKey(item.questionRole);
  return !role || role === 'root_question';
};

const findLatestAiTurn = (session = {}) => [...ensureArray(session.transcript)]
  .reverse()
  .find((turn) => turn?.role === 'ai') || null;

const buildCvSeedSamples = (seeds = []) => ensureArray(seeds)
  .slice(0, FIRST_SAMPLE_LIMIT)
  .map((seed) => ({
    seedId: seed.seedId || null,
    sourceType: seed.sourceType || null,
    category: seed.category || null,
    topic: seed.topic || null,
    questionIntent: seed.questionIntent || null,
    skillTags: shortList(seed.skillTags, 4),
    projectTags: shortList(seed.projectTags, 2),
  }));

const buildJdPrioritySummary = ({ jdFilter = null, session = {} } = {}) => {
  const hints = session?.analysisResult?.matchingDetails?.questionPlanHints || {};
  const parsedJd = session?.analysisResult?.parsedJdProfile || {};
  return {
    roleTitle: jdFilter?.roleCanonical || parsedJd.roleCanonical || hints.roleCanonical || session.targetRole || session.analysisResult?.jobTitle || null,
    priorityTechnicalSkills: shortList(jdFilter?.prioritySkills || parsedJd.technicalSkillRequirements || hints.mustProbeSkills),
    behaviouralPriorities: shortList(jdFilter?.behaviouralFocus || parsedJd.behaviouralFocus || parsedJd.softSkillRequirements || hints.mustProbeBehavioural),
    mustProbeRequirements: shortList(jdFilter?.mustHaveRequirements || session.analysisResult?.requirementChecks),
    questionPlanningHints: {
      priorityTopics: shortList(hints.priorityTopics),
      mustProbeSkills: shortList(hints.mustProbeSkills),
      mustProbeBehavioural: shortList(hints.mustProbeBehavioural),
    },
  };
};

const buildLatestTurnFields = (latestAiTurn = null) => {
  const metadata = latestAiTurn?.metadata || {};
  const decision = metadata.questionDecision || {};
  return {
    latestTurnKind: metadata.turnKind || decision.turnKind || metadata.questionType || null,
    latestScenario: metadata.scenario || decision.scenario || null,
    latestPreparedQuestionId: decision.preparedQuestionId || metadata.preparedQuestionId || null,
    latestParentQuestionId: metadata.parentQuestionId || decision.parentQuestionId || null,
    latestFollowUpIntent: metadata.followUpIntent || decision.followUpIntent || null,
    latestSelectionSource: metadata.selectionSource || decision.selectionSource || null,
    latestSelectionReason: decision.rankTrace?.selectionReason || decision.selectionReason || null,
    latestMatchGapId: decision.matchGapId || metadata.matchGapId || null,
  };
};

const buildMatchGapSamples = (matchGaps = []) => ensureArray(matchGaps)
  .slice(0, FIRST_SAMPLE_LIMIT)
  .map((item) => ({
    matchGapId: item.matchGapId || null,
    topic: item.topic || null,
    sourceStage: item.sourceStage || item.sourceType || null,
    selectionReason: item.rankTrace?.selectionReason || null,
    rankTrace: item.rankTrace || null,
  }));

const buildMemoryDiagnostics = ({ sessionAnalysis = null } = {}) => {
  const controller = sessionAnalysis?.controllerState || {};
  const memoryPolicy = controller.memoryLoadPolicy || {};
  return {
    sessionMemoryLoaded: Boolean(sessionAnalysis?.agentMemory && Object.keys(sessionAnalysis.agentMemory).length),
    sessionMemoryTopicHistoryCount: ensureArray(controller.coverageState?.coveredTopics).length,
    sessionMemoryEvidenceGapCount: ensureArray(controller.coverageState?.weakAreas).length,
    sessionMemoryProjectUsage: controller.dynamicSlotState?.projectUsage || null,
    userCoachingMemoryLoaded: Boolean(controller.userCoachingMemory),
    userCoachingMemoryRecordCount: ensureArray(controller.userCoachingMemory?.records || controller.userCoachingMemory).length,
    userCoachingMemorySummaryAvailable: Boolean(controller.userCoachingMemory?.summary),
    userCoachingMemoryLatestSummary: controller.userCoachingMemory?.summary || null,
    memoryLoadPolicyRequested: memoryPolicy.requested || null,
    memoryLoadPolicyEffective: memoryPolicy.effective || null,
    heavyMemorySkippedBeforeFirstAudio: Boolean(memoryPolicy.heavyMemorySkippedBeforeFirstAudio),
    memorySkippedReason: memoryPolicy.heavyMemorySkippedBeforeFirstAudio ? 'follow_up_fast_path' : null,
  };
};

const buildRetrievalDiagnostics = ({ sessionAnalysis = null } = {}) => {
  const retrieval = sessionAnalysis?.controllerState?.retrievalState || {};
  const evidenceSnapshot = sessionAnalysis?.evidenceBundleSnapshot || {};
  const latestItems = ensureArray(retrieval.latestSources);
  const retrievalExecuted = Boolean(retrieval.latestQuery || latestItems.length || retrieval.retrievalObjective);
  return {
    retrievalExecuted,
    retrievalSkipped: !retrievalExecuted,
    retrievalSkippedReason: retrievalExecuted ? null : 'not_available',
    retrievalObjective: retrieval.retrievalObjective || null,
    retrievalSourceTypes: latestItems,
    retrievalItemCount: latestItems.length,
    retrievalCorrectiveRetryUsed: Boolean(retrieval.correctiveRetryUsed),
    evidencePackageSource: Object.keys(evidenceSnapshot).length ? 'session_analysis_snapshot' : null,
    evidencePackageFreshness: Object.keys(evidenceSnapshot).length ? 'latest_persisted' : null,
    evidencePackageStaleReason: Object.keys(evidenceSnapshot).length ? null : 'not_available',
    compactContextUsed: Boolean(retrieval.compactContext),
    warmContextHit: false,
    warmContextCacheAgeMs: null,
    warmContextSkippedReason: 'not_implemented',
  };
};

const buildArtifactDiagnostics = ({ session = {} } = {}) => {
  const cvFingerprint = session.cvFingerprint || session.analysisResult?.parsedCvProfile?.metadata?.cvFingerprint || null;
  const jdFingerprint = session.jdFingerprint || session.analysisResult?.parsedJdProfile?.metadata?.jdFingerprint || session.interviewPlan?.strategy?.jdFingerprint || null;
  const roleKey = normalizeKey(session.targetRole || session.analysisResult?.jobTitle || '');
  return {
    artifactCacheCandidateFound: false,
    artifactCacheHit: false,
    artifactCacheMissReason: 'not_implemented',
    artifactCacheScope: 'session',
    sameCvFingerprint: null,
    sameJdFingerprint: null,
    sameRoleKey: null,
    cvFingerprint,
    jdFingerprint,
    roleKey: roleKey || null,
    preparedArtifactsReused: false,
    preparedArtifactsRefreshRequired: false,
    preparedArtifactsRefreshReason: null,
    accountLevelCacheSupported: false,
  };
};

const buildDeduplicationDiagnostics = ({ session = {}, roots = [], preparedRootQuestionCount = 0 } = {}) => {
  const seenKeys = new Set();
  let duplicatePreparedQuestionCount = 0;
  roots.forEach((item) => {
    const key = item.assessmentKey || item.questionFingerprint || item.questionId;
    if (!key) return;
    if (seenKeys.has(key)) duplicatePreparedQuestionCount += 1;
    else seenKeys.add(key);
  });
  const rejectedCandidates = ensureArray(session.transcript).flatMap((turn) => (
    ensureArray(turn?.metadata?.questionDecision?.rejectedCandidates)
  ));
  const latestRejection = rejectedCandidates.at(-1) || null;
  const explicitReadiness = session.questionPoolReadiness || session.interviewPlan?.questionPoolReadiness || null;
  const readiness = explicitReadiness?.readiness || explicitReadiness?.status || (preparedRootQuestionCount > 0 ? 'ready' : 'degraded');

  return {
    uniquePreparedRootCount: seenKeys.size,
    duplicatePreparedQuestionCount,
    duplicateCandidatesRejected: rejectedCandidates.length,
    lastDuplicateReason: latestRejection?.reason || null,
    historySource: 'transcript',
    reconciliationStatus: session.questionPoolReconciliation?.status || 'not_run',
    readiness,
    degradedReason: explicitReadiness?.degradedReason || (readiness === 'degraded' ? 'no_active_prepared_root_questions' : null),
  };
};

export const buildInterviewQuestionDiagnostics = ({
  session = {},
  cvSeeds = [],
  jdFilter = null,
  poolItems = [],
  sessionAnalysis = null,
} = {}) => {
  const roots = ensureArray(poolItems).filter(isRootPoolItem);
  const fallbackRoots = ensureArray(poolItems).filter((item) => item.questionRole === 'fallback_root' || item.sourceStage === 'fallback');
  const wrapUps = ensureArray(poolItems).filter((item) => item.questionRole === 'wrap_up' || ['closing', 'wrap_up'].includes(item.stage));
  const matchGaps = ensureArray(poolItems).filter((item) => item.sourceStage === 'match_gap' || item.sourceType === 'match_gap');
  const latestAiTurn = findLatestAiTurn(session);
  const preparedRootQuestionCount = roots.filter((item) => item.status === 'active').length;

  return {
    cvSeedsCount: ensureArray(cvSeeds).length,
    cvSeedSamples: buildCvSeedSamples(cvSeeds),
    jdPrioritySummary: buildJdPrioritySummary({ jdFilter, session }),
    jdFilterReady: Boolean(jdFilter),
    jdFilterDecisionCounts: countBy(jdFilter?.filterDecisions, 'decision'),
    preparedRootQuestionCount,
    fallbackRootQuestionCount: fallbackRoots.length,
    wrapUpQuestionCount: wrapUps.length,
    matchGapQuestionCount: matchGaps.length,
    matchGapSamples: buildMatchGapSamples(matchGaps),
    askedPreparedRootCount: roots.filter((item) => item.status === 'asked').length,
    ...buildLatestTurnFields(latestAiTurn),
    poolDegraded: preparedRootQuestionCount === 0,
    poolDegradedReason: preparedRootQuestionCount === 0 ? 'no_active_prepared_root_questions' : null,
    ...buildDeduplicationDiagnostics({ session, roots, preparedRootQuestionCount }),
    ...buildMemoryDiagnostics({ sessionAnalysis }),
    ...buildRetrievalDiagnostics({ sessionAnalysis }),
    ...buildArtifactDiagnostics({ session }),
  };
};

export const getInterviewQuestionDiagnostics = async ({ session = {} } = {}) => {
  if (!session?.id) return buildInterviewQuestionDiagnostics({ session });
  const matchAnalysisId = session.interviewPlan?.strategy?.matchAnalysisId
    || session.interviewPlan?.questionPlanSnapshot?.matchAnalysisId
    || session.analysisResult?.retrievalSnapshots?.[0]?.matchAnalysisId
    || null;
  const jdFingerprint = session.jdFingerprint
    || session.analysisResult?.parsedJdProfile?.metadata?.jdFingerprint
    || session.interviewPlan?.strategy?.jdFingerprint
    || '';

  const [cvSeeds, jdFilter, poolItems, sessionAnalysis] = await Promise.all([
    session.cvFileId ? CvQuestionSeed.find({ userId: session.userId, cvFileId: session.cvFileId, status: 'active' }).sort({ priorityWeight: -1, createdAt: 1 }).lean() : Promise.resolve([]),
    JdQuestionFilter.findOne(matchAnalysisId
      ? { userId: session.userId, matchAnalysisId }
      : { userId: session.userId, jdFingerprint }).sort({ updatedAt: -1 }).lean(),
    InterviewQuestionPoolItem.find({ sessionId: session.id }).sort({ priorityWeight: -1, createdAt: 1 }).lean(),
    SessionAnalysis.findOne({ sessionId: session.id }).lean(),
  ]);

  return buildInterviewQuestionDiagnostics({
    session,
    cvSeeds,
    jdFilter,
    poolItems,
    sessionAnalysis,
  });
};
