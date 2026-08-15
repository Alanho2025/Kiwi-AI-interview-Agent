

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
const IMPACT_FIRST_FRAMEWORK_KEY = 'impact_first_past_example';
const IMPACT_FIRST_DIMENSION_KEYS = Object.freeze([
  'outcome',
  'problem_solving',
  'personal_role',
  'approaches',
  'learning',
  'outcome_placement',
]);

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

const normalizeQuestion = (value = '') => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const buildRewriteIdentity = (question = '', answer = '') => {
  const normalizedQuestion = normalizeQuestion(question);
  const normalizedAnswer = normalizeQuestion(answer);
  if (!normalizedQuestion || !normalizedAnswer) return '';
  return `${normalizedQuestion}\u0000${normalizedAnswer}`;
};

const asArray = (value = []) => Array.isArray(value) ? value : [];

const buildRewriteQueues = (rewrites = []) => asArray(rewrites).reduce((queues, rewrite) => {
  const identity = buildRewriteIdentity(rewrite?.question, rewrite?.weak);
  if (!identity) return queues;
  const queue = queues.get(identity) || [];
  queue.push(rewrite);
  queues.set(identity, queue);
  return queues;
}, new Map());

const takeMatchingRewrite = (queues, question = '', answer = '') => {
  const queue = queues.get(buildRewriteIdentity(question, answer));
  return queue?.length === 1 ? queue.shift() : null;
};

const buildAssessmentQueues = (assessments = []) => asArray(assessments).reduce((queues, assessment) => {
  const question = normalizeQuestion(assessment?.question);
  if (!question) return queues;
  const queue = queues.get(question) || [];
  queue.push(assessment);
  queues.set(question, queue);
  return queues;
}, new Map());

const takeMatchingAssessment = (queues, question = '') => queues.get(normalizeQuestion(question))?.shift() || null;

const projectTurnAssessment = (assessment = null) => {
  if (!assessment?.status) return null;
  return pickDefined(assessment, ['status', 'score', 'summary', 'missingSignals', 'nextStep']);
};

const projectTurnRewrite = (rewrite = null) => {
  if (!rewrite) return { status: 'unavailable', unavailableReason: 'A grounded stronger answer could not be matched to this question.' };
  if (rewrite.status === 'ready' && rewrite.better) return { status: 'ready', answer: rewrite.better };
  return { status: 'unavailable', unavailableReason: 'A grounded stronger answer could not be generated reliably.' };
};

const projectDurationAssessment = (assessment = null) => {
  if (!assessment || typeof assessment !== 'object') return null;
  return pickDefined(assessment, ['eligible', 'reason', 'seconds', 'level', 'earnedPoints', 'maxPoints']);
};

const parseNumericValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const boundedScorePercent = (value) => {
  const scorePercent = parseNumericValue(value);
  if (scorePercent === undefined) return undefined;
  return Number(Math.max(0, Math.min(100, scorePercent)).toFixed(2));
};

const boundedFrameworkLevel = (value) => {
  const level = parseNumericValue(value);
  if (level === undefined) return undefined;
  return Math.max(1, Math.min(5, Math.round(level)));
};

const mapScorePercent = ({ scorePercent, normalizedScore, score, weight } = {}) => {
  const explicitScorePercent = boundedScorePercent(scorePercent);
  if (explicitScorePercent !== undefined) return explicitScorePercent;

  const normalized = parseNumericValue(normalizedScore);
  if (normalized !== undefined) return boundedScorePercent(normalized * 10);

  const numericScore = parseNumericValue(score);
  if (numericScore === undefined) return undefined;
  const numericWeight = parseNumericValue(weight);
  const percentage = numericWeight !== undefined && numericWeight > 0
    ? (numericScore / numericWeight) * 100
    : numericScore * 10;
  return boundedScorePercent(percentage);
};

const projectFrameworkDimension = (dimension = {}) => {
  const projected = pickDefined(dimension, [
    'key',
    'label',
    'status',
    'reason',
  ]);
  const level = boundedFrameworkLevel(dimension.level);
  const scorePercent = mapScorePercent(dimension);
  if (level !== undefined) projected.level = level;
  if (scorePercent !== undefined) projected.scorePercent = scorePercent;
  return projected;
};

const projectFrameworkBreakdown = (breakdown = null) => {
  if (!breakdown || typeof breakdown !== 'object') return null;
  const projection = pickDefined(breakdown, ['summary', 'scoreReason', 'version']);
  const level = boundedFrameworkLevel(breakdown.level);
  const scorePercent = mapScorePercent(breakdown);
  if (level !== undefined) projection.level = level;
  if (scorePercent !== undefined) projection.scorePercent = scorePercent;
  projection.dimensions = asArray(breakdown.dimensions).map(projectFrameworkDimension);
  return projection;
};

const hasCompleteImpactFirstMetrics = (turn = {}) => {
  if (turn.frameworkKey !== IMPACT_FIRST_FRAMEWORK_KEY) return true;

  const dimensions = projectFrameworkBreakdown(turn.frameworkBreakdown)?.dimensions || [];
  const keys = new Set(dimensions.map((dimension) => dimension.key));
  if (dimensions.length !== IMPACT_FIRST_DIMENSION_KEYS.length
    || keys.size !== IMPACT_FIRST_DIMENSION_KEYS.length
    || !IMPACT_FIRST_DIMENSION_KEYS.every((key) => keys.has(key))) {
    return false;
  }

  return dimensions.every((dimension) => (
    Number.isInteger(dimension.level)
    && dimension.level >= 1
    && dimension.level <= 5
    && Number.isFinite(dimension.scorePercent)
    && dimension.scorePercent >= 0
    && dimension.scorePercent <= 100
  ));
};

const buildImpactFirstMetricsLimitation = (report = {}) => {
  const hasIncompleteTurn = asArray(report?.candidateFeedback?.turnBreakdowns)
    .some((turn) => !hasCompleteImpactFirstMetrics(turn));
  if (!hasIncompleteTurn) return null;

  return {
    code: 'legacy_impact_first_metrics_unavailable',
    message: 'This report contains an incomplete Impact-first score breakdown. Regenerate the report to see the six level and percentage metrics.',
    action: 'regenerate_report',
  };
};

const projectStarBreakdown = (breakdown = null) => {
  if (!breakdown || typeof breakdown !== 'object') return null;
  return pickDefined(breakdown, [
    'situation',
    'task',
    'action',
    'result',
    'resultOrReaction',
    'reflection',
    'mainMissingElement',
    'scoreReason',
  ]);
};

const buildCandidateFeedbackProjection = (feedback = {}, roleFit = {}) => {
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
  const assessmentQueues = buildAssessmentQueues(roleFit.candidateTurnAssessments);
  const rewriteQueues = buildRewriteQueues(feedback.answerRewriteExamples);
  projection.turnBreakdowns = (feedback.turnBreakdowns || []).map((turn) => {
    const assessment = projectTurnAssessment(takeMatchingAssessment(assessmentQueues, turn.question));
    const candidateTurn = {
      ...pickDefined(turn, [
        'question',
        'answer',
        'answerSummary',
        'feedback',
        'status',
        'rubricType',
        'frameworkKey',
        'frameworkLabel',
        'starApplicable',
        'structureLabel',
      ]),
      scores: pickDefined(turn.scores || {}, ['business', 'logic', 'evidence']),
      durationAssessment: projectDurationAssessment(turn.durationAssessment),
      frameworkBreakdown: projectFrameworkBreakdown(turn.frameworkBreakdown),
      starBreakdown: projectStarBreakdown(turn.starBreakdown || turn.starrBreakdown),
      strongerAnswer: projectTurnRewrite(takeMatchingRewrite(rewriteQueues, turn.question, turn.answer)),
    };
    if (!assessment) return candidateTurn;
    return {
      ...candidateTurn,
      answerAssessment: assessment,
    };
  });
  return projection;
};

const buildCandidateScores = (scores = {}) => {
  const interviewPerformance = scores.interviewPerformance;
  if (interviewPerformance === undefined) return {};
  return { overall: interviewPerformance };
};

const buildScoreExplanations = (explanations = {}) => Object.fromEntries(
  ['overall']
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
  candidateFeedback: buildCandidateFeedbackProjection(report.candidateFeedback || {}, report.roleFit || {}),
});

export const buildCandidateReportProjection = (record = {}) => {
  const raw = typeof record?.toObject === 'function' ? record.toObject() : record;
  const rawReport = raw?.report || {};
  const impactFirstLimitation = buildImpactFirstMetricsLimitation(rawReport);
  const existingLimitations = asArray(rawReport.legacyLimitations);
  const legacyLimitations = impactFirstLimitation
    && !existingLimitations.some((item) => item?.code === impactFirstLimitation.code)
    ? [...existingLimitations, impactFirstLimitation]
    : existingLimitations;
  const report = buildCandidateReportBody({
    ...rawReport,
    ...(legacyLimitations.length ? { legacyLimitations } : {}),
  });
  const latestStatus = impactFirstLimitation
    && ['ready', 'ready_after_repair'].includes(raw?.latestStatus)
    ? 'needs_review'
    : raw?.latestStatus;
  const projection = {
    ...pickDefined(raw || {}, ['sessionId', 'createdAt', 'updatedAt']),
    ...(latestStatus !== undefined ? { latestStatus } : {}),
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
