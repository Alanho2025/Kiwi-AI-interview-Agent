import { callDeepSeek } from '../deepseekService.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim();

const extractJsonObject = (text = '') => {
  const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start >= 0 && end > start) return String(text).slice(start, end + 1);
  return String(text || '').trim();
};

const buildFallbackSelection = (fallbackPlan = {}, error = '') => ({
  ...fallbackPlan,
  selectedAction: fallbackPlan.selectedAction,
  actionInput: fallbackPlan.actionInput || {},
  fallbackAction: fallbackPlan.selectedAction,
  modelSelectedAction: null,
  selectionSource: 'rule_fallback',
  modelSelectionError: error || null,
});

const isModelSelectionEnabled = ({ sessionSettings = {} } = {}) => (
  sessionSettings.enableModelActionSelection === true
  || process.env.ENABLE_MODEL_ACTION_SELECTION === 'true'
);

const isModelSelectionDisabled = ({ sessionSettings = {}, fallbackPlan = {} } = {}) => (
  fallbackPlan.allowModelSelection === false
  || sessionSettings.disableModelActionSelection === true
  || process.env.DISABLE_MODEL_ACTION_SELECTION === 'true'
  || !isModelSelectionEnabled({ sessionSettings })
);

const buildSelectorPrompt = ({
  decisionContext = {},
  evaluatorOutput = {},
  latestAnswerUnderstanding = {},
  candidateActions = [],
  fallbackPlan = {},
} = {}) => `Choose the best next interview strategy from the allowed candidateActions only.

Return JSON only with this shape:
{
  "selectedAction": "ASK_DEEP_DIVE_QUESTION",
  "selectedActionInput": {},
  "rationale": "one short reason",
  "confidence": 0.0
}

Rules:
- Choose only an action string present in candidateActions.
- Do not invent action names.
- Do not override interview mode boundaries, final wrap decisions, authentication, privacy, safety, time limits, question limits, or report QA.
- Prefer the action that gathers the most useful evidence from the latest answer while staying within the selected mode.
- If a coverage switch is useful but the current answer has high follow-up value, prefer a same-topic follow-up.
- Keep rationale short and operational.

Context:
${JSON.stringify({
  currentStage: decisionContext.currentStage,
  currentTopic: decisionContext.currentTopic,
  focusArea: decisionContext.interviewStructure?.focusAreaKey || decisionContext.focusArea,
  currentObjective: decisionContext.currentObjective,
  plannerSignals: evaluatorOutput.plannerSignals || decisionContext.evaluatorState?.plannerSignals || {},
  evaluator: {
    suggestedNextMode: evaluatorOutput.suggestedNextMode || decisionContext.evaluatorState?.suggestedNextMode,
    evidenceGainScore: evaluatorOutput.evidenceGainScore ?? decisionContext.evaluatorState?.evidenceGainScore,
    specificity: evaluatorOutput.specificity,
    interactionStatus: evaluatorOutput.interactionStatus,
    repetitionRisk: evaluatorOutput.repetitionRisk,
  },
  latestAnswerUnderstanding: {
    intent: latestAnswerUnderstanding?.intent,
    answerCompleteness: latestAnswerUnderstanding?.answerCompleteness,
    missingEvidence: latestAnswerUnderstanding?.missingEvidence,
    semanticOpportunity: latestAnswerUnderstanding?.semanticOpportunity,
    followUpValue: latestAnswerUnderstanding?.followUpValue,
    confidence: latestAnswerUnderstanding?.confidence,
  },
  fallbackPlan: {
    selectedAction: fallbackPlan.selectedAction,
    actionInput: fallbackPlan.actionInput,
    rationale: fallbackPlan.rationale,
  },
  candidateActions,
}, null, 2)}`;

export const selectActionWithModel = async ({
  decisionContext = {},
  evaluatorOutput = {},
  latestAnswerUnderstanding = null,
  candidateActions = [],
  fallbackPlan = {},
  sessionSettings = {},
} = {}) => {
  const allowedCandidates = ensureArray(candidateActions).filter((candidate) => candidate?.action);
  if (isModelSelectionDisabled({ sessionSettings, fallbackPlan })) {
    return buildFallbackSelection(fallbackPlan, 'Model action selection disabled; using rule fallback.');
  }
  if (allowedCandidates.length <= 1) {
    return buildFallbackSelection(fallbackPlan, 'Only one candidate action available.');
  }

  const allowedActions = new Set(allowedCandidates.map((candidate) => candidate.action));
  try {
    const { content } = await callDeepSeek(
      buildSelectorPrompt({
        decisionContext,
        evaluatorOutput,
        latestAnswerUnderstanding,
        candidateActions: allowedCandidates,
        fallbackPlan,
      }),
      'You are a bounded interview action selector. Return strict JSON only.',
      {
        usageMetadata: { stage: 'interview', operation: 'llm_json', feature: 'model_action_selection' },
      },
    );
    const parsed = JSON.parse(extractJsonObject(content));
    const selectedAction = normalizeText(parsed.selectedAction);
    if (!allowedActions.has(selectedAction)) {
      return buildFallbackSelection(fallbackPlan, `Model selected disallowed action: ${selectedAction || 'empty'}`);
    }

    const selectedCandidate = allowedCandidates.find((candidate) => candidate.action === selectedAction) || {};
    return {
      ...fallbackPlan,
      selectedAction,
      actionInput: parsed.selectedActionInput && typeof parsed.selectedActionInput === 'object'
        ? { ...(selectedCandidate.actionInput || {}), ...parsed.selectedActionInput }
        : selectedCandidate.actionInput || fallbackPlan.actionInput || {},
      rationale: normalizeText(parsed.rationale) || selectedCandidate.reason || fallbackPlan.rationale,
      confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : fallbackPlan.confidence,
      fallbackAction: fallbackPlan.selectedAction,
      modelSelectedAction: selectedAction,
      selectionSource: 'model_assisted',
      candidateActions: allowedCandidates,
      recommendedAction: fallbackPlan.recommendedAction,
      allowModelSelection: fallbackPlan.allowModelSelection,
      modelSelectionError: null,
    };
  } catch (error) {
    return buildFallbackSelection(fallbackPlan, error?.message || String(error));
  }
};
