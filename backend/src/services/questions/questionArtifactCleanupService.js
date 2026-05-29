import { CvQuestionSeed } from '../../db/models/cvQuestionSeedModel.js';
import { DocumentChunk } from '../../db/models/documentChunkModel.js';
import { InterviewQuestionPoolItem } from '../../db/models/interviewQuestionPoolItemModel.js';
import { JdQuestionFilter } from '../../db/models/jdQuestionFilterModel.js';
import { query } from '../../db/postgres.js';

const deletedCount = (result) => Number(result?.deletedCount || 0);

export const cleanupQuestionArtifactsAfterReport = async ({
  userId,
  sessionId,
  cvFileId = null,
  matchAnalysisId = null,
} = {}) => {
  if (!userId || !sessionId) {
    return {
      deletedPreparedPoolItems: 0,
      deletedPreparedPoolChunks: 0,
      deletedJdQuestionFilters: 0,
      deletedCvQuestionSeeds: 0,
    };
  }

  const [poolResult, mongoChunkResult, postgresChunkResult, filterResult, seedResult] = await Promise.all([
    InterviewQuestionPoolItem.deleteMany({ userId, sessionId }),
    DocumentChunk.deleteMany({ sessionId, sourceType: 'prepared_question_pool' }),
    query('DELETE FROM document_chunks WHERE session_id = $1 AND source_type = $2', [sessionId, 'prepared_question_pool']),
    matchAnalysisId
      ? JdQuestionFilter.deleteMany({ userId, matchAnalysisId })
      : Promise.resolve({ deletedCount: 0 }),
    cvFileId
      ? CvQuestionSeed.deleteMany({ userId, cvFileId })
      : Promise.resolve({ deletedCount: 0 }),
  ]);

  return {
    deletedPreparedPoolItems: deletedCount(poolResult),
    deletedPreparedPoolChunks: deletedCount(mongoChunkResult) + Number(postgresChunkResult?.rowCount || 0),
    deletedJdQuestionFilters: deletedCount(filterResult),
    deletedCvQuestionSeeds: deletedCount(seedResult),
  };
};
