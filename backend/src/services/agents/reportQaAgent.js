/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportQaAgent should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { validateReportQaOutput } from '../schemaValidationService.js';
import { validateAnswerRewrite } from '../report/reportContentQualityService.js';
import { extractAnswerEvidenceSignals } from '../report/answerEvidenceSignalService.js';
import { validateRubricQuestionAlignment } from '../report/turnRubricService.js';

export const BLOCKING_REPORT_FLAGS = new Set([
  'rubric_question_mismatch',
  'evidence_total_mismatch',
  'score_metric_mismatch',
  'invalid_answer_rewrite',
  'uninformative_evidence_references',
  'turn_export_count_mismatch',
  'unacknowledged_transcript_conflict',
  'role_intent_reference_missing',
  'answer_alignment_without_proof_point',
  'alignment_claim_not_grounded',
  'answer_alignment_score_out_of_range',
  'answer_alignment_missing_v2_dimensions',
  'answer_alignment_wrong_evidence_use',
  'company_claim_not_in_reviewed_profile',
  'evidence_id_not_found',
  'must_cover_intent_unreported',
  'role_fit_artifact_not_owned',
]);

const normalizeComparableText = (value = '') => String(value)
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const REQUIRED_ANSWER_ALIGNMENT_V2_DIMENSIONS = [
  'questionAlignment',
  'evidenceFit',
  'evidenceClarity',
  'roleIntentFit',
  'naturalness',
  'concision',
];

const scoreCoverage = (report = {}) => {
  const sections = Array.isArray(report.sections) ? report.sections.length : 0;
  const evidenceRefs = meaningfulEvidenceReferences(report.evidenceReferences).length;
  const metrics = report.interviewMetrics || {};
  const diagnostics = report.evidenceDiagnostics || {};
  let score = 0;
  score += Math.min(35, sections * 4);
  score += Math.min(20, evidenceRefs * 4);
  score += metrics.interviewerQuestionCount ? Math.min(20, (metrics.interviewerQuestionCount / Math.max(metrics.plannedQuestionCount || 1, 1)) * 20) : 0;
  score += diagnostics.averageStrength ? Math.min(25, (Number(diagnostics.averageStrength) / 4) * 25) : 0;
  return Math.round(Math.min(100, score));
};

const meaningfulEvidenceReferences = (references = []) => {
  const seen = new Set();
  return (Array.isArray(references) ? references : []).filter((item) => {
    const claim = String(item?.claim || item?.claimText || '').trim();
    const snippet = String(item?.evidenceSnippet || item?.evidenceSnippets?.[0]?.text || '').trim();
    const key = `${claim}|${item?.sourceType || ''}|${snippet}`.toLowerCase();
    if (!claim || !snippet || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getRoleFitIntegrity = (report = {}) => {
  const roleFit = report.roleFit || {};
  if ((!roleFit.schemaVersion && !roleFit.status) || roleFit.status === 'unavailable') return { flags: [], checks: [] };
  const alignments = Array.isArray(roleFit.answerAlignments) ? roleFit.answerAlignments : [];
  const knownRoleIntentIds = new Set(roleFit.knownRoleIntentIds || []);
  const knownEvidenceIds = new Set(roleFit.knownEvidenceIds || []);
  const requiredCoverageIds = new Set(roleFit.requiredCoverageIds || []);
  const reportedCoverageIds = new Set((roleFit.roleIntentCoverage?.items || []).map((item) => item.coverageId).filter(Boolean));
  const missingRoleIntentReference = alignments.some((alignment) => (
    (alignment.testedRoleIntentIds || []).some((id) => !knownRoleIntentIds.has(id))
  ));
  const alignmentWithoutProofPoint = alignments.some((alignment) => !alignment.proofPointId);
  const ungroundedAlignment = alignments.some((alignment) => (
    alignment.groundingStatus === 'blocked'
    || (alignment.label === 'strong' && !(alignment.detectedEvidenceUsed || []).length)
  ));
  const scoreOutOfRange = alignments.some((alignment) => (
    !Number.isFinite(Number(alignment.score))
    || Number(alignment.score) < 0
    || Number(alignment.score) > 100
  ));
  const missingV2Dimensions = alignments.some((alignment) => (
    alignment.schemaVersion === 'answer_alignment_v2'
    && REQUIRED_ANSWER_ALIGNMENT_V2_DIMENSIONS.some((dimension) => !Number.isFinite(Number(alignment.scoreBreakdown?.[dimension])))
  ));
  const wrongEvidenceUse = alignments.some((alignment) => alignment.evidenceUseDiagnosis?.status === 'wrong_example');
  const unreviewedCompanyClaim = (roleFit.companyClaims || []).some((claim) => claim.reviewed !== true);
  const unknownEvidenceId = alignments.some((alignment) => (
    (alignment.detectedEvidenceUsed || []).some((evidence) => !knownEvidenceIds.has(evidence.evidenceId))
  ));
  const unreportedMustCover = [...requiredCoverageIds].some((coverageId) => !reportedCoverageIds.has(coverageId));
  const ownershipInvalid = roleFit.ownership?.verified !== true;
  const checks = [
    ['role_fit_role_intents_known', !missingRoleIntentReference, 'role_intent_reference_missing'],
    ['answer_alignments_have_proof_points', !alignmentWithoutProofPoint, 'answer_alignment_without_proof_point'],
    ['answer_alignment_claims_grounded', !ungroundedAlignment, 'alignment_claim_not_grounded'],
    ['answer_alignment_scores_in_range', !scoreOutOfRange, 'answer_alignment_score_out_of_range'],
    ['answer_alignment_v2_dimensions_present', !missingV2Dimensions, 'answer_alignment_missing_v2_dimensions'],
    ['answer_alignment_uses_right_evidence', !wrongEvidenceUse, 'answer_alignment_wrong_evidence_use'],
    ['company_claims_reviewed', !unreviewedCompanyClaim, 'company_claim_not_in_reviewed_profile'],
    ['answer_alignment_evidence_ids_known', !unknownEvidenceId, 'evidence_id_not_found'],
    ['must_cover_intents_reported', !unreportedMustCover, 'must_cover_intent_unreported'],
    ['role_fit_artifacts_owned', !ownershipInvalid, 'role_fit_artifact_not_owned'],
  ];
  return {
    flags: checks.filter(([, passed]) => !passed).map(([, , flag]) => flag),
    checks: checks.map(([rule, passed]) => ({ rule, passed })),
  };
};

export const runReportQaAgent = async ({ report = {}, analysisResult = {}, retrievalBundle = null } = {}) => {
  const qualityFlags = [];
  const consistencyChecks = [];
  const metrics = report.interviewMetrics || {};
  const diagnostics = report.evidenceDiagnostics || {};
  const candidateFeedback = report.candidateFeedback || {};
  const coachingAdvice = candidateFeedback.coachingAdvice || [];
  const feedbackItems = [
    ...(candidateFeedback.strengthHighlights || []),
    ...(candidateFeedback.improvementPriorities || []),
    ...(candidateFeedback.coachingAdvice || []),
    ...(candidateFeedback.turnBreakdowns || []),
  ];
  const missingTrustFields = feedbackItems.filter((item) => !item.evidenceLabel || !item.confidenceLevel || !item.feedbackStatus).length;
  const turnBreakdowns = candidateFeedback.turnBreakdowns || [];
  const isBehaviouralTurn = (item = {}) => item.frameworkKey === 'behavioural_starr'
    || ['star', 'starr'].includes(item.rubricType);
  const isRoleSpecificTurn = (item = {}) => item.rubricType === 'role_specific';
  const hasCompleteStarrBreakdown = (item = {}) => {
    const breakdown = item.starBreakdown;
    if (!breakdown) return false;
    return [
      breakdown.situation,
      breakdown.task,
      breakdown.action,
      breakdown.resultOrReaction || breakdown.result,
      breakdown.reflection,
    ].every((status) => ['clear', 'partial', 'missing', 'not_applicable'].includes(status));
  };
  const missingStarBreakdowns = turnBreakdowns.filter((item) => (
    isBehaviouralTurn(item)
    && item.starApplicable !== false
    && !hasCompleteStarrBreakdown(item)
  )).length;
  const missingFrameworkBreakdowns = turnBreakdowns.filter((item) => (
    isRoleSpecificTurn(item)
    && !(item.frameworkBreakdown?.dimensions || []).length
  )).length;
  const roleSpecificStarMisapplied = turnBreakdowns.filter((item) => (
    isRoleSpecificTurn(item)
    && (item.starApplicable !== false || Boolean(item.starBreakdown))
  )).length;
  const selfIntroStarApplied = (candidateFeedback.turnBreakdowns || []).filter((item) => item.rubricType === 'self_intro' && item.starApplicable !== false).length;
  const highConfidenceUnsupported = feedbackItems.filter((item) => (
    item.confidenceLevel === 'high'
    && (item.evidenceLabel === 'needs_user_confirmation' || item.feedbackStatus === 'needs_confirmation' || item.feedbackStatus === 'refused_claim')
  )).length;
  const rewriteResults = (candidateFeedback.answerRewriteExamples || []).map((item) => ({
    item,
    quality: validateAnswerRewrite(item),
  }));
  const invalidReadyRewrites = rewriteResults.filter(({ item, quality }) => item.status !== 'unavailable' && !quality.valid);
  const placeholderRewrites = rewriteResults.filter(({ quality }) => quality.reasons.includes('contains_bracket_prompt') || quality.reasons.includes('contains_non_english_scaffold'));
  const unreadableRewrites = rewriteResults.filter(({ quality }) => quality.reasons.includes('contains_mojibake'));
  const knownQuestions = new Set(turnBreakdowns.map((item) => normalizeComparableText(item.question)).filter(Boolean));
  const mismatchedRewrites = rewriteResults.filter(({ item }) => item.question && knownQuestions.size > 0 && !knownQuestions.has(normalizeComparableText(item.question)));
  const meaningfulReferences = meaningfulEvidenceReferences(report.evidenceReferences);
  const rubricQuestionMismatches = turnBreakdowns.filter((item) => !validateRubricQuestionAlignment({
    question: item.question,
    rubric: item,
    metadata: item,
  }).passed);
  const evidenceTotal = [
    'direct_past_experience',
    'indirect_adjacent_experience',
    'hypothetical_understanding',
    'generic_filler',
  ].reduce((sum, key) => sum + Number(diagnostics.totals?.[key] || 0), 0);
  const scoredAnswerCount = Number(metrics.scoredCandidateAnswerCount || 0);
  const evidenceTotalMismatch = scoredAnswerCount > 0 && evidenceTotal !== scoredAnswerCount;
  const overallMetric = (candidateFeedback.plainEnglishMetrics || []).find((item) => item?.id === 'overall_fit');
  const scoreMetricMismatch = overallMetric
    && Number.isFinite(Number(report.scores?.overall))
    && Math.abs(Number(overallMetric.value) - Number(report.scores.overall)) > 0.01;
  const turnExportCountMismatch = scoredAnswerCount > 0 && turnBreakdowns.length !== scoredAnswerCount;
  const directExampleCount = Number(diagnostics.totals?.direct_past_experience || 0);
  const hasDirectExampleSignals = turnBreakdowns.some((item) => extractAnswerEvidenceSignals(item.answer).isDirectPastExperience);
  const conflictingTranscriptRisk = (report.transcriptRisks || []).some((risk) => risk.code === 'conflicting_metric_values');
  const transcriptRiskVisible = Boolean(report.sections?.find((section) => section.id === 'transcript_risks')?.content);
  const roleFitIntegrity = getRoleFitIntegrity(report);

  if (!report.summary) qualityFlags.push('missing_summary');
  if (!report.sections?.length) qualityFlags.push('missing_sections');
  if (!report.sections?.find((section) => section.id === 'interaction_feedback')) qualityFlags.push('missing_interaction_section');
  if ((analysisResult.explanation?.strengths || []).length && !String(report.sections?.find((section) => section.id === 'strengths')?.content || '').trim()) qualityFlags.push('missing_strength_coverage');
  if ((diagnostics.totals?.hypothetical_understanding || 0) > 0 && !String(report.sections?.find((section) => section.id === 'gaps')?.content || '').toLowerCase().includes('hypothetical')) qualityFlags.push('missing_hypothetical_gap_note');
  if (metrics.plannedQuestionCount && metrics.interviewerQuestionCount !== metrics.plannedQuestionCount) qualityFlags.push('question_count_mismatch');
  if ((metrics.extraAiTurnCount || 0) > 0) qualityFlags.push('extra_ai_turns_detected');
  if (!candidateFeedback.overallTakeaway) qualityFlags.push('missing_candidate_feedback');
  if (!(candidateFeedback.plainEnglishMetrics || []).length) qualityFlags.push('missing_metric_translation');
  if (!coachingAdvice.length) qualityFlags.push('missing_actionable_coaching');
  if (!(candidateFeedback.answerRewriteExamples || []).length) qualityFlags.push('missing_rewrite_examples');
  if (invalidReadyRewrites.length > 0) qualityFlags.push('invalid_answer_rewrite');
  if (placeholderRewrites.length > 0) qualityFlags.push('placeholder_answer_rewrite');
  if (unreadableRewrites.length > 0) qualityFlags.push('unreadable_answer_rewrite');
  if (mismatchedRewrites.length > 0) qualityFlags.push('rewrite_question_mismatch');
  if ((report.evidenceReferences || []).length > 0 && meaningfulReferences.length === 0) qualityFlags.push('uninformative_evidence_references');
  if (rubricQuestionMismatches.length > 0) qualityFlags.push('rubric_question_mismatch');
  if (evidenceTotalMismatch) qualityFlags.push('evidence_total_mismatch');
  if (scoreMetricMismatch) qualityFlags.push('score_metric_mismatch');
  if (turnExportCountMismatch) qualityFlags.push('turn_export_count_mismatch');
  if (directExampleCount === 0 && hasDirectExampleSignals) qualityFlags.push('real_example_count_mismatch');
  if (conflictingTranscriptRisk && !transcriptRiskVisible) qualityFlags.push('unacknowledged_transcript_conflict');
  if (typeof report.scores?.averageInteractionScore !== 'number') qualityFlags.push('missing_interaction_metrics');
  if (missingTrustFields > 0) qualityFlags.push('missing_feedback_trust_fields');
  if (missingStarBreakdowns > 0) qualityFlags.push('missing_star_breakdown');
  if (missingFrameworkBreakdowns > 0) qualityFlags.push('missing_framework_breakdown');
  if (roleSpecificStarMisapplied > 0) qualityFlags.push('role_specific_star_misapplied');
  if (selfIntroStarApplied > 0) qualityFlags.push('self_intro_star_misapplied');
  if ((diagnostics.repetitionComplaintCount || 0) > 0 && !String(report.sections?.find((section) => section.id === 'interaction_feedback')?.content || '').toLowerCase().includes('repeated questioning')) qualityFlags.push('missing_repetition_flow_warning');
  if (highConfidenceUnsupported > 0) qualityFlags.push('unsupported_high_confidence_feedback');
  if (!report.authenticityMetrics) qualityFlags.push('authenticity_metrics_missing');
  if ((report.transcriptRisks || []).length > 0 && !report.sections?.find((section) => section.id === 'transcript_risks')) qualityFlags.push('transcript_risk_not_visible');
  qualityFlags.push(...roleFitIntegrity.flags);

  const normalizedSummary = normalizeComparableText(report.summary || '');
  const normalizedDecisionLabel = normalizeComparableText(analysisResult.decision?.label || '');

  consistencyChecks.push({
    rule: 'decision_alignment',
    passed: !normalizedDecisionLabel || normalizedSummary.includes(normalizedDecisionLabel),
  });
  consistencyChecks.push(...roleFitIntegrity.checks);
  consistencyChecks.push({ rule: 'rubric_question_alignment', passed: rubricQuestionMismatches.length === 0 });
  consistencyChecks.push({ rule: 'evidence_totals_match_scored_answers', passed: !evidenceTotalMismatch });
  consistencyChecks.push({ rule: 'overall_score_metric_alignment', passed: !scoreMetricMismatch });
  consistencyChecks.push({ rule: 'all_scored_turns_exported', passed: !turnExportCountMismatch });
  consistencyChecks.push({ rule: 'evidence_presence', passed: (report.evidenceReferences || []).length > 0 || (retrievalBundle?.items || []).length > 0 });
  consistencyChecks.push({ rule: 'meaningful_evidence_presence', passed: meaningfulReferences.length > 0 });
  consistencyChecks.push({ rule: 'metrics_present', passed: Boolean(metrics.interviewerQuestionCount || metrics.candidateTurnCount) });
  consistencyChecks.push({ rule: 'candidate_feedback_present', passed: Boolean(candidateFeedback.overallTakeaway && coachingAdvice.length) });
  consistencyChecks.push({ rule: 'metric_translation_present', passed: (candidateFeedback.plainEnglishMetrics || []).length > 0 });
  consistencyChecks.push({ rule: 'interaction_feedback_present', passed: Boolean(report.sections?.find((section) => section.id === 'interaction_feedback')?.content) });
  consistencyChecks.push({ rule: 'feedback_trust_fields_present', passed: missingTrustFields === 0 });
  consistencyChecks.push({ rule: 'turn_star_breakdowns_present', passed: missingStarBreakdowns === 0 });
  consistencyChecks.push({ rule: 'turn_framework_breakdowns_present', passed: missingFrameworkBreakdowns === 0 });
  consistencyChecks.push({ rule: 'role_specific_not_star_scored', passed: roleSpecificStarMisapplied === 0 });
  consistencyChecks.push({ rule: 'self_intro_not_star_scored', passed: selfIntroStarApplied === 0 });
  consistencyChecks.push({ rule: 'unsupported_claims_downgraded', passed: highConfidenceUnsupported === 0 });
  consistencyChecks.push({
    rule: 'transcript_risks_visible',
    passed: !(report.transcriptRisks || []).length || Boolean(report.sections?.find((section) => section.id === 'transcript_risks')?.content),
  });

  const coverageScore = scoreCoverage(report);
  const hallucinationRisk = qualityFlags.some((flag) => ['question_count_mismatch', 'missing_hypothetical_gap_note'].includes(flag)) ? 'medium' : qualityFlags.length ? 'low_to_medium' : 'low';

  return validateReportQaOutput({
    schemaVersion: 'v3',
    reportId: report.id || report.sessionId || '',
    coverageScore,
    hallucinationRisk,
    qualityFlags,
    consistencyChecks,
    passed: !qualityFlags.some((flag) => BLOCKING_REPORT_FLAGS.has(flag))
      && qualityFlags.length === 0
      && consistencyChecks.every((item) => item.passed),
    diagnostics: {
      interviewerQuestionCount: metrics.interviewerQuestionCount || 0,
      plannedQuestionCount: metrics.plannedQuestionCount || 0,
      averageEvidenceStrength: diagnostics.averageStrength || 0,
      averageInteractionScore: report.scores?.averageInteractionScore || 0,
      reflectionCount: report.scores?.reflectionCount || 0,
      validationSummary: {
        feedbackItems: feedbackItems.length,
        missingTrustFields,
        missingStarBreakdowns,
        missingFrameworkBreakdowns,
        roleSpecificStarMisapplied,
        selfIntroStarApplied,
        highConfidenceUnsupported,
        claimEvidence: diagnostics.claimEvidence || {},
      },
    },
  });
};
