import mongoose from 'mongoose';
import { AiLog } from '../db/models/aiLogModel.js';
import { AiUsageEvent } from '../db/models/aiUsageEventModel.js';
import { CompanyValuesProfile } from '../db/models/companyValuesProfileModel.js';
import { CvArtifactCache } from '../db/models/cvArtifactCacheModel.js';
import { CvQuestionSeed } from '../db/models/cvQuestionSeedModel.js';
import { DocumentChunk } from '../db/models/documentChunkModel.js';
import { DocumentContent } from '../db/models/documentContentModel.js';
import { EvaluationGroundTruth } from '../db/models/evaluationGroundTruthModel.js';
import { HarnessWorkflowRun } from '../db/models/harnessWorkflowRunModel.js';
import { InterviewPlan } from '../db/models/interviewPlanModel.js';
import { InterviewQuestionPoolItem } from '../db/models/interviewQuestionPoolItemModel.js';
import { JdArtifactCache } from '../db/models/jdArtifactCacheModel.js';
import { JdQuestionFilter } from '../db/models/jdQuestionFilterModel.js';
import { MatchAnalysisRecord } from '../db/models/matchAnalysisRecordModel.js';
import { MatchArtifactCache } from '../db/models/matchArtifactCacheModel.js';
import { NormalizedCvProfile } from '../db/models/normalizedCvProfileModel.js';
import { NormalizedJdRubric } from '../db/models/normalizedJdRubricModel.js';
import { RagBenchmarkCase } from '../db/models/ragBenchmarkCaseModel.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { SessionFeedbackDetail } from '../db/models/sessionFeedbackDetailModel.js';
import { SessionReport } from '../db/models/sessionReportModel.js';
import { SessionTranscript } from '../db/models/sessionTranscriptModel.js';
import { TokenUsage } from '../db/models/tokenUsageModel.js';
import { UserCoachingMemory } from '../db/models/userCoachingMemoryModel.js';
import { createMongoRetentionRepository } from './mongoRetentionRepository.js';

export const buildMongoRetentionModelRegistry = () => new Map([
  ['ailogs', AiLog],
  ['aiusageevents', AiUsageEvent],
  ['companyvaluesprofiles', CompanyValuesProfile],
  ['cvartifactcaches', CvArtifactCache],
  ['cvquestionseeds', CvQuestionSeed],
  ['documentchunks', DocumentChunk],
  ['documentcontents', DocumentContent],
  ['evaluationgroundtruths', EvaluationGroundTruth],
  ['harnessworkflowruns', HarnessWorkflowRun],
  ['interviewplans', InterviewPlan],
  ['interviewquestionpoolitems', InterviewQuestionPoolItem],
  ['jdartifactcaches', JdArtifactCache],
  ['jdquestionfilters', JdQuestionFilter],
  ['matchanalysisrecords', MatchAnalysisRecord],
  ['matchartifactcaches', MatchArtifactCache],
  ['normalizedcvprofiles', NormalizedCvProfile],
  ['normalizedjdrubrics', NormalizedJdRubric],
  ['ragbenchmarkcases', RagBenchmarkCase],
  ['sessionanalyses', SessionAnalysis],
  ['sessionfeedbackdetails', SessionFeedbackDetail],
  ['sessionreports', SessionReport],
  ['sessiontranscripts', SessionTranscript],
  ['tokenusages', TokenUsage],
  ['usercoachingmemories', UserCoachingMemory],
]);

export const createDefaultMongoRetentionRepository = () => createMongoRetentionRepository({
  connection: mongoose.connection,
  modelsByCollection: buildMongoRetentionModelRegistry(),
});
