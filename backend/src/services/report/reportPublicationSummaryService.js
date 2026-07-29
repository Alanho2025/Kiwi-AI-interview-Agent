

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
]);

export const sanitizeCandidateReportProjection = (reportPayload = {}) => {
  if (!reportPayload || typeof reportPayload !== 'object') return reportPayload;

  const clone = Array.isArray(reportPayload) ? [] : {};
  Object.keys(reportPayload).forEach((key) => {
    if (FORBIDDEN_CANDIDATE_KEYS.has(key)) return;
    const val = reportPayload[key];
    if (val && typeof val === 'object') {
      clone[key] = sanitizeCandidateReportProjection(val);
    } else {
      clone[key] = val;
    }
  });

  return clone;
};
