import { ensureArray } from '../../utils/commonHelpers.js';

const unique = (items = []) => [...new Set(ensureArray(items).filter(Boolean))];

const countByClassification = (items = []) => ensureArray(items).reduce((counts, item) => {
  const key = item.classification || item.fitType || 'unknown';
  return { ...counts, [key]: (counts[key] || 0) + 1 };
}, {});

const normalizeClassificationCounts = (value = {}) => {
  if (Array.isArray(value)) return countByClassification(value);
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key)
    .map(([key, count]) => [key, Number(count || 0)]));
};

const resolveEvidenceMapCoverage = (roleEvidenceMap = {}) => {
  const coverage = roleEvidenceMap.intentCoverage || {};
  const total = Number(coverage.highPriorityTotal || coverage.total || ensureArray(roleEvidenceMap.items).length || 0);
  if (!total) return null;
  const covered = Number(coverage.strong || 0) + Number(coverage.partial || 0);
  if (Number.isFinite(covered)) return Number(Math.max(0, Math.min(1, covered / total)).toFixed(2));
  const nonGapCount = ensureArray(roleEvidenceMap.items)
    .filter((item) => item.classification && item.classification !== 'gap')
    .length;
  return Number(Math.max(0, Math.min(1, nonGapCount / total)).toFixed(2));
};

const resolveAnswerAlignmentStatus = ({ answerAlignments = [], roleFitReport = {}, proofStrategy = {} } = {}) => {
  if (roleFitReport.roleFitDiagnostics?.answerAlignmentStatus) return roleFitReport.roleFitDiagnostics.answerAlignmentStatus;
  if (ensureArray(answerAlignments).some((item) => item.groundingStatus !== 'grounded')) return 'limited';
  if (ensureArray(answerAlignments).length) return 'ready';
  if (roleFitReport.status === 'legacy' || !ensureArray(proofStrategy.mustCover).length) return 'unavailable';
  return 'not_started';
};

const resolveCompanyContextStatus = (roleFitProfile = {}, baseDiagnostics = {}) => {
  if (baseDiagnostics.companyContextStatus) return baseDiagnostics.companyContextStatus;
  const groundingStatus = roleFitProfile.companyContext?.groundingStatus;
  if (groundingStatus === 'website_grounded') return 'grounded';
  if (groundingStatus === 'manual_context') return 'manual';
  if (groundingStatus === 'supplied_url_only') return 'url_supplied';
  return roleFitProfile.companyContext?.status === 'ready' ? 'manual' : 'missing';
};

const resolveProfileStatus = ({ baseStatus, items = [], verified = false } = {}) => {
  if (baseStatus) return baseStatus;
  if (verified) return 'user_confirmed';
  return ensureArray(items).length ? 'needs_review' : 'failed';
};

const getRoleIntentDiagnosticReasons = (roleIntent = {}) => ensureArray(roleIntent.diagnostics)
  .map((diagnostic) => diagnostic.degradedReason)
  .filter(Boolean);

const getRoleIntentDiagnosticCodes = (roleIntent = {}) => ensureArray(roleIntent.diagnostics)
  .map((diagnostic) => diagnostic.code)
  .filter(Boolean);

const buildSourceLimitations = ({
  diagnostics = {},
  roleIntent = {},
  roleEvidenceMap = {},
  proofStrategy = {},
  answerAlignments = [],
  answerAlignmentStatus = 'not_started',
} = {}) => unique([
  ...(diagnostics.sourceLimitations || []),
  ...getRoleIntentDiagnosticCodes(roleIntent),
  ...(diagnostics.companyContextStatus === 'url_supplied' ? ['company_website_content_not_verified'] : []),
  ...(ensureArray(roleEvidenceMap.items).some((item) => item.classification === 'gap') ? ['role_evidence_map_has_gaps'] : []),
  ...(proofStrategy.artifactStatus === 'degraded' ? ['proof_strategy_degraded'] : []),
  ...(answerAlignmentStatus === 'limited' ? ['answer_alignment_limited'] : []),
  ...(ensureArray(answerAlignments).some((item) => item.evidenceUseDiagnosis?.status === 'wrong_example') ? ['answer_alignment_wrong_example'] : []),
]);

export const sanitizeRoleFitDiagnostics = (diagnostics = {}) => {
  const counts = diagnostics.counts || {};
  return {
    schemaVersion: 'role_fit_diagnostics_v1',
    companyContextStatus: diagnostics.companyContextStatus || 'missing',
    companyUnderstandingStatus: diagnostics.companyUnderstandingStatus || 'failed',
    roleIntentStatus: diagnostics.roleIntentStatus || 'failed',
    unsupportedInferenceCount: Number(diagnostics.unsupportedInferenceCount || 0),
    evidenceMapCoverage: Number.isFinite(Number(diagnostics.evidenceMapCoverage))
      ? Number(diagnostics.evidenceMapCoverage)
      : null,
    proofStrategyStatus: diagnostics.proofStrategyStatus || 'not_started',
    answerAlignmentStatus: diagnostics.answerAlignmentStatus || 'not_started',
    counts: {
      companyFactCount: Number(counts.companyFactCount || 0),
      roleIntentCount: Number(counts.roleIntentCount || 0),
      evidenceMapItemCount: Number(counts.evidenceMapItemCount || 0),
      directEvidenceCount: Number(counts.directEvidenceCount || 0),
      adjacentEvidenceCount: Number(counts.adjacentEvidenceCount || 0),
      weakEvidenceCount: Number(counts.weakEvidenceCount || 0),
      gapCount: Number(counts.gapCount || 0),
      proofCoverageCount: Number(counts.proofCoverageCount || 0),
      answerAlignmentCount: Number(counts.answerAlignmentCount || 0),
    },
    classificationCounts: normalizeClassificationCounts(diagnostics.classificationCounts),
    degradedReasons: unique(diagnostics.degradedReasons),
    sourceLimitations: unique(diagnostics.sourceLimitations),
  };
};

export const buildRoleFitDiagnostics = ({
  roleFitProfile = {},
  roleEvidenceMap = {},
  proofStrategy = {},
  answerAlignments = [],
  roleFitReport = {},
} = {}) => {
  const baseDiagnostics = roleFitProfile.roleFitDiagnostics || roleFitReport.roleFitDiagnostics || {};
  const companyFacts = ensureArray(roleFitProfile.companyUnderstanding?.facts);
  const roleIntentItems = ensureArray(roleFitProfile.roleIntent?.items);
  const roleEvidenceItems = ensureArray(roleEvidenceMap.items);
  const proofCoverage = ensureArray(proofStrategy.mustCover);
  const classificationCounts = countByClassification(roleEvidenceItems);
  const reviewVerified = roleFitProfile.review?.status === 'verified';
  const proofStrategyStatus = proofStrategy.artifactStatus
    || baseDiagnostics.proofStrategyStatus
    || (proofCoverage.length ? 'ready' : 'not_started');
  const answerAlignmentStatus = resolveAnswerAlignmentStatus({ answerAlignments, roleFitReport, proofStrategy });
  const degradedReasons = unique([
    ...(baseDiagnostics.degradedReasons || []),
    ...getRoleIntentDiagnosticReasons(roleFitProfile.roleIntent),
    proofStrategy.degradedReason,
    roleEvidenceMap.degradedReason,
    roleFitReport.status === 'unavailable' ? 'answer_alignment_unavailable' : '',
  ]);

  return sanitizeRoleFitDiagnostics({
    companyContextStatus: resolveCompanyContextStatus(roleFitProfile, baseDiagnostics),
    companyUnderstandingStatus: resolveProfileStatus({
      baseStatus: baseDiagnostics.companyUnderstandingStatus,
      items: companyFacts,
      verified: reviewVerified,
    }),
    roleIntentStatus: resolveProfileStatus({
      baseStatus: baseDiagnostics.roleIntentStatus,
      items: roleIntentItems,
      verified: reviewVerified,
    }),
    unsupportedInferenceCount: Number(baseDiagnostics.unsupportedInferenceCount || 0)
      + [...companyFacts, ...roleIntentItems].filter((item) => item.claimStatus === 'unsupported').length,
    evidenceMapCoverage: resolveEvidenceMapCoverage(roleEvidenceMap),
    proofStrategyStatus,
    answerAlignmentStatus,
    counts: {
      companyFactCount: companyFacts.length,
      roleIntentCount: roleIntentItems.length,
      evidenceMapItemCount: roleEvidenceItems.length,
      directEvidenceCount: classificationCounts.direct || 0,
      adjacentEvidenceCount: classificationCounts.adjacent || 0,
      weakEvidenceCount: classificationCounts.weak || 0,
      gapCount: classificationCounts.gap || 0,
      proofCoverageCount: proofCoverage.length,
      answerAlignmentCount: ensureArray(answerAlignments).length,
    },
    classificationCounts: roleEvidenceItems,
    degradedReasons,
    sourceLimitations: buildSourceLimitations({
      diagnostics: { ...baseDiagnostics, companyContextStatus: resolveCompanyContextStatus(roleFitProfile, baseDiagnostics) },
      roleIntent: roleFitProfile.roleIntent,
      roleEvidenceMap,
      proofStrategy,
      answerAlignments,
      answerAlignmentStatus,
    }),
  });
};
