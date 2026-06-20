import { callDeepSeek } from '../deepseekService.js';
import { validateReportOutput } from '../schemaValidationService.js';
import { ensureArray } from '../../utils/commonHelpers.js';

const normalizePrompt = (value = '') => String(value || '').trim().slice(0, 2000);

const extractJsonObject = (text = '') => {
  const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start >= 0 && end > start) return String(text).slice(start, end + 1);
  return String(text || '').trim();
};

const summarizeRetrieval = (retrievalBundle = null) => ensureArray(retrievalBundle?.items).slice(0, 8).map((item) => ({
  sourceType: item.sourceType || item.type || '',
  sourceId: item.sourceId || item.id || '',
  chunkId: item.chunkId || '',
  text: String(item.text || item.content || item.summary || '').slice(0, 500),
}));

const preserveOriginalValue = (original = {}, revised = {}, key = '') => (
  Object.prototype.hasOwnProperty.call(original, key) ? original[key] : revised[key]
);

const preserveTrustFields = (originalItems = [], revisedItems = []) => {
  const revised = ensureArray(revisedItems);
  return ensureArray(originalItems).map((original, index) => ({
    ...original,
    ...(revised[index] || {}),
    evidenceLabel: original.evidenceLabel || revised[index]?.evidenceLabel,
    confidenceLevel: original.confidenceLevel || revised[index]?.confidenceLevel,
    feedbackStatus: original.feedbackStatus || revised[index]?.feedbackStatus,
    evidenceSources: original.evidenceSources || revised[index]?.evidenceSources || [],
    evidenceReason: original.evidenceReason || revised[index]?.evidenceReason || '',
    needsUserConfirmation: original.needsUserConfirmation ?? revised[index]?.needsUserConfirmation ?? false,
    rubricType: preserveOriginalValue(original, revised[index] || {}, 'rubricType'),
    frameworkKey: preserveOriginalValue(original, revised[index] || {}, 'frameworkKey'),
    frameworkLabel: preserveOriginalValue(original, revised[index] || {}, 'frameworkLabel'),
    questionFamily: preserveOriginalValue(original, revised[index] || {}, 'questionFamily'),
    evidenceMode: preserveOriginalValue(original, revised[index] || {}, 'evidenceMode'),
    capabilityGroup: preserveOriginalValue(original, revised[index] || {}, 'capabilityGroup'),
    roleDomain: preserveOriginalValue(original, revised[index] || {}, 'roleDomain'),
    requirementCategory: preserveOriginalValue(original, revised[index] || {}, 'requirementCategory'),
    frameworkBreakdown: preserveOriginalValue(original, revised[index] || {}, 'frameworkBreakdown'),
    frameworkQualityScore: preserveOriginalValue(original, revised[index] || {}, 'frameworkQualityScore'),
    starApplicable: preserveOriginalValue(original, revised[index] || {}, 'starApplicable'),
    starBreakdown: preserveOriginalValue(original, revised[index] || {}, 'starBreakdown'),
    structureBreakdown: preserveOriginalValue(original, revised[index] || {}, 'structureBreakdown'),
    scores: preserveOriginalValue(original, revised[index] || {}, 'scores'),
    dimensionReasons: preserveOriginalValue(original, revised[index] || {}, 'dimensionReasons'),
  }));
};

export const preserveCandidateFeedbackSafety = (originalFeedback = {}, revisedFeedback = {}) => ({
  ...originalFeedback,
  ...revisedFeedback,
  strengthHighlights: preserveTrustFields(originalFeedback.strengthHighlights, revisedFeedback.strengthHighlights),
  improvementPriorities: preserveTrustFields(originalFeedback.improvementPriorities, revisedFeedback.improvementPriorities),
  coachingAdvice: preserveTrustFields(originalFeedback.coachingAdvice, revisedFeedback.coachingAdvice),
  turnBreakdowns: preserveTrustFields(originalFeedback.turnBreakdowns, revisedFeedback.turnBreakdowns),
});

const sanitizeVoiceClaims = (report = {}) => {
  const replaceUnsafe = (value) => String(value || '')
    .replace(/acoustic\s*\/\s*prosody/gi, 'transcript, VAD, and ASR metadata')
    .replace(/prosody model/gi, 'voice delivery metadata')
    .replace(/acoustic model/gi, 'voice delivery metadata')
    .replace(/tone analysis/gi, 'delivery signal analysis');

  return {
    ...report,
    summary: replaceUnsafe(report.summary),
    sections: ensureArray(report.sections).map((section) => ({
      ...section,
      content: replaceUnsafe(section.content),
    })),
  };
};

const buildRewritePrompt = ({ report = {}, qaResult = {}, session = {}, retrievalBundle = null, userPrompt = '' } = {}) => `Rewrite this interview coaching report using the user's instruction, but keep the report evidence-safe.

Return strict JSON only. Return the full report object, not markdown.

User rewrite instruction:
${userPrompt}

Safety rules:
- You may improve clarity, tone, structure, and concision.
- You may make the report more student-facing.
- You must not invent new evidence, skills, job requirements, interview answers, or reviewer ratings.
- You must not change scores unless the original report already contains those scores.
- You must preserve evidence labels, confidence levels, feedback statuses, evidence sources, needs_user_confirmation flags, and every deterministic framework field.
- You must not change rubricType, frameworkKey, frameworkLabel, questionFamily, evidenceMode, capabilityGroup, roleDomain, frameworkBreakdown, STAR applicability, or scores.
- You must not turn needs_user_confirmation into confirmed_feedback.
- You must not remove QA warnings by hiding them.
- If discussing voice delivery, describe it as transcript, VAD, and ASR metadata-based. Do not claim acoustic or prosody model analysis.
- Preserve the existing report schema as much as possible.

Context summary:
${JSON.stringify({
  targetRole: session.targetRole || session.roleTitle || '',
  mode: session.mode || session.interviewMode || session.settings?.mode || '',
  qaResult,
  retrievalEvidence: summarizeRetrieval(retrievalBundle),
}, null, 2)}

Original report JSON:
${JSON.stringify(report, null, 2)}`;

export const rewriteReportWithQaPrompt = async ({
  report = {},
  qaResult = {},
  session = {},
  retrievalBundle = null,
  userPrompt = '',
} = {}) => {
  const safePrompt = normalizePrompt(userPrompt);
  if (!safePrompt) {
    return {
      report,
      rewriteMetadata: {
        rewriteApplied: false,
        reason: 'empty_prompt',
      },
    };
  }

  try {
    const { content } = await callDeepSeek(
      buildRewritePrompt({ report, qaResult, session, retrievalBundle, userPrompt: safePrompt }),
      'You are a safe report rewrite controller. Return strict JSON only and preserve evidence grounding.',
      {
        usageMetadata: { stage: 'report_qa', operation: 'llm_json', feature: 'prompt_guided_report_rewrite' },
      },
    );

    const parsed = JSON.parse(extractJsonObject(content));
    const candidateReport = parsed.report && typeof parsed.report === 'object' ? parsed.report : parsed;
    const merged = sanitizeVoiceClaims({
      ...report,
      ...candidateReport,
      id: report.id || candidateReport.id,
      sessionId: report.sessionId || candidateReport.sessionId,
      schemaVersion: report.schemaVersion || candidateReport.schemaVersion,
      generatedAt: report.generatedAt || candidateReport.generatedAt,
      revisedAt: new Date().toISOString(),
      generationSource: 'qa_prompt_rewrite',
      scores: report.scores || candidateReport.scores,
      interviewMetrics: report.interviewMetrics || candidateReport.interviewMetrics,
      evidenceReferences: report.evidenceReferences || candidateReport.evidenceReferences || [],
      evidenceDiagnostics: report.evidenceDiagnostics || candidateReport.evidenceDiagnostics || {},
      candidateFeedback: preserveCandidateFeedbackSafety(report.candidateFeedback || {}, candidateReport.candidateFeedback || {}),
      qaRewriteInstruction: safePrompt,
    });

    return {
      report: validateReportOutput(merged),
      rewriteMetadata: {
        rewriteApplied: true,
        reason: 'prompt_guided_rewrite',
        userPrompt: safePrompt,
      },
    };
  } catch (error) {
    return {
      report,
      rewriteMetadata: {
        rewriteApplied: false,
        reason: 'rewrite_failed',
        error: error?.message || String(error),
        userPrompt: safePrompt,
      },
    };
  }
};
