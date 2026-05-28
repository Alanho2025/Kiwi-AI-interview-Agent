/**
 * File responsibility: Hard mode boundary guard for interview question control.
 * Main responsibilities:
 * - Keep selected interview mode as an enforced backend rule, not only a prompt hint.
 * - Rewrite technical-style questions when the user selected behavioural mode.
 * - Block LLM-generated wording from leaking across mode boundaries.
 */

import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { normalizeText, normalizeKey } from '../../utils/commonHelpers.js';

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


const BEHAVIOURAL_STAGE_PATTERN = /behavio[u]?ral|teamwork|conflict|communication|stakeholder|motivation|pressure|stress|failure|challenge|leadership|collaboration/i;

const BEHAVIOURAL_QUESTION_PATTERNS = [
  /tell\s+me\s+about\s+a\s+time/i,
  /describe\s+a\s+time/i,
  /give\s+me\s+one\s+specific\s+example/i,
  /what\s+was\s+your\s+exact\s+role\s+in\s+that\s+team/i,
  /how\s+did\s+you\s+(handle|manage)\s+.*(conflict|pressure|stakeholder|team|communication)/i,
  /what\s+did\s+you\s+learn\s+from\s+that\s+(challenge|mistake|experience)/i,
  /situation,?\s+.*action,?\s+.*result/i,
];

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


export const questionLooksBehavioural = (question = {}) => {
  const combined = [question.type, question.stage, question.category, question.topic, question.text]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join(' ');
  if (!combined) return false;
  if (BEHAVIOURAL_STAGE_PATTERN.test(`${question.type || ''} ${question.stage || ''} ${question.category || ''}`)) return true;
  return BEHAVIOURAL_QUESTION_PATTERNS.some((pattern) => pattern.test(combined));
};

export const generatedTextLooksBehavioural = (text = '') => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return BEHAVIOURAL_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
};

const buildTechnicalModeQuestion = ({ selectedQuestion = {}, targetTopic = '' } = {}) => {
  const safeQuestion = selectedQuestion || {};
  const topic = normalizeText(targetTopic || safeQuestion.topic || 'implementation') || 'implementation';
  return {
    type: 'technical_mode_guard_follow_up',
    stage: 'technical_core',
    topic,
    category: 'technical',
    followUpDepth: Math.max(0, Number(safeQuestion.followUpDepth || 0)),
    text: `Could you walk me through the technical approach you used for ${topic}? Please cover the tools, key implementation steps, and how you checked it worked.`,
    reason: 'The selected interview mode is technical, so the backend mode guard replaced a behavioural-style question with an implementation-focused technical question.',
    sourceType: 'mode_guard',
    modeGuardApplied: true,
    originalQuestion: safeQuestion?.text || null,
  };
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
  const safeQuestion = selectedQuestion || {};
  const topic = inferBehaviouralTopic({ targetTopic, latestAnswer, selectedQuestion: safeQuestion });
  return {
    type: 'behavioural_mode_guard_follow_up',
    stage: 'behavioural',
    topic,
    category: 'behavioural',
    followUpDepth: Math.max(1, Number(safeQuestion.followUpDepth || 0)),
    text: buildBehaviouralModeQuestionText({ topic, latestAnswer }),
    reason: reason || 'The selected interview mode is behavioural, so the backend mode guard rewrote a technical-style probe into a STAR-style behavioural follow-up.',
    sourceType: 'mode_guard',
    modeGuardApplied: true,
    originalQuestion: safeQuestion?.text || null,
  };
};

export const guardQuestionForInterviewMode = ({ focusArea = 'combined', actionType = '', selectedQuestion = null, targetTopic = '', latestAnswer = '' } = {}) => {
  const mode = normalizeInterviewMode(focusArea);
  if (!selectedQuestion || mode === 'combined') return selectedQuestion;
  if (selectedQuestion.type === 'company_motivation' || selectedQuestion.topic === 'company_and_role_motivation') return selectedQuestion;

  const stage = normalizeKey(`${selectedQuestion.stage || ''} ${selectedQuestion.category || ''}`);
  if (stage.includes('opening') || stage.includes('closing') || stage.includes('wrap')) return selectedQuestion;

  if (mode === 'behavioral') {
    const targetLooksTechnical = TECHNICAL_STAGE_PATTERN.test(normalizeText(targetTopic));
    const actionLooksTechnical = TECHNICAL_ACTIONS_IN_BEHAVIOURAL_MODE.has(actionType);
    const questionIsTechnical = questionLooksTechnical(selectedQuestion);

    if (!targetLooksTechnical && !actionLooksTechnical && !questionIsTechnical) {
      return selectedQuestion;
    }

    return buildBehaviouralModeQuestion({ selectedQuestion, targetTopic, latestAnswer });
  }

  if (mode === 'technical' && questionLooksBehavioural(selectedQuestion) && !questionLooksTechnical(selectedQuestion)) {
    return buildTechnicalModeQuestion({ selectedQuestion, targetTopic });
  }

  return selectedQuestion;
};

export const guardGeneratedTextForInterviewMode = ({ focusArea = 'combined', generatedText = '', fallbackText = '', selectedQuestion = null } = {}) => {
  const mode = normalizeInterviewMode(focusArea);
  const text = normalizeText(generatedText);
  if (mode === 'behavioral') {
    if (!generatedTextLooksTechnical(text)) return generatedText;
    return normalizeText(fallbackText) || 'Using that project as the context, tell me about one challenge you faced. What action did you personally take, and what result did it lead to?';
  }

  if (mode === 'technical') {
    const technicalFallback = normalizeText(fallbackText) || buildTechnicalModeQuestion({ selectedQuestion }).text;
    if (!generatedTextLooksBehavioural(text) || generatedTextLooksTechnical(text)) return generatedText;
    if (generatedTextLooksBehavioural(technicalFallback) && !generatedTextLooksTechnical(technicalFallback)) {
      return buildTechnicalModeQuestion({ selectedQuestion }).text;
    }
    return technicalFallback;
  }

  return generatedText;
};
