import { badRequest } from '../../utils/appError.js';
import { compareCvToJobDescription } from '../matchService.js';
import { getOwnedCvDocumentOrThrow } from './cvOwnershipService.js';

export const runCvJdMatchAnalysis = async ({ cvId, userId, rawJD, jdRubric, settings }) => {
  if (!cvId) {
    throw badRequest('Missing cvId', 'Please provide a CV before starting match analysis.');
  }

  if (!rawJD && !jdRubric) {
    throw badRequest('Missing JD input', 'A raw job description or parsed JD rubric is required.');
  }

  const cvDocument = await getOwnedCvDocumentOrThrow({ cvId, userId });

  const matchData = await compareCvToJobDescription({
    normalizedText: cvDocument.normalizedText,
    cvProfile: cvDocument.cvProfile,
    evidenceProfile: cvDocument.cvProfile?.evidenceProfile,
  }, rawJD, jdRubric, settings);
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
