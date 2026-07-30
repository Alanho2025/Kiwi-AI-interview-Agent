

const PUBLICATION_SUMMARY_BY_STATUS = Object.freeze({
  ready: Object.freeze({
    status: 'verified',
    tone: 'success',
    title: 'Report checks complete',
    message: 'Kiwi checked this report against the available interview evidence. It is ready to use.',
    nextAction: null,
  }),
  ready_after_repair: Object.freeze({
    status: 'verified_after_repair',
    tone: 'success',
    title: 'Report checks complete after repair',
    message: 'Kiwi repaired the report wording and ran the quality checks again. It is ready to use.',
    nextAction: null,
  }),
  needs_review: Object.freeze({
    status: 'needs_review',
    tone: 'warning',
    title: 'This report still needs review',
    message: 'Some checks did not pass. You can read this as a draft, then recheck it before relying on the feedback.',
    nextAction: { type: 'recheck_report', label: 'Recheck report' },
  }),
  repair_failed: Object.freeze({
    status: 'verification_incomplete',
    tone: 'danger',
    title: 'Report verification is incomplete',
    message: 'Kiwi could not complete a safe repair. Recheck the report or generate a fresh version before relying on it.',
    nextAction: { type: 'recheck_report', label: 'Recheck report' },
  }),
});

const STATUS_UNAVAILABLE_SUMMARY = Object.freeze({
  status: 'status_unavailable',
  tone: 'info',
  title: 'Report status is unavailable',
  message: 'The report loaded, but its verification status could not be confirmed. Recheck it before relying on the feedback.',
  nextAction: { type: 'recheck_report', label: 'Recheck report' },
});

export const buildCandidateReportPublicationSummary = ({ latestStatus } = {}) => ({
  schemaVersion: 'report_publication_summary_v1',
  ...(PUBLICATION_SUMMARY_BY_STATUS[latestStatus] || STATUS_UNAVAILABLE_SUMMARY),
});

const FORBIDDEN_CANDIDATE_KEYS = new Set([
  'ambiguityMode',
  'ambiguityPolicy',
  'rankTrace',
  'poolSelectionReason',
  'decisionType',
  'scoringPolicy',
  'preparedQuestionId',
  'rawScoringDiagnostics',
  'catalogQuestionId',
  'catalogVersion',
  'proofPointId',
  'testedRoleIntentIds',
  'expectedSignals',
  'evidenceId',
  'knownEvidenceIds',
  'knownRoleIntentIds',
  'requiredCoverageIds',
  'coverageId',
  'roleIntentId',
  'questionId',
  'turnId',
  'detectedEvidenceUsed',
  'coverageContractIds',
  'groundedBy',
  'reportVersions',
  'repairHistory',
]);
const PRIVATE_IDENTIFIER_KEY = /^(?:catalog|preparedQuestion|proofPoint|coverage|roleIntent|knownEvidence|recommendedEvidence|detectedEvidence|affectedTurn|question|turn|evidence|source|claim|chunk)[A-Za-z]*Ids?$/;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d(?:[\s()-]*\d){7,})(?!\w)/g;
const STREET_ADDRESS_PATTERN = /\b\d{1,5}\s+(?:[A-Z0-9][A-Z0-9.'-]*\s+){0,5}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|way|place|pl|boulevard|blvd|crescent|cres|terrace|tce)\b/gi;
const LEGACY_CLARIFICATION_PATTERN = /\b(?:can|could|would) you (?:please )?(?:clarify|repeat|rephrase|explain)|\bwhat (?:are|were) you asking\b|\b(?:do not|don't|did not|didn't|cannot|can't) (?:really )?(?:understand|follow)\b/i;

const pickDefined = (source = {}, keys = []) => keys.reduce((result, key) => {
  if (source?.[key] !== undefined) result[key] = source[key];
  return result;
}, {});

export const sanitizeCandidateReportProjection = (reportPayload = {}) => {
  if (!reportPayload || typeof reportPayload !== 'object') return reportPayload;

  const clone = Array.isArray(reportPayload) ? [] : {};
  Object.keys(reportPayload).forEach((key) => {
    if (FORBIDDEN_CANDIDATE_KEYS.has(key) || PRIVATE_IDENTIFIER_KEY.test(key)) return;
    const val = reportPayload[key];
    if (val && typeof val === 'object') {
      clone[key] = sanitizeCandidateReportProjection(val);
    } else {
      clone[key] = val;
    }
  });

  return clone;
};

export const redactSensitiveReportValues = (value) => {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveReportValues(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactSensitiveReportValues(item)]),
    );
  }
  if (typeof value !== 'string') return value;
  return value
    .replace(STREET_ADDRESS_PATTERN, '[address redacted]')
    .replace(EMAIL_PATTERN, '[email redacted]')
    .replace(PHONE_PATTERN, (match) => {
      const digitCount = (match.match(/\d/g) || []).length;
      return digitCount >= 8 ? '[phone redacted]' : match;
    });
};

const buildCandidateFeedbackProjection = (feedback = {}) => {
  const projection = pickDefined(feedback, ['overallTakeaway', 'scoreBand', 'generationSource']);
  projection.plainEnglishMetrics = (feedback.plainEnglishMetrics || []).map((item) => pickDefined(item, [
    'title',
    'label',
    'description',
    'interpretation',
    'metric',
    'displayValue',
    'value',
  ]));
  projection.improvementPriorities = Array.isArray(feedback.improvementPriorities)
    ? feedback.improvementPriorities.slice(0, 3).map((item) => pickDefined(item, [
      'title',
      'whyItMatters',
      'detail',
      'action',
      'example',
    ]))
    : [];
  projection.turnBreakdowns = (feedback.turnBreakdowns || []).map((turn) => ({
    ...pickDefined(turn, ['question', 'answer', 'answerSummary', 'feedback', 'status']),
    scores: pickDefined(turn.scores || {}, ['business', 'logic', 'evidence']),
  }));
  projection.answerRewriteExamples = (feedback.answerRewriteExamples || []).map((item) => pickDefined(item, [
    'weak',
    'better',
    'status',
    'failureReason',
  ]));
  return projection;
};

const buildCandidateScores = (scores = {}) => {
  const projection = pickDefined(scores, ['overall']);
  const cvJdMatch = scores.cvJdMatch ?? scores.requirements ?? scores.macro;
  const interviewPerformance = scores.interviewPerformance ?? scores.micro;
  if (cvJdMatch !== undefined) projection.cvJdMatch = cvJdMatch;
  if (interviewPerformance !== undefined) projection.interviewPerformance = interviewPerformance;
  return projection;
};

const buildScoreExplanations = (explanations = {}) => Object.fromEntries(
  ['overall', 'cvJdMatch', 'interviewPerformance']
    .filter((key) => explanations?.[key]?.explanation)
    .map((key) => [key, { explanation: explanations[key].explanation }]),
);

const buildCandidateReportBody = (report = {}) => ({
  ...pickDefined(report, [
    'generatedAt',
    'candidateName',
    'jobTitle',
    'summary',
    'scoreLimitations',
    'transcriptRisks',
    'legacyLimitations',
  ]),
  scores: buildCandidateScores(report.scores || {}),
  scoreExplanations: buildScoreExplanations(report.scoreExplanations || {}),
  candidateFeedback: buildCandidateFeedbackProjection(report.candidateFeedback || {}),
});

export const buildCandidateReportProjection = (record = {}) => {
  const raw = typeof record?.toObject === 'function' ? record.toObject() : record;
  const report = buildCandidateReportBody(raw?.report || {});
  const projection = {
    ...pickDefined(raw || {}, ['sessionId', 'latestStatus', 'createdAt', 'updatedAt']),
    report,
  };
  return redactSensitiveReportValues(sanitizeCandidateReportProjection(projection));
};

export const buildLegacyReportLimitation = ({ transcript = [] } = {}) => {
  const suspiciousTurn = transcript.find((turn) => {
    const metadata = turn?.metadata || {};
    return String(turn?.role || '').toLowerCase() === 'user'
      && String(metadata.turnType || 'user_answer') === 'user_answer'
      && metadata.countsAsAnswer !== false
      && LEGACY_CLARIFICATION_PATTERN.test(String(turn?.text || ''));
  });
  if (!suspiciousTurn) return null;
  return {
    code: 'legacy_clarification_may_have_been_scored',
    message: 'A clarification request in this older session may have been treated as an answer. Regenerate the report before relying on the affected score.',
    action: 'regenerate_report',
  };
};
