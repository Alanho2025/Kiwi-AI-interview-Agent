/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Handle QA failure loops by automatically triggering targeted LLM rewrites.
 * - Re-ground candidate feedback claims post-rewrite to prevent hallucinations.
 */

import { rewriteReportWithQaPrompt } from './reportRewriteService.js';
import { groundCandidateFeedbackClaims } from './claimGroundingService.js';
import { logger } from '../../utils/logger.js';
import { buildCandidateEvidenceReferences } from './reportEvidenceReferenceService.js';

const DETERMINISTIC_RECOMPUTE_FLAGS = new Set([
  'rubric_question_mismatch',
  'evidence_total_mismatch',
  'score_metric_mismatch',
  'uninformative_evidence_references',
  'turn_export_count_mismatch',
  'unacknowledged_transcript_conflict',
]);

export const buildRepairInstructionFromQa = (qaResult = {}) => {
  const flags = qaResult.qualityFlags || [];
  const failedChecks = (qaResult.consistencyChecks || []).filter((item) => !item.passed);

  const instructions = [];

  if (flags.includes('missing_feedback_trust_fields')) {
    instructions.push('Add or preserve evidenceLabel, confidenceLevel, feedbackStatus, evidenceSources, and needsUserConfirmation fields for every feedback item.');
  }

  if (flags.includes('missing_star_breakdown')) {
    instructions.push('Add STAR breakdowns only for STAR-applicable behavioural answers. Do not apply STAR to self-introduction or company motivation answers.');
  }

  if (flags.includes('missing_framework_breakdown')) {
    instructions.push('Restore the deterministic role-specific framework breakdown. Preserve its dimensions, statuses, scores, applicability, and main gap.');
  }

  if (flags.includes('role_specific_star_misapplied')) {
    instructions.push('Remove STAR from role-specific answers and preserve their role-specific framework classification and dimensions.');
  }

  if (flags.includes('self_intro_star_misapplied')) {
    instructions.push('Rewrite self-introduction feedback using an introduction-specific rubric instead of STAR scoring.');
  }

  if (flags.includes('unsupported_high_confidence_feedback')) {
    instructions.push('Downgrade unsupported high-confidence feedback to needs confirmation or medium/low confidence. Do not present weak evidence as confirmed.');
  }

  if (flags.includes('missing_actionable_coaching')) {
    instructions.push('Add specific next-step coaching advice grounded in the CV, JD, transcript, or NZ guide evidence.');
  }

  if (flags.includes('missing_metric_translation')) {
    instructions.push('Explain numeric scores in plain English so the user understands why the score was given.');
  }

  if (flags.includes('missing_rewrite_examples')) {
    instructions.push('Add answer rewrite examples without inventing new achievements, skills, or interview content.');
  }

  if (flags.some((flag) => ['invalid_answer_rewrite', 'placeholder_answer_rewrite', 'unreadable_answer_rewrite', 'rewrite_question_mismatch'].includes(flag))) {
    instructions.push('Regenerate only the stronger-answer wording as complete readable English. Preserve the exact question, candidate answer, scores, rubric, and evidence fields. Do not use placeholders or invent facts.');
  }

  if (failedChecks.length) {
    instructions.push(`Fix failed consistency checks: ${failedChecks.map((item) => item.rule).join(', ')}.`);
  }

  return instructions.join('\n');
};

export const runReportQaRepairLoop = async ({
  report = {},
  qaResult = {},
  session = {},
  retrievalBundle = null,
  maxAttempts = 2,
  agentRegistry,
} = {}) => {
  const repairHistory = [];
  let currentReport = report;
  let currentQaResult = qaResult;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (currentQaResult.passed) {
      break;
    }

    if ((currentQaResult.qualityFlags || []).some((flag) => DETERMINISTIC_RECOMPUTE_FLAGS.has(flag))) {
      logger.warn('Report QA requires deterministic regeneration; wording repair was skipped', {
        sessionId: session.id,
        flags: currentQaResult.qualityFlags,
      });
      break;
    }

    const repairInstruction = buildRepairInstructionFromQa(currentQaResult);
    if (!repairInstruction) {
      logger.warn('QA failed but no repair instructions could be generated', { sessionId: session.id, flags: currentQaResult.qualityFlags });
      break;
    }

    logger.info(`Starting QA repair loop attempt ${attempt}`, { sessionId: session.id });

    const rewriteResult = await rewriteReportWithQaPrompt({
      report: currentReport,
      qaResult: currentQaResult,
      session,
      retrievalBundle,
      userPrompt: repairInstruction,
    });

    // Mandatory post-repair grounding to prevent hallucination
    const groundedResult = groundCandidateFeedbackClaims({
      candidateFeedback: rewriteResult.report.candidateFeedback || {},
      session,
      analysisResult: session.analysisResult || {},
      retrievalBundle,
    });

    const groundedReport = {
      ...rewriteResult.report,
      candidateFeedback: groundedResult.candidateFeedback,
      evidenceReferences: buildCandidateEvidenceReferences(groundedResult.claimEvidenceReferences),
      evidenceDiagnostics: {
        ...(rewriteResult.report.evidenceDiagnostics || {}),
        claimEvidence: groundedResult.claimEvidenceDiagnostics,
      },
    };

    const newQaResult = await agentRegistry.reportQa({
      report: groundedReport,
      analysisResult: session.analysisResult || {},
      retrievalBundle,
    });

    repairHistory.push({
      attempt,
      qaBefore: currentQaResult,
      repairInstruction,
      rewriteMetadata: rewriteResult.rewriteMetadata,
      qaAfter: newQaResult,
      status: newQaResult.passed ? 'repaired' : 'repair_failed',
      createdAt: new Date().toISOString(),
    });

    currentReport = groundedReport;
    currentQaResult = newQaResult;
  }

  return {
    report: currentReport,
    qaResult: currentQaResult,
    repairHistory,
  };
};
