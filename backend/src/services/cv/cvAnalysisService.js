/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: cvAnalysisService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

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

  const analysisInput = cvDocument.cvProfile?.experience || cvDocument.normalizedText;
  const matchData = await compareCvToJobDescription(analysisInput, rawJD, jdRubric, settings);
  return {
    ...matchData,
    sourceSnapshots: [
      ...(matchData.sourceSnapshots || []),
      {
        sourceType: 'cv_profile',
        fileId: cvDocument.fileId,
        candidateName: cvDocument.cvProfile?.candidateName || 'Candidate',
        topSkills: (cvDocument.cvProfile?.skills || []).slice(0, 8).map((item) => item.label),
      },
    ],
  };
};
