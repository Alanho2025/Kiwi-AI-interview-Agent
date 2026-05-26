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
import { analyzeTurnStructure } from '../report/turnRubricService.js';
import { buildVoiceDeliverySummaryFromTranscript } from '../voice/voiceDeliveryAnalyzerService.js';
import { groundCandidateFeedbackClaims } from '../report/claimGroundingService.js';

const buildDeterministicTurnBreakdowns = (transcript = [], analysedAnswers = []) => {
  const userTurns = transcript.filter((turn) => turn.role === 'user');
  const aiTurns = transcript.filter((turn) => turn.role === 'ai');
  return userTurns.map((turn, index) => {
    const aiTurn = aiTurns[index] || {};
    const analysis = analysedAnswers[index] || {};
    const turnStructure = analyzeTurnStructure({
      question: aiTurn.text,
      answer: turn.text,
      metadata: aiTurn.metadata || {},
    });
    const mainMissing = turnStructure.structureBreakdown?.mainMissingElement || 'specificity';
    const nonStarFeedback = turnStructure.rubricType === 'self_intro'
      ? 'Strengthen this introduction by linking your background, role interest, and one relevant project or product example in a cleaner sequence.'
      : turnStructure.rubricType === 'company_motivation'
        ? 'Keep the role interest, but add one company-specific reason and connect it to your own AI/game/product experience.'
        : 'Answer the conversational prompt directly and keep the response concise.';
    return {
      question: aiTurn.text || 'Interview question',
      answer: turn.text || '',
      questionType: aiTurn.metadata?.questionType || aiTurn.metadata?.type || '',
      questionStage: aiTurn.metadata?.stage || '',
      questionTopic: aiTurn.metadata?.topic || '',
      rubricType: turnStructure.rubricType,
      starApplicable: turnStructure.starApplicable,
      structureLabel: turnStructure.structureLabel,
      structureBreakdown: turnStructure.structureBreakdown,
      starBreakdown: turnStructure.starBreakdown,
      feedback: turnStructure.starApplicable && mainMissing === 'result'
        ? 'Add a clearer result, impact, or lesson so the answer proves what changed.'
        : turnStructure.starApplicable
          ? `Strengthen the ${mainMissing} part of this STAR answer.`
          : nonStarFeedback,
      scores: {
        business: Math.min(10, 4 + Number(analysis.evidenceStrength || 0)),
        logic: Math.min(10, 4 + Math.round(Number((turnStructure.starBreakdown || turnStructure.structureBreakdown)?.totalScore || Object.values(turnStructure.structureBreakdown?.scores || {}).reduce((sum, value) => sum + Number(value || 0), 0)) / 2)),
        evidence: Math.min(10, 3 + Number(analysis.evidenceStrength || 0)),
      },
      dimensionReasons: {
        business: 'Scored from role relevance and whether the answer connects work to practical value.',
        logic: turnStructure.starApplicable
          ? 'Scored from STAR structure and answer sequence.'
          : `Scored from ${turnStructure.structureLabel.toLowerCase()} and answer sequence.`,
        evidence: 'Scored from direct evidence, validation, and measurable result signals.',
      },
    };
  }).filter((item) => item.answer);
};

const sanitizeNonStarFeedback = (turn = {}, fallback = {}) => {
  if (turn.starApplicable !== false) return turn.feedback || fallback.feedback || '';
  const feedback = String(turn.feedback || fallback.feedback || '');
  if (!/star|situation|task|action|result/i.test(feedback)) return feedback;
  if (turn.rubricType === 'self_intro') {
    return 'Strengthen this introduction by linking your background, role interest, and one relevant project or product example in a cleaner sequence.';
  }
  if (turn.rubricType === 'company_motivation') {
    return 'Keep the role interest, but add one company-specific reason and connect it to your own AI/game/product experience.';
  }
  return 'Answer this prompt directly and keep the response concise.';
};

const mergeTurnBreakdownsWithRubrics = (candidateTurns = [], deterministicTurns = []) => {
  const source = candidateTurns?.length ? candidateTurns : deterministicTurns;
  return source.map((turn, index) => {
    const fallback = deterministicTurns[index] || {};
    const merged = {
      ...turn,
      question: turn.question || fallback.question,
      answer: turn.answer || fallback.answer,
      questionType: fallback.questionType || turn.questionType || '',
      questionStage: fallback.questionStage || turn.questionStage || '',
      questionTopic: fallback.questionTopic || turn.questionTopic || '',
      rubricType: fallback.rubricType || turn.rubricType || 'star',
      starApplicable: fallback.starApplicable ?? turn.starApplicable ?? true,
      structureLabel: fallback.structureLabel || turn.structureLabel || 'STAR evidence',
      structureBreakdown: fallback.structureBreakdown || turn.structureBreakdown || turn.starBreakdown || null,
      starBreakdown: (fallback.starApplicable ?? turn.starApplicable ?? true) ? (turn.starBreakdown || fallback.starBreakdown) : null,
      dimensionReasons: {
        ...(turn.dimensionReasons || turn.scoreReasons || {}),
        ...(fallback.starApplicable === false ? fallback.dimensionReasons || {} : {}),
      },
    };
    return {
      ...merged,
      feedback: sanitizeNonStarFeedback(merged, fallback),
    };
  });
};

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
  const voiceDeliverySummary = buildVoiceDeliverySummaryFromTranscript(transcript, analysisRecord);
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
  const deterministicTurnBreakdowns = buildDeterministicTurnBreakdowns(transcript, analysedAnswers);
  const feedbackWithTurnFallback = {
    ...candidateFeedback,
    turnBreakdowns: mergeTurnBreakdownsWithRubrics(candidateFeedback.turnBreakdowns, deterministicTurnBreakdowns),
    communicationProfile: {
      ...(candidateFeedback.communicationProfile || {}),
      fillerWords: candidateFeedback.communicationProfile?.fillerWords
        || (voiceDeliverySummary
          ? `Voice delivery: ${voiceDeliverySummary.totalFillerCount} filler words, ${voiceDeliverySummary.totalLongPauseCount} long pauses, average pace ${voiceDeliverySummary.averageWordsPerMinute || 'unknown'} WPM.`
          : candidateFeedback.communicationProfile?.fillerWords || ''),
    },
  };
  const groundedFeedback = groundCandidateFeedbackClaims({
    candidateFeedback: feedbackWithTurnFallback,
    session,
    analysisResult,
    retrievalBundle,
  });

  const draft = buildReportDraft({
    session,
    analysisResult,
    interviewPlan,
    retrievalBundle,
    explanation,
    evidenceSummary,
    interviewMetrics,
    candidateFeedback: groundedFeedback.candidateFeedback,
    claimEvidenceReferences: groundedFeedback.claimEvidenceReferences,
    claimEvidenceDiagnostics: groundedFeedback.claimEvidenceDiagnostics,
    evaluatorRecords: analysisRecord?.evaluatorRecords || [],
    trajectoryRecords: analysisRecord?.trajectoryRecords || [],
    reflectionRecords: analysisRecord?.reflectionRecords || [],
    agentTraceEvents: analysisRecord?.agentTraceEvents || [],
    userCoachingMemory,
    nzWorkplaceFit,
    voiceDeliverySummary,
    companyMotivationFit,
  });

  return validateReportOutput(draft);
};
