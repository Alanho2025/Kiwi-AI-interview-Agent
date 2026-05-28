import { callDeepSeek } from '../deepseekService.js';
import { ensureArray, normalizeText, unique } from '../../utils/commonHelpers.js';

const extractJsonObject = (text = '') => {
  const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start >= 0 && end > start) return String(text).slice(start, end + 1);
  return String(text || '').trim();
};

const buildFallbackDecision = ({ fallbackPlan = {}, localUnderstanding = {}, error = '' } = {}) => ({
  latestAnswerUnderstanding: {
    ...localUnderstanding,
    source: localUnderstanding?.source || 'local_js',
    modelDecisionError: error || null,
  },
  plan: {
    ...fallbackPlan,
    selectedAction: fallbackPlan.selectedAction,
    actionInput: fallbackPlan.actionInput || {},
    fallbackAction: fallbackPlan.selectedAction,
    modelSelectedAction: null,
    selectionSource: error ? 'agent_decision_fallback' : 'rule_fallback',
    modelSelectionError: error || null,
  },
});

const normalizeAgentDecision = (parsed = {}, localUnderstanding = {}) => ({
  source: 'local_js+voice_agent_decision',
  intent: normalizeText(parsed.intent) || localUnderstanding.intent,
  answerCompleteness: ['thin', 'partial', 'strong'].includes(parsed.answerCompleteness)
    ? parsed.answerCompleteness
    : localUnderstanding.answerCompleteness,
  keyFacts: unique([...(localUnderstanding.keyFacts || []), ...(parsed.keyFacts || [])]).slice(0, 12),
  technologies: unique([...(localUnderstanding.technologies || []), ...(parsed.technologies || [])]).slice(0, 10),
  metrics: unique([...(localUnderstanding.metrics || []), ...(parsed.metrics || [])]).slice(0, 8),
  ownershipSignals: unique([...(localUnderstanding.ownershipSignals || []), ...(parsed.ownershipSignals || [])]).slice(0, 8),
  evidenceSignals: unique([...(localUnderstanding.evidenceSignals || []), ...(parsed.evidenceSignals || [])]).slice(0, 8),
  frictionSignals: unique([...(localUnderstanding.frictionSignals || []), ...(parsed.frictionSignals || [])]).slice(0, 8),
  missingEvidence: unique(parsed.missingEvidence || localUnderstanding.missingEvidence || []).slice(0, 6),
  semanticOpportunity: normalizeText(parsed.semanticOpportunity) || localUnderstanding.semanticOpportunity || '',
  followUpValue: ['low', 'medium', 'high'].includes(parsed.followUpValue)
    ? parsed.followUpValue
    : localUnderstanding.followUpValue || '',
  confidence: Number.isFinite(Number(parsed.confidence))
    ? Math.max(0, Math.min(1, Number(parsed.confidence)))
    : Number(localUnderstanding.confidence || 0),
  suggestedFollowUp: {
    ...(localUnderstanding.suggestedFollowUp || {}),
    questionGoal: normalizeText(parsed.semanticOpportunity)
      || localUnderstanding.suggestedFollowUp?.questionGoal
      || 'ask one grounded follow-up question',
  },
});

const buildPrompt = ({
  decisionContext = {},
  evaluatorOutput = {},
  localUnderstanding = {},
  candidateActions = [],
  fallbackPlan = {},
} = {}) => `You are the model-assisted voice interview controller.

Your task:
1. Understand the candidate's latest answer.
2. Select the best next interview action from candidateActions only.
3. Keep the interview adaptive and evidence-seeking.
4. Preserve voice-mode latency by making one bounded decision.

Return JSON only with this exact shape:
{
  "intent": "technical_example | behavioural_example | clarification_needed | experience_example | general_answer",
  "answerCompleteness": "thin | partial | strong",
  "keyFacts": ["string"],
  "technologies": ["string"],
  "metrics": ["string"],
  "ownershipSignals": ["string"],
  "evidenceSignals": ["string"],
  "frictionSignals": ["string"],
  "missingEvidence": ["personal_ownership", "result_or_impact", "validation_method", "tradeoff_or_failure_detail"],
  "semanticOpportunity": "one short safe follow-up opportunity",
  "followUpValue": "low | medium | high",
  "selectedAction": "one action from candidateActions only",
  "selectedActionInput": {},
  "rationale": "one short operational reason",
  "confidence": 0.0
}

Rules:
- selectedAction MUST be one of candidateActions[].action.
- Do not invent action names.
- Do not override time limits, question limits, mode boundaries, safety rules, or wrap decisions.
- If the candidate answer has useful follow-up value, prefer a same-topic follow-up over switching topic.
- If the answer lacks personal ownership, validation, or result evidence, select an action that probes that gap.
- If the answer is unclear or likely misheard, select a clarification or rephrase action when available.
- Keep selectedActionInput small and grounded.
- Never invent facts that are not in the answer or context.

Context:
${JSON.stringify({
  currentStage: decisionContext.currentStage,
  currentTopic: decisionContext.currentTopic,
  focusArea: decisionContext.interviewStructure?.focusAreaKey || decisionContext.focusArea,
  currentObjective: decisionContext.currentObjective,
  latestAnswer: {
    text: decisionContext.environment?.latestAnswer?.text || decisionContext.latestAnswer || '',
    tokenCount: decisionContext.environment?.latestAnswer?.tokenCount,
  },
  plannerSignals: evaluatorOutput.plannerSignals || decisionContext.evaluatorState?.plannerSignals || {},
  evaluator: {
    suggestedNextMode: evaluatorOutput.suggestedNextMode || decisionContext.evaluatorState?.suggestedNextMode,
    evidenceGainScore: evaluatorOutput.evidenceGainScore ?? decisionContext.evaluatorState?.evidenceGainScore,
    specificity: evaluatorOutput.specificity,
    interactionStatus: evaluatorOutput.interactionStatus,
    repetitionRisk: evaluatorOutput.repetitionRisk,
    misunderstandingFlag: evaluatorOutput.misunderstandingFlag,
  },
  localUnderstanding,
  fallbackPlan: {
    selectedAction: fallbackPlan.selectedAction,
    actionInput: fallbackPlan.actionInput,
    rationale: fallbackPlan.rationale,
  },
  candidateActions,
}, null, 2)}`;

export const resolveVoiceAgentDecisionOnce = async ({
  decisionContext = {},
  evaluatorOutput = {},
  localUnderstanding = {},
  candidateActions = [],
  fallbackPlan = {},
  sessionSettings = {},
} = {}) => {
  const allowedCandidates = ensureArray(candidateActions).filter((candidate) => candidate?.action);
  if (
    fallbackPlan.allowModelSelection === false
    || sessionSettings.disableModelActionSelection === true
    || process.env.DISABLE_MODEL_ACTION_SELECTION === 'true'
  ) {
    return buildFallbackDecision({ fallbackPlan, localUnderstanding });
  }

  if (allowedCandidates.length <= 1) {
    return buildFallbackDecision({ fallbackPlan, localUnderstanding });
  }

  const allowedActions = new Set(allowedCandidates.map((candidate) => candidate.action));

  try {
    const { content } = await callDeepSeek(
      buildPrompt({
        decisionContext,
        evaluatorOutput,
        localUnderstanding,
        candidateActions: allowedCandidates,
        fallbackPlan,
      }),
      'You are a bounded model-assisted voice interview decision service. Return strict JSON only.',
      {
        usageMetadata: {
          stage: 'interview',
          operation: 'llm_json',
          feature: 'voice_agent_decision_once',
        },
      },
    );

    const parsed = JSON.parse(extractJsonObject(content));
    const selectedAction = normalizeText(parsed.selectedAction);

    if (!allowedActions.has(selectedAction)) {
      return buildFallbackDecision({
        fallbackPlan,
        localUnderstanding,
        error: `Model selected disallowed action: ${selectedAction || 'empty'}`,
      });
    }

    const selectedCandidate = allowedCandidates.find((candidate) => candidate.action === selectedAction) || {};
    const latestAnswerUnderstanding = normalizeAgentDecision(parsed, localUnderstanding);

    return {
      latestAnswerUnderstanding,
      plan: {
        ...fallbackPlan,
        selectedAction,
        actionInput: parsed.selectedActionInput && typeof parsed.selectedActionInput === 'object'
          ? { ...(selectedCandidate.actionInput || {}), ...parsed.selectedActionInput }
          : selectedCandidate.actionInput || fallbackPlan.actionInput || {},
        rationale: normalizeText(parsed.rationale) || selectedCandidate.reason || fallbackPlan.rationale,
        confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : fallbackPlan.confidence,
        fallbackAction: fallbackPlan.selectedAction,
        modelSelectedAction: selectedAction,
        selectionSource: 'voice_agent_decision_once',
        candidateActions: allowedCandidates,
        recommendedAction: fallbackPlan.recommendedAction,
        allowModelSelection: fallbackPlan.allowModelSelection,
        modelSelectionError: null,
      },
    };
  } catch (error) {
    return buildFallbackDecision({
      fallbackPlan,
      localUnderstanding,
      error: error?.message || String(error),
    });
  }
};
