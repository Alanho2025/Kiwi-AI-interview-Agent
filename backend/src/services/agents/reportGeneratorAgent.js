/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportGeneratorAgent should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { validateReportOutput } from '../schemaValidationService.js';
import { generateCandidateFeedback } from '../reportCoachingService.js';
import { analyseCandidateAnswers, buildEvidenceSummary, buildInterviewMetrics } from './reportGenerator/reportEvidenceAnalysis.js';
import { buildDeterministicCandidateFeedback } from './reportGenerator/reportFeedbackBuilder.js';
import { buildReportDraft } from './reportGenerator/reportDraftBuilder.js';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { getUserCoachingMemory } from '../aiControl/userCoachingMemoryService.js';
import { buildNzWorkplaceFit } from '../nzWorkplaceFitService.js';
import {
  attachCompanyValuesProfileToSession,
  getCompanyValuesProfile,
  getCompanyValuesProfileByFingerprint,
} from '../company/companyValuesRepository.js';
import { extractCompanyValuesContextFromJd } from '../company/companyValuesFingerprintService.js';
import { buildCompanyMotivationFit } from '../company/companyMotivationFitService.js';

const resolveCompanyValuesProfile = async ({ session = {}, analysisRecord = null } = {}) => {
  if (!session.id) return null;

  const bySession = await getCompanyValuesProfile(session.id);
  if (bySession?.source === 'official_website' || bySession?.source === 'manual') return bySession;

  const jdRubric = analysisRecord?.jdRubric || analysisRecord?.parsedJdProfile || session.analysisResult?.parsedJdProfile || session.analysisSetup?.structuredJDRubric || {};
  const rawJD = session.rawJD || session.analysisSetup?.rawJD || analysisRecord?.jdStructuredText || session.jdText || '';
  const context = extractCompanyValuesContextFromJd({ rawJD, jdRubric });
  const byFingerprint = await getCompanyValuesProfileByFingerprint({
    userId: session.userId,
    jdFingerprint: context.jdFingerprint,
  });

  if (byFingerprint?.source === 'official_website' || byFingerprint?.source === 'manual') {
    if (!byFingerprint.sessionId) {
      await attachCompanyValuesProfileToSession({
        userId: session.userId,
        jdFingerprint: context.jdFingerprint,
        sessionId: session.id,
      });
    }
    return byFingerprint;
  }

  return bySession || byFingerprint || null;
};

export const runReportGeneratorAgent = async ({ session = {}, analysisResult = {}, interviewPlan = {}, retrievalBundle = null } = {}) => {
  const transcript = session.transcript || [];
  const userTurns = transcript.filter((turn) => turn.role === 'user');
  const explanation = analysisResult.explanation || { strengths: [], gaps: [], risks: [], summary: '' };
  const analysedAnswers = analyseCandidateAnswers(userTurns);
  const evidenceSummary = buildEvidenceSummary(analysedAnswers);
  const interviewMetrics = buildInterviewMetrics(transcript, session.totalQuestions || 0);
  const deterministicFeedback = buildDeterministicCandidateFeedback({
    analysisResult,
    explanation,
    evidenceSummary,
    interviewMetrics,
    interviewPlan,
  });

  const analysisRecord = session.id ? await SessionAnalysis.findOne({ sessionId: session.id }).lean() : null;
  const userCoachingMemory = await getUserCoachingMemory(session.userId);
  const nzWorkplaceFit = buildNzWorkplaceFit({ session });
  const companyValuesProfile = await resolveCompanyValuesProfile({ session, analysisRecord });
  const companyMotivationFit = await buildCompanyMotivationFit({
    session,
    transcript,
    companyValuesProfile,
  });

  const candidateFeedback = await generateCandidateFeedback({
    session,
    analysisResult,
    interviewPlan,
    evidenceSummary,
    interviewMetrics,
    strongestExamples: evidenceSummary.strongestExamples,
    deterministicFeedback,
    nzWorkplaceFit,
  });

  const draft = buildReportDraft({
    session,
    analysisResult,
    interviewPlan,
    retrievalBundle,
    explanation,
    evidenceSummary,
    interviewMetrics,
    candidateFeedback,
    evaluatorRecords: analysisRecord?.evaluatorRecords || [],
    trajectoryRecords: analysisRecord?.trajectoryRecords || [],
    reflectionRecords: analysisRecord?.reflectionRecords || [],
    userCoachingMemory,
    nzWorkplaceFit,
    companyMotivationFit,
  });

  return validateReportOutput(draft);
};
