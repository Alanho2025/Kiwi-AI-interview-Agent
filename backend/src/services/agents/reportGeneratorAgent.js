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

const isCandidateTurn = (turn = {}) => turn.role === 'user' && String(turn.text || '').trim();

const isBridgeOrAcknowledgementTurn = (turn = {}) => {
  const metadata = turn.metadata || {};
  const text = String(turn.text || '').trim().toLowerCase();
  return metadata.countsAsQuestion === false
    || metadata.turnType === 'bridge_acknowledgement'
    || metadata.turnKind === 'bridge_acknowledgement'
    || metadata.sourceType === 'bridge_acknowledgement'
    || metadata.isAcknowledgement === true
    || /^(that helps|thanks|got it|i see|understood|that gives me)/i.test(text);
};

const isReportQuestionTurn = (turn = {}) => {
  if (!['ai', 'assistant', 'interviewer'].includes(turn.role)) return false;
  const text = String(turn.text || '').trim();
  if (!text || isBridgeOrAcknowledgementTurn(turn)) return false;

  const metadata = turn.metadata || {};
  if (metadata.countsAsQuestion === true) return true;
  if (metadata.questionType || metadata.type || metadata.stage || metadata.topic || metadata.preparedQuestionId) return true;
  return /[?？]\s*$/.test(text);
};

const buildQuestionAnswerPairs = (transcript = []) => {
  const pairs = [];
  let pendingQuestion = null;

  for (const turn of transcript) {
    if (isReportQuestionTurn(turn)) {
      pendingQuestion = turn;
      continue;
    }

    if (isCandidateTurn(turn)) {
      pairs.push({ questionTurn: pendingQuestion || {}, answerTurn: turn });
      pendingQuestion = null;
    }
  }

  return pairs;
};

const formatStarrElementName = (element = '') => String(element || 'resultOrReaction')
  .replace(/^resultOrReaction$/i, 'result')
  .replace(/([A-Z])/g, ' $1')
  .trim()
  .toLowerCase();

const hasMissingCoreStarrEvidence = (breakdown = {}) => [
  'situation',
  'task',
  'action',
  'resultOrReaction',
].some((key) => breakdown[key] === 'missing');

const buildStarrFeedback = ({ mainMissing = 'resultOrReaction', breakdown = {} } = {}) => {
  if (hasMissingCoreStarrEvidence(breakdown)) {
    return 'Add a clear situation, task, action, and result first. Then add a short reflection about what you learned or would improve.';
  }
  if (breakdown.reflection === 'missing') {
    return 'The core STAR structure is present. Add one short reflection about what you learned or what you would do better next time.';
  }
  if (mainMissing === 'resultOrReaction' || mainMissing === 'result') {
    return 'Add a clearer result, impact, or stakeholder reaction so the answer proves what changed.';
  }
  return `Strengthen the ${formatStarrElementName(mainMissing)} part of this STARR answer.`;
};

const buildFrameworkFeedback = (turnStructure = {}) => {
  const breakdown = turnStructure.frameworkBreakdown || {};
  const mainGap = breakdown.dimensions?.find((item) => item.key === breakdown.mainGapKey);
  if (!mainGap) return `Use the ${turnStructure.frameworkLabel || 'role-specific'} framework to make the reasoning and evidence clearer.`;
  return `Strengthen ${mainGap.label.toLowerCase()}: ${mainGap.reason}`;
};

export const buildDeterministicTurnBreakdowns = (transcript = [], analysedAnswers = []) => {
  const questionAnswerPairs = buildQuestionAnswerPairs(transcript);
  return questionAnswerPairs.map(({ questionTurn = {}, answerTurn = {} }, index) => {
    const analysis = analysedAnswers[index] || {};
    const turnStructure = analyzeTurnStructure({
      question: questionTurn.text,
      answer: answerTurn.text,
      metadata: questionTurn.metadata || {},
    });
    const breakdown = turnStructure.starBreakdown || turnStructure.starrBreakdown || turnStructure.structureBreakdown || {};
    const mainMissing = breakdown.mainMissingElement || 'specificity';
    const nonStarFeedback = turnStructure.rubricType === 'self_intro'
      ? 'Strengthen this introduction by linking your background, role interest, and one relevant project or product example in a cleaner sequence.'
      : turnStructure.rubricType === 'company_motivation'
        ? 'Keep the role interest, but add one company-specific reason and connect it to your own AI/game/product experience.'
        : turnStructure.rubricType === 'role_specific'
          ? buildFrameworkFeedback(turnStructure)
          : 'Answer the conversational prompt directly and keep the response concise.';
    const frameworkScore = Number(turnStructure.frameworkBreakdown?.normalizedScore || 0);
    return {
      question: questionTurn.text || 'Interview question',
      answer: answerTurn.text || '',
      questionType: questionTurn.metadata?.questionType || questionTurn.metadata?.type || '',
      questionStage: questionTurn.metadata?.stage || '',
      questionTopic: questionTurn.metadata?.topic || '',
      rubricType: turnStructure.rubricType,
      frameworkKey: turnStructure.frameworkKey,
      frameworkLabel: turnStructure.frameworkLabel,
      questionFamily: turnStructure.questionFamily,
      evidenceMode: turnStructure.evidenceMode,
      capabilityGroup: questionTurn.metadata?.capabilityGroup || '',
      roleDomain: questionTurn.metadata?.roleDomain || 'general',
      requirementCategory: questionTurn.metadata?.requirementCategory || questionTurn.metadata?.category || '',
      starApplicable: turnStructure.starApplicable,
      structureLabel: turnStructure.structureLabel,
      structureBreakdown: turnStructure.structureBreakdown,
      frameworkBreakdown: turnStructure.frameworkBreakdown || null,
      frameworkQualityScore: Number.isFinite(frameworkScore) ? frameworkScore : null,
      starBreakdown: turnStructure.starBreakdown || turnStructure.starrBreakdown || null,
      resultOrReactionLabel: turnStructure.resultOrReactionLabel,
      feedback: turnStructure.starApplicable
        ? buildStarrFeedback({ mainMissing, breakdown })
        : nonStarFeedback,
      scores: {
        business: Math.min(10, 4 + Number(analysis.evidenceStrength || 0)),
        logic: Math.min(10, 4 + Math.round(Number((turnStructure.starBreakdown || turnStructure.structureBreakdown)?.totalScore || Object.values(turnStructure.structureBreakdown?.scores || {}).reduce((sum, value) => sum + Number(value || 0), 0)) / 2)),
        evidence: Math.min(10, 3 + Number(analysis.evidenceStrength || 0)),
      },
      dimensionReasons: {
        business: 'Scored from role relevance and whether the answer connects work to practical value.',
        logic: turnStructure.starApplicable
          ? 'Scored from STARR structure and answer sequence.'
          : `Scored from ${turnStructure.structureLabel.toLowerCase()} and answer sequence.`,
        evidence: 'Scored from direct evidence, validation, and measurable result signals.',
      },
    };
  }).filter((item) => item.answer);
};

const sanitizeNonStarFeedback = (turn = {}, fallback = {}) => {
  if (turn.starApplicable !== false) return turn.feedback || fallback.feedback || '';
  const feedback = String(turn.feedback || fallback.feedback || '');
  const appliesStar = /\bstarr?\b/i.test(feedback)
    || /situation[\s\S]*task[\s\S]*action[\s\S]*result/i.test(feedback);
  if (!appliesStar) return feedback;
  if (turn.rubricType === 'role_specific') return fallback.feedback || 'Use the role-specific framework shown for this answer.';
  if (turn.rubricType === 'self_intro') {
    return 'Strengthen this introduction by linking your background, role interest, and one relevant project or product example in a cleaner sequence.';
  }
  if (turn.rubricType === 'company_motivation') {
    return 'Keep the role interest, but add one company-specific reason and connect it to your own AI/game/product experience.';
  }
  return 'Answer this prompt directly and keep the response concise.';
};

export const mergeTurnBreakdownsWithRubrics = (candidateTurns = [], deterministicTurns = []) => {
  const maxLength = Math.max(candidateTurns?.length || 0, deterministicTurns?.length || 0);
  return Array.from({ length: maxLength }).map((_, index) => {
    const turn = candidateTurns[index] || {};
    const fallback = deterministicTurns[index] || {};
    const hasAlignedFallback = Boolean(fallback.question || fallback.answer);
    const merged = {
      ...turn,
      question: hasAlignedFallback ? fallback.question : turn.question,
      answer: hasAlignedFallback ? fallback.answer : turn.answer,
      questionType: fallback.questionType || turn.questionType || '',
      questionStage: fallback.questionStage || turn.questionStage || '',
      questionTopic: fallback.questionTopic || turn.questionTopic || '',
      rubricType: fallback.rubricType || turn.rubricType || 'star',
      frameworkKey: fallback.frameworkKey || turn.frameworkKey || '',
      frameworkLabel: fallback.frameworkLabel || turn.frameworkLabel || '',
      questionFamily: fallback.questionFamily || turn.questionFamily || '',
      evidenceMode: fallback.evidenceMode || turn.evidenceMode || '',
      capabilityGroup: fallback.capabilityGroup || turn.capabilityGroup || '',
      roleDomain: fallback.roleDomain || turn.roleDomain || 'general',
      requirementCategory: fallback.requirementCategory || turn.requirementCategory || '',
      starApplicable: fallback.starApplicable ?? turn.starApplicable ?? true,
      structureLabel: fallback.structureLabel || turn.structureLabel || 'STARR evidence',
      structureBreakdown: fallback.structureBreakdown || turn.structureBreakdown || turn.starBreakdown || null,
      frameworkBreakdown: fallback.frameworkBreakdown || turn.frameworkBreakdown || null,
      frameworkQualityScore: fallback.frameworkQualityScore ?? turn.frameworkQualityScore ?? null,
      starBreakdown: (fallback.starApplicable ?? turn.starApplicable ?? true) ? (fallback.starBreakdown || turn.starBreakdown) : null,
      resultOrReactionLabel: fallback.resultOrReactionLabel || turn.resultOrReactionLabel,
      scores: fallback.scores || turn.scores || {},
      dimensionReasons: {
        ...(turn.dimensionReasons || turn.scoreReasons || {}),
        ...(fallback.dimensionReasons || {}),
      },
    };
    return {
      ...merged,
      feedback: sanitizeNonStarFeedback(merged, fallback),
    };
  }).filter((item) => item.question && item.answer);
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
  const deterministicTurnBreakdowns = buildDeterministicTurnBreakdowns(transcript, analysedAnswers);
  const deterministicFeedback = {
    ...buildDeterministicCandidateFeedback({
      analysisResult,
      explanation,
      evidenceSummary,
      interviewMetrics,
      interviewPlan,
      turnBreakdowns: deterministicTurnBreakdowns,
    }),
  };

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
    userCoachingMemory,
    nzWorkplaceFit,
    companyMotivationFit,
  });

  const validated = validateReportOutput({
    ...draft,
    metadata: {
      ...(draft.metadata || {}),
      claimEvidenceReferences: groundedFeedback.claimEvidenceReferences,
      claimEvidenceDiagnostics: groundedFeedback.claimEvidenceDiagnostics,
    },
  });
  return validated;
};
