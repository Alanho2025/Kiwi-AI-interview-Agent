import { badRequest } from '../../utils/appError.js';
import { compareCvToJobDescriptionWithSafeguard } from '../match/guardedMatchService.js';
import { getOwnedCvDocumentOrThrow } from './cvOwnershipService.js';
import { assertVerifiedCompanyRoleFitReview } from '../company/companyValuesRepository.js';
import { measureMatchStep } from '../match/matchPerformanceTraceService.js';

export const runCvJdMatchAnalysis = async ({ cvId, userId, rawJD, jdRubric, settings = {}, performanceTrace = null }) => {
  if (!cvId) {
    throw badRequest('Missing cvId', 'Please provide a CV before starting match analysis.');
  }

  if (!rawJD && !jdRubric) {
    throw badRequest('Missing JD input', 'A raw job description or parsed JD rubric is required.');
  }

  if (!jdRubric?.roleFit) {
    throw badRequest(
      'Role-fit review required',
      'Summarise and confirm the job and company understanding before matching.',
    );
  }

  await measureMatchStep(performanceTrace, 'role_fit_review_gate', () => assertVerifiedCompanyRoleFitReview({
    userId,
    jdFingerprint: jdRubric.roleFit.jdFingerprint,
    reviewVersion: jdRubric.roleFit.review?.version,
    roleFitProfileId: jdRubric.roleFit.id,
  }), {
    hasRoleFitProfileId: Boolean(jdRubric.roleFit.id),
    reviewVersion: jdRubric.roleFit.review?.version,
  });

  const cvDocument = await measureMatchStep(
    performanceTrace,
    'cv_document_load',
    () => getOwnedCvDocumentOrThrow({ cvId, userId }),
    { cvId },
  );

  const matchData = await measureMatchStep(performanceTrace, 'guarded_match_analysis', () => compareCvToJobDescriptionWithSafeguard({
    normalizedText: cvDocument.normalizedText,
    cvProfile: cvDocument.cvProfile,
    evidenceProfile: cvDocument.cvProfile?.evidenceProfile,
    userId,
  }, rawJD, jdRubric, {
    ...(settings || {}),
    userId,
    cvId,
  }, { performanceTrace }), {
    matchEngine: settings?.matchEngine || process.env.MATCH_ENGINE || 'default',
  });
  return {
    ...matchData,
    sourceSnapshots: [
      ...(matchData.sourceSnapshots || []),
      {
        sourceType: 'cv_profile',
        fileId: cvDocument.fileId,
        candidateName: cvDocument.cvProfile?.candidateName || 'Candidate',
        topSkills: (cvDocument.cvProfile?.skills || []).slice(0, 8).map((item) => item.label),
        capabilityCount: cvDocument.cvProfile?.evidenceProfile?.functionalCapabilities?.length || 0,
      },
    ],
  };
};
