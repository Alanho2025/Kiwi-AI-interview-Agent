import { AppError, badRequest } from '../../utils/appError.js';
import { validateText } from '../../utils/textProcessing.js';
import { compareCvToJobDescriptionWithSafeguard } from '../match/guardedMatchService.js';
import { getOwnedCvDocumentOrThrow } from './cvOwnershipService.js';
import { assertVerifiedCompanyRoleFitReview } from '../company/companyValuesRepository.js';
import { measureMatchStep } from '../match/matchPerformanceTraceService.js';

const assertUsableMatchText = (text, label, settings = {}) => {
  const minCharLimit = process.env.NODE_ENV === 'test' && !settings.enableLengthValidation ? 10 : 200;
  const validation = validateText(text, minCharLimit, 50000, label);
  if (!validation.isValid) {
    throw new AppError(validation.error.message, {
      statusCode: 400,
      code: validation.error.code,
      details: validation.error.message,
    });
  }
};

export const runCvJdMatchExecution = async ({
  cvId,
  userId,
  rawJD,
  jdRubric,
  settings = {},
  performanceTrace = null,
  progressReporter = null,
}) => {
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

  progressReporter?.stageStarted?.('input_validation');
  const cvDocument = await measureMatchStep(
    performanceTrace,
    'cv_document_load',
    () => getOwnedCvDocumentOrThrow({ cvId, userId }),
    { cvId },
  );

  assertUsableMatchText(cvDocument.normalizedText, 'CV', settings);
  if (typeof rawJD === 'string' && rawJD.trim()) {
    assertUsableMatchText(rawJD, 'JD', settings);
  }
  progressReporter?.stageCompleted?.('input_validation');

  progressReporter?.stageStarted?.('role_fit_gate');
  await measureMatchStep(performanceTrace, 'role_fit_review_gate', () => assertVerifiedCompanyRoleFitReview({
    userId,
    jdFingerprint: jdRubric.roleFit.jdFingerprint,
    reviewVersion: jdRubric.roleFit.review?.version,
    roleFitProfileId: jdRubric.roleFit.id,
  }), {
    hasRoleFitProfileId: Boolean(jdRubric.roleFit.id),
    reviewVersion: jdRubric.roleFit.review?.version,
  });
  progressReporter?.stageCompleted?.('role_fit_gate');

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
    cvDocument,
    matchData: {
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
    },
  };
};

export const runCvJdMatchAnalysis = async (input) => {
  const execution = await runCvJdMatchExecution(input);
  return execution.matchData;
};
