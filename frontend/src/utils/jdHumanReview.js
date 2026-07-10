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

const buildRoleFitReview = (roleFit = null, reviewStatus) => {
  if (!roleFit) return null;
  const currentVersion = Math.max(1, Number(roleFit.review?.version) || 1);
  const isVerified = reviewStatus === 'verified';

  return {
    ...roleFit,
    review: {
      ...(roleFit.review || {}),
      status: reviewStatus,
      baseVersion: isVerified ? currentVersion : Number(roleFit.review?.baseVersion) || 0,
      version: isVerified ? currentVersion + 1 : currentVersion,
      reviewedAt: isVerified ? new Date().toISOString() : null,
    },
  };
};

export const stampHumanReviewMetadata = (rubric, reviewStatus) => {
  const safeRubric = rubric || {};
  const reviewedSafeguard = buildHumanReviewedSafeguard(safeRubric, reviewStatus);
  const reviewedRoleFit = buildRoleFitReview(safeRubric.roleFit, reviewStatus);

  return {
    ...safeRubric,
    ...(reviewedRoleFit ? { roleFit: reviewedRoleFit } : {}),
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
