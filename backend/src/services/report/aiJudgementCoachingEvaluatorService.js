import { normalizeKey, normalizeText } from '../../utils/commonHelpers.js';

const AI_ML_QUESTION_TYPES = new Set([
  'ai_workflow',
  'ai_prompt_context',
  'ai_agent_reliability',
  'ai_retrieval',
  'ai_evaluation',
  'ai_judgement',
  'ml_foundation',
  'ml_evaluation',
  'ml_operations',
]);

const WORKFLOW_VERIFICATION_PATTERNS = [
  /\b(test|tests|testing|unit test|integration test|verif|validat|check|reviewed|inspection|benchmark|eval|golden set)\w*/i,
  /\b(ownership|debug|debugger|refactor|pull request|pr|commit|code review|human-in-the-loop)\w*/i,
  /\b(hallucination|fallback|guardrail|latency|cost|privacy|leakage|error rate|monitoring)\w*/i,
];

const AI_TOOL_NAME_PATTERNS = [
  /\b(copilot|cursor|claude|chatgpt|gpt|openai|gemini|codex|windsurf|aider|continue|mcp|langchain|llamaindex|rag|llm|ai agent|agent)\w*/i,
];

export const evaluateTurnAiJudgementCoaching = ({
  questionTurn = {},
  answerTurn = {},
} = {}) => {
  const metadata = questionTurn.metadata || {};
  const questionType = normalizeKey(metadata.questionType || metadata.questionIntent || metadata.type || '');
  const isAiMlQuestion = AI_ML_QUESTION_TYPES.has(questionType) || questionType.startsWith('ai_') || questionType.startsWith('ml_');

  if (!isAiMlQuestion) {
    return {
      aiJudgementStatus: 'not_ai_question',
      coachingFeedback: null,
      actionableTip: null,
    };
  }

  const answerText = normalizeText(answerTurn.text || '');

  const hasVerificationSignal = WORKFLOW_VERIFICATION_PATTERNS.some((pattern) => pattern.test(answerText));
  const hasToolNameSignal = AI_TOOL_NAME_PATTERNS.some((pattern) => pattern.test(answerText));

  if (hasVerificationSignal) {
    return {
      aiJudgementStatus: 'ai_workflow_verified',
      coachingFeedback: 'You clearly explained your personal verification and workflow ownership when utilizing AI tools.',
      actionableTip: 'Continue highlighting how you validate model output and manage quality and safety boundaries in production.',
    };
  }

  if (hasToolNameSignal) {
    return {
      aiJudgementStatus: 'ai_tools_named_only',
      coachingFeedback: 'You referenced AI tools or concepts; to strengthen your response, elaborate on how you personally verified the output and handled failure risks.',
      actionableTip: 'Always pair AI tool mentions with a concrete verification method (e.g. unit tests, code review, or golden set benchmark).',
    };
  }

  return {
    aiJudgementStatus: 'ai_workflow_unspecified',
    coachingFeedback: 'For AI-assisted workflows, ensure you explain what parts you personally owned and how you verified the final output.',
    actionableTip: 'Focus on your personal verification process and implementation ownership when discussing AI workflows.',
  };
};
