const LEGACY_SUMMARY_BY_STATUS = {
  ready: {
    status: 'verified',
    tone: 'success',
    title: 'Report checks complete',
    message: 'Kiwi checked this report against the available interview evidence. It is ready to use.',
    nextAction: null,
  },
  ready_after_repair: {
    status: 'verified_after_repair',
    tone: 'success',
    title: 'Report checks complete after repair',
    message: 'Kiwi repaired the report wording and ran the quality checks again. It is ready to use.',
    nextAction: null,
  },
  needs_review: {
    status: 'needs_review',
    tone: 'warning',
    title: 'This report still needs review',
    message: 'Some checks did not pass. You can read this as a draft, then recheck it before relying on the feedback.',
    nextAction: { type: 'recheck_report', label: 'Recheck report' },
  },
  repair_failed: {
    status: 'verification_incomplete',
    tone: 'danger',
    title: 'Report verification is incomplete',
    message: 'Kiwi could not complete a safe repair. Recheck the report or generate a fresh version before relying on it.',
    nextAction: { type: 'recheck_report', label: 'Recheck report' },
  },
};

const STATUS_UNAVAILABLE_SUMMARY = {
  status: 'status_unavailable',
  tone: 'info',
  title: 'Report status is unavailable',
  message: 'The report loaded, but its verification status could not be confirmed. Recheck it before relying on the feedback.',
  nextAction: { type: 'recheck_report', label: 'Recheck report' },
};

export const resolveReportPublicationSummary = (reportData = {}) => {
  if (reportData.publicationSummary?.status && reportData.publicationSummary?.title) {
    return reportData.publicationSummary;
  }

  return {
    schemaVersion: 'report_publication_summary_v1',
    ...(LEGACY_SUMMARY_BY_STATUS[reportData.latestStatus] || STATUS_UNAVAILABLE_SUMMARY),
  };
};
