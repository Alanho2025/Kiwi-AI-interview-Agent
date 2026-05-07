const HUMAN_REVIEWED_STATUS_SUFFIX = '_human_reviewed';

const getExistingSafeguard = (rubric = {}) => rubric.safeguard || rubric.metadata?.safeguard || null;

const appendHumanReviewedStatus = (status) => {
  if (!status) {
    return 'jd_safeguard_block_match_human_reviewed';
  }

  return String(status).endsWith(HUMAN_REVIEWED_STATUS_SUFFIX)
    ? status
    : `${status}${HUMAN_REVIEWED_STATUS_SUFFIX}`;
};

const buildHumanReviewedSafeguard = (rubric = {}, reviewStatus) => {
  const existingSafeguard = getExistingSafeguard(rubric);

  if (reviewStatus !== 'verified' || !existingSafeguard) {
    return existingSafeguard;
  }

  return {
    ...existingSafeguard,
    blockMatch: false,
    humanReviewOverrideApplied: true,
    originalBlockMatch: Boolean(existingSafeguard.blockMatch),
    finalStatus: appendHumanReviewedStatus(existingSafeguard.finalStatus),
  };
};

export const stampHumanReviewMetadata = (rubric, reviewStatus) => {
  const safeRubric = rubric || {};
  const reviewedSafeguard = buildHumanReviewedSafeguard(safeRubric, reviewStatus);

  return {
    ...safeRubric,
    ...(reviewedSafeguard ? { safeguard: reviewedSafeguard } : {}),
    metadata: {
      ...(safeRubric.metadata || {}),
      ...(reviewedSafeguard ? { safeguard: reviewedSafeguard } : {}),
      humanReviewStatus: reviewStatus,
      inputTrustLevel: reviewStatus === 'verified' ? 'human_reviewed' : 'ai_parsed',
      humanReviewedAt: reviewStatus === 'verified' ? new Date().toISOString() : null,
    },
    diagnostics: {
      ...(safeRubric.diagnostics || {}),
      humanReviewStatus: reviewStatus,
    },
  };
};
