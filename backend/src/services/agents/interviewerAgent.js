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

import { getNextPoolQuestion, hasReachedQuestionLimit } from '../interviewStateService.js';

/**
 * Purpose: Execute the main responsibility for getLastUserAnswer.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for pickRetrievedQuestion.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const pickRetrievedQuestion = (retrievalBundle, selectedQuestion) => {
  if (!retrievalBundle?.items?.length || !selectedQuestion) return null;
  const topicTokens = new Set(tokenize(selectedQuestion.topic || ''));
  const desiredSource = selectedQuestion.stage === 'behavioural' ? 'behavioural_bank' : 'question_bank';

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

/**
 * Purpose: Execute the main responsibility for inferEvidenceTypeHint.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const inferEvidenceTypeHint = (question = {}) => {
  const stage = String(question.stage || question.type || '').toLowerCase();
  if (stage.includes('technical')) return 'direct_past_experience';
  if (stage.includes('experience')) return 'direct_past_experience';
  if (stage.includes('behavioural')) return 'direct_past_experience';
  if (stage.includes('wrap')) return 'candidate_questions';
  return 'adjacent_experience';
};

/**
 * Purpose: Execute the main responsibility for runInterviewerAgent.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const runInterviewerAgent = async ({ session, retrievalBundle = null } = {}) => {
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

  const retrievedQuestion = pickRetrievedQuestion(retrievalBundle, selectedQuestion);
  if (selectedQuestion && retrievedQuestion && !['opening', 'wrap_up'].includes(selectedQuestion.stage)) {
    selectedQuestion = buildRoleLockedQuestion(retrievedQuestion, selectedQuestion);
  }

  if (!selectedQuestion) {
    selectedQuestion = {
      type: 'behavioural_follow_up',
      stage: 'behavioural',
      topic: lastUserAnswer.includes('team') ? 'teamwork' : 'problem_solving',
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
    stage: selectedQuestion.stage,
    topic: selectedQuestion.topic,
    followUpDepth: selectedQuestion.followUpDepth || 0,
    sourceType: selectedQuestion.sourceType || 'agent_generated',
    evidenceTypeHint: inferEvidenceTypeHint(selectedQuestion),
    retrievalSnapshot: retrievalBundle,
    isComplete: false,
  };
};
