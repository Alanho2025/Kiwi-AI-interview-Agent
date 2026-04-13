/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewerAgent should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { getNextPoolQuestion, hasReachedQuestionLimit } from '../interviewStateService.js';

const getLastUserAnswer = (transcript = []) => [...transcript].reverse().find((turn) => turn.role === 'user')?.text || '';
const tokenize = (value = '') => String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const buildRoleLockedQuestion = (retrievedItem, fallback = {}) => ({
  type: fallback.type || fallback.stage || 'technical_core',
  stage: fallback.stage || 'technical_core',
  topic: fallback.topic || retrievedItem.metadata?.skillTags?.[0] || retrievedItem.metadata?.category || 'role_fit',
  followUpDepth: fallback.followUpDepth || 0,
  text: retrievedItem.metadata?.question || retrievedItem.text,
  reason: `Retrieved from role-matched question bank (${retrievedItem.metadata?.roleCanonical || retrievedItem.metadata?.roleFamily || 'general'}).`,
  sourceType: retrievedItem.sourceType,
  sourceId: retrievedItem.sourceId,
});

const pickRetrievedQuestion = (retrievalBundle, selectedQuestion, targetTopic = '') => {
  if (!retrievalBundle?.items?.length) return null;
  const topicTokens = new Set(tokenize(targetTopic || selectedQuestion?.topic || ''));
  const desiredSource = selectedQuestion?.stage === 'behavioural' ? 'behavioural_bank' : 'question_bank';

  const sameStage = retrievalBundle.items.find((item) => {
    if (![desiredSource, 'question_bank', 'behavioural_bank'].includes(item.sourceType)) return false;
    const skillTags = item.metadata?.skillTags || [];
    if (!topicTokens.size) return item.sourceType === desiredSource;
    return skillTags.some((tag) => topicTokens.has(String(tag).toLowerCase())) || tokenize(item.metadata?.category || '').some((token) => topicTokens.has(token));
  });

  return sameStage
    || retrievalBundle.items.find((item) => item.sourceType === desiredSource)
    || retrievalBundle.items.find((item) => item.sourceType === 'question_bank' || item.sourceType === 'behavioural_bank')
    || null;
};

const inferEvidenceTypeHint = (question = {}) => {
  const stage = String(question.stage || question.type || '').toLowerCase();
  if (stage.includes('technical')) return 'direct_past_experience';
  if (stage.includes('experience')) return 'direct_past_experience';
  if (stage.includes('behavioural')) return 'direct_past_experience';
  if (stage.includes('wrap')) return 'candidate_questions';
  return 'adjacent_experience';
};

const buildProbingQuestion = ({ targetTopic = 'project', lastUserAnswer = '' } = {}) => ({
  type: 'probing_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  followUpDepth: 1,
  text: `Can you walk me through one concrete ${targetTopic} example, what you personally did, and what result it led to?`,
  reason: lastUserAnswer
    ? 'A probing question is needed because the latest answer was still broad and short on concrete evidence.'
    : 'A probing question is needed to collect one concrete example before moving on.',
  sourceType: 'controller_directed',
});

const buildValidationQuestion = ({ targetTopic = 'claim' } = {}) => ({
  type: 'validation_follow_up',
  stage: 'technical_validation',
  topic: targetTopic,
  followUpDepth: 1,
  text: `You mentioned ${targetTopic}. What exactly did you own, and how did you know it worked well in practice?`,
  reason: 'This question validates a claim that still needs direct supporting evidence.',
  sourceType: 'controller_directed',
});

const buildSwitchTopicQuestion = ({ targetTopic = 'role_fit' } = {}) => ({
  type: 'coverage_follow_up',
  stage: 'coverage',
  topic: targetTopic,
  followUpDepth: 0,
  text: `I would like to move to ${targetTopic}. Can you share one example that shows your experience in that area?`,
  reason: 'The controller switched topic because an important requirement has not been covered yet.',
  sourceType: 'controller_directed',
});

export const runInterviewerAgent = async ({
  session,
  retrievalBundle = null,
  actionType = AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
  decisionContext = null,
  evidenceBundle = null,
  targetTopic = null,
  probeType = null,
} = {}) => {
  const transcript = session?.transcript || [];
  const lastUserAnswer = getLastUserAnswer(transcript).toLowerCase();

  if (hasReachedQuestionLimit(session)) {
    return {
      questionType: 'wrap_up',
      nextQuestion: null,
      rationale: 'The planned interview question limit has been reached.',
      stage: 'wrap_up',
      topic: 'completed',
      followUpDepth: 0,
      retrievalSnapshot: retrievalBundle,
      isComplete: true,
      completedBecause: 'question_limit_reached',
    };
  }

  let selectedQuestion = getNextPoolQuestion(session);

  if (actionType === AGENT_ACTION_TYPES.ASK_PROBING_QUESTION) {
    selectedQuestion = buildProbingQuestion({
      targetTopic: targetTopic || decisionContext?.currentTopic || evidenceBundle?.validationTargets?.[0] || 'project',
      lastUserAnswer,
    });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION) {
    selectedQuestion = buildValidationQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'claim' });
  } else if (actionType === AGENT_ACTION_TYPES.SWITCH_TOPIC) {
    selectedQuestion = buildSwitchTopicQuestion({ targetTopic: targetTopic || decisionContext?.coverageState?.missingTopics?.[0] || 'role_fit' });
  } else if (actionType === AGENT_ACTION_TYPES.WRAP_STAGE) {
    selectedQuestion = {
      type: 'wrap_up',
      stage: 'wrap_up',
      topic: 'candidate_questions',
      followUpDepth: 0,
      text: 'Before we wrap up, what questions would you like to ask about the role or the team?',
      reason: 'The controller selected the wrap-up stage.',
      sourceType: 'controller_directed',
    };
  } else {
    const retrievedQuestion = pickRetrievedQuestion(retrievalBundle, selectedQuestion, targetTopic || decisionContext?.currentTopic || '');
    if (selectedQuestion && retrievedQuestion && !['opening', 'wrap_up'].includes(selectedQuestion.stage) && actionType !== AGENT_ACTION_TYPES.ASK_POOL_QUESTION) {
      selectedQuestion = buildRoleLockedQuestion(retrievedQuestion, selectedQuestion);
    }
  }

  if (!selectedQuestion) {
    selectedQuestion = {
      type: 'behavioural_follow_up',
      stage: 'behavioural',
      topic: lastUserAnswer.includes('team') ? 'teamwork' : probeType || 'problem_solving',
      followUpDepth: 1,
      text: lastUserAnswer.includes('team')
        ? 'What was your exact role in that team effort, and what result came from it?'
        : 'Can you give me one specific example that shows how you handled that in practice?',
      reason: 'Fallback follow-up when the structured role-linked pool is unavailable.',
      sourceType: 'fallback',
    };
  }

  return {
    questionType: selectedQuestion.type,
    nextQuestion: selectedQuestion.text,
    rationale: selectedQuestion.reason,
    rationaleSummary: selectedQuestion.reason,
    stage: selectedQuestion.stage,
    topic: selectedQuestion.topic,
    followUpDepth: selectedQuestion.followUpDepth || 0,
    sourceType: selectedQuestion.sourceType || 'agent_generated',
    evidenceTypeHint: inferEvidenceTypeHint(selectedQuestion),
    retrievalSnapshot: retrievalBundle,
    isComplete: false,
  };
};
