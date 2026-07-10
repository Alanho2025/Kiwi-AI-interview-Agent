/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportDraftBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { joinLabels } from './reportGeneratorShared.js';
import { buildCompactTraceSummary } from '../../aiControl/agentTraceService.js';
import { ensureArray } from '../../../utils/commonHelpers.js';
import { buildScoreExplanations, getScoreLimitations } from '../../report/reportScoringExplanationService.js';
import { evaluateAuthenticity } from '../../report/conversationalAuthenticityService.js';
import { buildReportScores, computeInterviewPerformanceScore } from '../../report/reportScoreService.js';
import { buildCandidateEvidenceReferences } from '../../report/reportEvidenceReferenceService.js';

export { computeInterviewPerformanceScore } from '../../report/reportScoreService.js';


export const buildSummary = ({ analysisResult, evidenceSummary, interviewMetrics, reflectionRecords = [] }) => {
  const direct = evidenceSummary.totals.direct_past_experience || 0;
  const adjacent = evidenceSummary.totals.indirect_adjacent_experience || 0;
  const hypothetical = evidenceSummary.totals.hypothetical_understanding || 0;
  const strengths = joinLabels(analysisResult.explanation?.strengths || [], 4);
  const reflections = ensureArray(reflectionRecords).length;

  const decision = resolveCandidateFacingDecision({ analysisResult, evidenceSummary, interviewMetrics });
  return `Decision: ${decision}. Top matched areas: ${strengths || 'role fit, communication'}. Direct evidence turns: ${direct}. Adjacent evidence turns: ${adjacent}. Hypothetical turns: ${hypothetical}. Planned questions answered: ${Math.min(interviewMetrics.candidateTurnCount, interviewMetrics.plannedQuestionCount || interviewMetrics.candidateTurnCount)} of ${interviewMetrics.plannedQuestionCount || interviewMetrics.candidateTurnCount}. Reflection records: ${reflections}.`;
};

const resolveCandidateFacingDecision = ({ analysisResult = {}, evidenceSummary = {}, interviewMetrics = {} } = {}) => {
  const rawDecision = analysisResult.decision?.label || 'manual_review';
  if (rawDecision === 'manual_review') return 'manual_review';
  const incomplete = !interviewMetrics.interviewCompletedByLimit && Number(interviewMetrics.plannedQuestionCount || 0) > 0;
  const weakEvidence = Number(evidenceSummary.averageStrength || 0) < 2;
  if (incomplete || weakEvidence) return 'insufficient_evidence';
  return rawDecision === 'not_qualified' ? 'needs_stronger_evidence' : rawDecision;
};

export const buildGapText = ({ analysisResult, evidenceSummary, interviewMetrics, candidateFeedback = {} }) => {
  const gaps = [];
  const hasPastExampleQuestion = ensureArray(candidateFeedback.turnBreakdowns).some((turn) => (
    turn.frameworkKey === 'behavioural_starr'
    || turn.rubricType === 'starr'
    || turn.evidenceMode === 'past_example'
  ));
  if ((evidenceSummary.totals.hypothetical_understanding || 0) > 0 && hasPastExampleQuestion) {
    gaps.push('Some past-example answers relied on hypothetical understanding rather than evidence from work the candidate actually completed.');
  }
  if ((evidenceSummary.totals.indirect_adjacent_experience || 0) > 0) gaps.push('Several answers were adjacent to the asked technology rather than direct role-specific evidence.');
  if (!interviewMetrics.interviewCompletedByLimit) gaps.push('The interview did not cleanly finish the planned question set.');
  if (!gaps.length && (analysisResult.explanation?.gaps || []).length) return joinLabels(analysisResult.explanation.gaps, 4);
  return gaps.join(' ');
};

export const buildStrongEvidenceText = (evidenceSummary = {}) => {
  if (!evidenceSummary.strongestExamples?.length) return 'No high-strength interview examples were captured.';
  return evidenceSummary.strongestExamples.map((item, index) => `Example ${index + 1}: ${item}`).join(' | ');
};

const buildInteractionFeedback = (evaluatorRecords = []) => {
  const records = ensureArray(evaluatorRecords);
  if (!records.length) return 'No interaction diagnostics were captured.';
  const average = (key) => Number((records.reduce((sum, item) => sum + Number(item[key] || 0), 0) / records.length).toFixed(2));
  return `Engagement ${average('engagementScore')}, turn-taking ${average('turnTakingScore')}, repair ${average('repairScore')}, appropriateness ${average('appropriatenessScore')}, overall interaction ${average('overallInteractionScore')}.`;
};

const buildReflectionMemoryText = (reflectionRecords = []) => {
  const records = ensureArray(reflectionRecords).slice(-3);
  if (!records.length) return 'No reflection memory was captured yet.';
  return records.map((item, index) => `Lesson ${index + 1}: ${item.lesson}`).join(' | ');
};

const buildCoachingMemoryText = (userCoachingMemory = {}) => {
  if (userCoachingMemory?.latestSummary) return userCoachingMemory.latestSummary;
  return 'No cross-session coaching memory was available.';
};

const buildNzWorkplaceFitText = (nzWorkplaceFit = {}) => {
  if (!nzWorkplaceFit.enabled) return 'NZ workplace communication coaching was not enabled for this session.';
  const scoreText = Number.isFinite(Number(nzWorkplaceFit.score)) ? `Score ${nzWorkplaceFit.score}/10. ` : '';
  const strengthText = ensureArray(nzWorkplaceFit.strengths).length
    ? `Strengths: ${nzWorkplaceFit.strengths.slice(0, 2).join(' ')} `
    : '';
  const gapText = ensureArray(nzWorkplaceFit.gaps).length
    ? `Gaps: ${nzWorkplaceFit.gaps.slice(0, 2).join(' ')}`
    : '';
  return `${scoreText}${nzWorkplaceFit.summary || ''} ${strengthText}${gapText}`.trim();
};

const buildCompanyMotivationFitText = (companyMotivationFit = {}) => {
  if (!companyMotivationFit?.summary) return 'Company and role motivation feedback was not available.';
  const availability = companyMotivationFit.source === 'official_website' || companyMotivationFit.source === 'manual'
    ? 'Company-specific sources were available and used for this section.'
    : 'Company-specific sources were not available, so the system used the general motivation rubric.';
  const nextImprovement = companyMotivationFit.suggestedRewrite
    || ensureArray(companyMotivationFit.missingValues).map((item) => item.suggestion).filter(Boolean)[0]
    || 'Before the next interview, prepare one company fact, one role-specific responsibility, and one personal project link.';

  return [
    `Company research availability: ${availability}`,
    `Candidate performance: ${companyMotivationFit.summary}`,
    `Next improvement: ${nextImprovement}`,
  ].join('\n');
};

const filterVoiceDeliveryFeedback = (feedback = []) => ensureArray(feedback)
  .filter((item) => !/situation|action|result|star/i.test(String(item || '')));

/**
 * Compute an interview performance score (0-100) from evidence analysis and AI turn scores.
 * Factors:
 *   1. Evidence strength average (0-4 scale → 0-100)        — 40% weight
 *   2. Direct experience ratio (direct turns / total turns)  — 30% weight
 *   3. AI turn breakdown average (0-10 scale → 0-100)        — 30% weight (if available)
 * When AI turn breakdowns are not available, weights redistribute to 55% / 45%.
 */
export const buildReportDraft = ({
  session = {},
  analysisResult = {},
  interviewPlan = {},
  retrievalBundle = null,
  explanation = {},
  evidenceSummary = {},
  interviewMetrics = {},
  candidateFeedback = {},
  claimEvidenceReferences = [],
  claimEvidenceDiagnostics = null,
  evaluatorRecords = [],
  trajectoryRecords = [],
  reflectionRecords = [],
  agentTraceEvents = [],
  userCoachingMemory = {},
  nzWorkplaceFit = {},
  voiceDeliverySummary = null,
  companyMotivationFit = {},
  scores = {},
  transcriptRisks = [],
  roleFit = {},
}) => {
  const strongEvidenceText = buildStrongEvidenceText(evidenceSummary);
  const candidateFacingDecision = resolveCandidateFacingDecision({ analysisResult, evidenceSummary, interviewMetrics });
  const hasHighStrengthInterviewEvidence = ensureArray(evidenceSummary.strongestExamples).length > 0;
  const averageInteractionScore = ensureArray(evaluatorRecords).length
    ? Number((ensureArray(evaluatorRecords).reduce((sum, item) => sum + Number(item.overallInteractionScore || 0), 0) / ensureArray(evaluatorRecords).length).toFixed(2))
    : 0;
  const resolvedClaimEvidenceReferences = ensureArray(claimEvidenceReferences);
  const resolvedClaimEvidenceDiagnostics = claimEvidenceDiagnostics || {
    totalClaims: resolvedClaimEvidenceReferences.length,
    downgradedClaims: resolvedClaimEvidenceReferences.filter((item) => item.degraded).length,
    needsConfirmationClaims: resolvedClaimEvidenceReferences.filter((item) => item.feedbackStatus === 'needs_confirmation').length,
  };
  const traceSummary = buildCompactTraceSummary({
    session,
    trajectoryRecords,
    agentTraceEvents,
    report: { candidateFeedback },
  });

  const baseScores = Object.keys(scores).length > 0
    ? scores
    : buildReportScores({
        cvJdScore: analysisResult.overallScore || 0,
        interviewScore: computeInterviewPerformanceScore(evidenceSummary, candidateFeedback),
        analysisResult,
        evidenceSummary,
      });
  const computedScores = {
    ...baseScores,
    averageInteractionScore,
    nzWorkplaceFit: Number.isFinite(Number(nzWorkplaceFit.score)) ? Number(nzWorkplaceFit.score) : null,
    trajectoryCount: ensureArray(trajectoryRecords).length,
    reflectionCount: ensureArray(reflectionRecords).length,
    evaluatedTurnCount: ensureArray(evaluatorRecords).length,
    voiceDeliveryConfidence: voiceDeliverySummary?.deliveryConfidence || null,
  };
  const roleEvidenceReferences = ensureArray(analysisResult.roleEvidenceMap?.items)
    .slice(0, 5)
    .map((item) => ({
      roleIntentId: item.roleIntentId || null,
      label: item.roleIntent || 'Role evidence',
      classification: item.classification || 'gap',
      evidenceIds: ensureArray(item.sourceEvidence).map((evidence) => evidence.evidenceId).filter(Boolean),
      sourceType: 'role_evidence_map',
    }));

  return {
    schemaVersion: 'v7',
    sessionId: session.id,
    candidateName: analysisResult.candidateName || session.candidateName || 'Candidate',
    jobTitle: analysisResult.jobTitle || session.targetRole || 'Target Role',
    generatedAt: new Date().toISOString(),
    summary: buildSummary({ analysisResult, evidenceSummary, interviewMetrics, reflectionRecords }),
    sections: [
      {
        id: 'match_overview',
        title: 'Match overview',
        content: `Overall score ${computedScores.overall || 0}, CV-JD match ${computedScores.cvJdMatch || 0}, confidence ${analysisResult.confidence || 0}. Candidate-facing decision: ${candidateFacingDecision}. Average evidence strength: ${evidenceSummary.averageStrength} out of 4.`,
      },
      {
        id: 'strengths',
        title: 'Strengths',
        content: explanation.strengths?.length
          ? hasHighStrengthInterviewEvidence
            ? `The clearest strengths were ${joinLabels(explanation.strengths)}. The strongest interview evidence showed real context, specific actions, validation steps, and measurable outcomes.`
            : `CV/JD and interview-adjacent signals suggest possible strengths in ${joinLabels(explanation.strengths)}, but the interview did not capture high-strength examples yet. Treat these as areas to prove with clearer examples.`
          : 'No standout strengths were captured.',
      },
      {
        id: 'gaps',
        title: 'Gaps',
        content: buildGapText({ analysisResult, evidenceSummary, interviewMetrics, candidateFeedback }) || 'No major gaps were captured.',
      },
      {
        id: 'interview_observations',
        title: 'Interview observations',
        content: `The session recorded ${interviewMetrics.interviewerQuestionCount} AI prompts, ${interviewMetrics.candidateTurnCount} candidate answers, and ${interviewMetrics.scoredCandidateAnswerCount || Math.min(interviewMetrics.interviewerQuestionCount || 0, interviewMetrics.candidateTurnCount || 0)} scored candidate answers. Focus areas: ${(interviewPlan.interviewFocus || []).join(', ') || 'general role fit'}.`,
      },
      {
        id: 'evidence_quality',
        title: 'Evidence quality',
        content: `Direct past-experience turns: ${evidenceSummary.totals.direct_past_experience || 0}. Adjacent-experience turns: ${evidenceSummary.totals.indirect_adjacent_experience || 0}. Hypothetical-understanding turns: ${evidenceSummary.totals.hypothetical_understanding || 0}. Generic turns: ${evidenceSummary.totals.generic_filler || 0}.`,
      },
      {
        id: 'evidence_examples',
        title: 'Evidence examples',
        content: strongEvidenceText,
      },
      {
        id: 'interaction_feedback',
        title: 'Interaction feedback',
        content: `${buildInteractionFeedback(evaluatorRecords)}${evidenceSummary.repetitionComplaintCount ? ` Candidate also flagged repeated questioning ${evidenceSummary.repetitionComplaintCount} time(s), so the interview flow should be treated as less reliable.` : ''}`,
      },
      ...(ensureArray(transcriptRisks).length ? [{
        id: 'transcript_risks',
        title: 'Transcript checks needed',
        content: ensureArray(transcriptRisks).map((risk) => risk.message).join(' '),
      }] : []),
      {
        id: 'voice_delivery',
        title: 'Voice delivery feedback',
        content: voiceDeliverySummary
          ? `Average pace ${voiceDeliverySummary.averageWordsPerMinute || 'unknown'} WPM. Filler words: ${voiceDeliverySummary.totalFillerCount || 0}. Long pauses: ${voiceDeliverySummary.totalLongPauseCount || 0}. ${filterVoiceDeliveryFeedback(voiceDeliverySummary.feedback).join(' ')}`
          : 'Voice delivery metrics were not captured for this session.',
      },
      {
        id: 'nz_workplace_fit',
        title: 'NZ workplace communication fit',
        content: buildNzWorkplaceFitText(nzWorkplaceFit),
      },
      {
        id: 'company_motivation_fit',
        title: 'Company & role motivation fit',
        content: buildCompanyMotivationFitText(companyMotivationFit),
      },
    ],
    scores: computedScores,
    reportTurnSummary: {
      countableQuestionCount: Number(interviewMetrics.interviewerQuestionCount || 0),
      scoredAnswerCount: Number(interviewMetrics.scoredCandidateAnswerCount || 0),
      exportedTurnCount: ensureArray(candidateFeedback.turnBreakdowns).length,
      repairTurnCount: Number(interviewMetrics.repairTurnCount || 0),
    },
    scoreExplanations: buildScoreExplanations({ scores: computedScores, evidenceSummary, candidateFeedback }),
    scoreLimitations: getScoreLimitations(),
    recommendations: [
      (evidenceSummary.totals.hypothetical_understanding || 0) > 0
        ? 'Make the applicable framework explicit: requirements or context, approach, judgement, risk or quality, validation, and outcome.'
        : 'Keep using concrete role-specific evidence with clear validation and outcomes.',
      interviewMetrics.interviewerQuestionCount !== (session.totalQuestions || interviewMetrics.interviewerQuestionCount)
        ? 'Align the interview flow so the number of asked questions matches the planned question count.'
        : 'Use the framework shown for each question type to tighten reasoning, evidence, and outcomes.',
    ],
    evidenceReferences: buildCandidateEvidenceReferences(resolvedClaimEvidenceReferences),
    interviewMetrics,
    evidenceDiagnostics: {
      totals: evidenceSummary.totals,
      averageStrength: evidenceSummary.averageStrength,
      claimEvidence: resolvedClaimEvidenceDiagnostics,
      repetitionComplaintCount: evidenceSummary.repetitionComplaintCount || 0,
      internalReflectionSummary: buildReflectionMemoryText(reflectionRecords),
      internalCoachingSummary: buildCoachingMemoryText(userCoachingMemory),
      internalSourceReferences: [
        ...roleEvidenceReferences,
        ...((retrievalBundle?.items || []).slice(0, 3).map((item) => ({
          chunkId: item.chunkId,
          label: item.metadata?.label || item.sourceType,
          sourceType: item.sourceType,
        }))),
      ],
    },
    traceSummary,
    nzWorkplaceFit,
    voiceDeliverySummary,
    transcriptRisks: ensureArray(transcriptRisks),
    roleFit,
    companyMotivationFit,
    authenticityMetrics: evaluateAuthenticity({ transcript: session.transcript || [], candidateFeedback }),
    candidateFeedback: {
      ...candidateFeedback,
      answerRewriteStatus: {
        readyCount: ensureArray(candidateFeedback.answerRewriteExamples).filter((item) => item.status === 'ready' && item.better).length,
        unavailableCount: ensureArray(candidateFeedback.answerRewriteExamples).filter((item) => item.status === 'unavailable' || !item.better).length,
      },
    },
  };
};
