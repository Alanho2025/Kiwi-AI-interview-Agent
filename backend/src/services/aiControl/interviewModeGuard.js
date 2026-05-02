/**
 * File responsibility: Hard mode boundary guard for interview question control.
 * Main responsibilities:
 * - Keep selected interview mode as an enforced backend rule, not only a prompt hint.
 * - Rewrite technical-style questions when the user selected behavioural mode.
 * - Block LLM-generated wording from leaking across mode boundaries.
 */

import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';

const normalizeText = (value = '') => String(value || '').trim();
const normalizeKey = (value = '') => normalizeText(value).toLowerCase().replace('behavioural', 'behavioral');

const TECHNICAL_STAGE_PATTERN = /technical|implementation|architecture|system[_\s-]?design|coding|algorithm|pipeline|schema|query|model|ml|machine[_\s-]?learning|engineering/i;

const TECHNICAL_QUESTION_PATTERNS = [
  /technical\s+(side|skill|depth|example|details?)/i,
  /walk\s+me\s+through\s+.*(implementation|pipeline|architecture|training|testing|model|algorithm|libraries|query|schema|code)/i,
  /what\s+(python\s+)?libraries?\s+did\s+you\s+(choose|use)/i,
  /training\s+and\s+testing\s+pipeline/i,
  /train(?:ing)?\s*\/\s*test(?:ing)?\s+(split|pipeline)/i,
  /how\s+did\s+you\s+(implement|code|structure|build)\s+.*(pipeline|model|database|api|architecture|algorithm)/i,
  /sql\s+(query|schema|join|index)/i,
  /database\s+(schema|query|index|normalization|normalisation)/i,
  /model\s+(accuracy|precision|recall|f1|evaluation|performance)/i,
  /api\s+(design|endpoint|integration)/i,
  /10x\s+the\s+traffic|scal(e|ing)|latency|throughput/i,
];

const TECHNICAL_ACTIONS_IN_BEHAVIOURAL_MODE = new Set([
  AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
  AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION,
  AGENT_ACTION_TYPES.PROBE_STRESS,
]);

export const normalizeInterviewMode = (value = 'combined') => {
  const normalized = normalizeKey(value || 'combined');
  if (normalized === 'technical') return 'technical';
  if (normalized === 'behavioral') return 'behavioral';
  return 'combined';
};

export const questionLooksTechnical = (question = {}) => {
  const combined = [question.type, question.stage, question.category, question.topic, question.text]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join(' ');
  if (!combined) return false;
  if (TECHNICAL_STAGE_PATTERN.test(`${question.type || ''} ${question.stage || ''} ${question.category || ''}`)) return true;
  return TECHNICAL_QUESTION_PATTERNS.some((pattern) => pattern.test(combined));
};

export const generatedTextLooksTechnical = (text = '') => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return TECHNICAL_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
};

const inferBehaviouralTopic = ({ targetTopic = '', latestAnswer = '', selectedQuestion = {} } = {}) => {
  const source = `${targetTopic} ${selectedQuestion.topic || ''} ${latestAnswer}`.toLowerCase();
  if (/disagree|conflict|opinion|stakeholder|team|discuss|consensus|communication/.test(source)) return 'collaboration_conflict';
  if (/pressure|deadline|stress|urgent|emergency|constraint/.test(source)) return 'pressure_and_prioritisation';
  if (/mistake|fail|error|wrong|challenge|difficult/.test(source)) return 'learning_from_challenge';
  if (/dashboard|python|model|data|database|project|analysis/.test(source)) return 'project_behaviour';
  return 'behavioural_example';
};

const buildBehaviouralModeQuestionText = ({ topic = 'behavioural_example', latestAnswer = '' } = {}) => {
  const answer = latestAnswer.toLowerCase();
  if (topic === 'collaboration_conflict') {
    return 'Tell me about that disagreement in the project. What was the situation, what did you personally do, and what was the result?';
  }
  if (topic === 'pressure_and_prioritisation') {
    return 'Tell me about a time you had to work under pressure. What made it difficult, what action did you take, and what changed because of your action?';
  }
  if (topic === 'learning_from_challenge') {
    return 'Tell me about one challenge from that experience. What did you do first, how did you adjust, and what did you learn?';
  }
  if (/python|model|machine learning|database|dashboard|data/.test(answer) || topic === 'project_behaviour') {
    return 'Using that project as the context, tell me about one challenge you faced. What action did you personally take, and what result did it lead to?';
  }
  return 'Can you give me one specific example that shows your behaviour in that situation? Please cover the situation, your personal action, and the result.';
};

export const buildBehaviouralModeQuestion = ({ selectedQuestion = {}, targetTopic = '', latestAnswer = '', reason = '' } = {}) => {
  const topic = inferBehaviouralTopic({ targetTopic, latestAnswer, selectedQuestion });
  return {
    type: 'behavioural_mode_guard_follow_up',
    stage: 'behavioural',
    topic,
    category: 'behavioural',
    followUpDepth: Math.max(1, Number(selectedQuestion.followUpDepth || 0)),
    text: buildBehaviouralModeQuestionText({ topic, latestAnswer }),
    reason: reason || 'The selected interview mode is behavioural, so the backend mode guard rewrote a technical-style probe into a STAR-style behavioural follow-up.',
    sourceType: 'mode_guard',
    modeGuardApplied: true,
    originalQuestion: selectedQuestion?.text || null,
  };
};

export const guardQuestionForInterviewMode = ({ focusArea = 'combined', actionType = '', selectedQuestion = null, targetTopic = '', latestAnswer = '' } = {}) => {
  const mode = normalizeInterviewMode(focusArea);
  if (!selectedQuestion || mode !== 'behavioral') return selectedQuestion;

  const targetLooksTechnical = TECHNICAL_STAGE_PATTERN.test(normalizeText(targetTopic));
  const actionLooksTechnical = TECHNICAL_ACTIONS_IN_BEHAVIOURAL_MODE.has(actionType);
  const questionIsTechnical = questionLooksTechnical(selectedQuestion);

  if (!targetLooksTechnical && !actionLooksTechnical && !questionIsTechnical) {
    return selectedQuestion;
  }

  return buildBehaviouralModeQuestion({ selectedQuestion, targetTopic, latestAnswer });
};

export const guardGeneratedTextForInterviewMode = ({ focusArea = 'combined', generatedText = '', fallbackText = '' } = {}) => {
  const mode = normalizeInterviewMode(focusArea);
  if (mode !== 'behavioral') return generatedText;
  if (!generatedTextLooksTechnical(generatedText)) return generatedText;
  return normalizeText(fallbackText) || 'Using that project as the context, tell me about one challenge you faced. What action did you personally take, and what result did it lead to?';
};
