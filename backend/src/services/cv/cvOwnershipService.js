import { getCvDocumentForAnalysis, getCvRecordById } from '../fileRepositoryService.js';
import { notFound } from '../../utils/appError.js';
import { MatchAnalysisRecord } from '../../db/models/matchAnalysisRecordModel.js';

export const getOwnedCvRecordOrThrow = async ({ cvId, userId }) => {
  const record = await getCvRecordById(cvId, userId);
  if (!record) {
    throw notFound('CV not found', 'The selected CV is not available for this user.');
  }
  return record;
};

export const getOwnedCvDocumentOrThrow = async ({ cvId, userId }) => {
  const document = await getCvDocumentForAnalysis(cvId, userId);
  if (!document) {
    throw notFound('CV not found', 'The selected CV is not available for this user.');
  }
  return document;
};

export const getOwnedMatchAnalysisOrThrow = async ({ matchAnalysisId, userId }) => {
  const record = await MatchAnalysisRecord.findOne({ matchAnalysisId, userId, deletedAt: { $exists: false } }).lean();
  if (!record) {
    throw notFound('Match analysis not found', 'The selected analysis is not available for this user.');
  }
  return record;
};
