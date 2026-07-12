import { badRequest } from '../../utils/appError.js';

const isManualReviewDecision = (analysis = {}) =>
  String(analysis?.decision?.label || '').toLowerCase() === 'manual_review';

const hasRoleFitReviewRequiredReason = (analysis = {}) => {
  const reasonCodes = [
    ...(Array.isArray(analysis?.decision?.reasonCodes) ? analysis.decision.reasonCodes : []),
    ...(Array.isArray(analysis?.roleFitDiagnostics?.degradedReasons) ? analysis.roleFitDiagnostics.degradedReasons : []),
  ];
  return reasonCodes.includes('role_fit_review_required')
    || reasonCodes.includes('jd_safeguard_blocked_match');
};

export const getMatchPlanBlockReason = (analysis = {}) => {
  if (!analysis || typeof analysis !== 'object') return 'missing_match_analysis';
  if (isManualReviewDecision(analysis) && hasRoleFitReviewRequiredReason(analysis)) {
    return 'role_fit_review_required';
  }
  if (isManualReviewDecision(analysis)) return 'manual_review_match_not_usable';
  return null;
};

export const isUsableMatchForInterviewPlan = (analysis = {}) =>
  getMatchPlanBlockReason(analysis) === null;

export const assertUsableMatchForInterviewPlan = (analysis = {}) => {
  const reason = getMatchPlanBlockReason(analysis);
  if (!reason) return;

  throw badRequest(
    'Match analysis requires review before interview planning',
    'Review company and role understanding before generating an interview plan.',
    { reason }
  );
};
