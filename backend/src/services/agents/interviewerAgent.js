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

const normalizeText = (value = '') => String(value || '').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const getLastUserAnswer = (transcript = []) => [...transcript].reverse().find((turn) => turn.role === 'user')?.text || '';

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

const buildProbingQuestion = ({ targetTopic = 'project' } = {}) => ({
  type: 'probing_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  followUpDepth: 1,
  text: `Can you walk me through one concrete ${targetTopic} example, what you personally did, and what result it led to?`,
  reason: 'A probing question is needed to collect one concrete example before moving on.',
  sourceType: 'controller_directed',
});

const buildRephrasedQuestion = ({ targetTopic = 'project', environment = {} } = {}) => ({
  type: 'rephrased_follow_up',
  stage: environment?.questionContext?.latestQuestionStage || 'clarification',
  topic: targetTopic,
  followUpDepth: 1,
  text: `Let me rephrase that more clearly. For ${targetTopic}, please pick one real example and tell me your role, what you did, and the outcome.`,
  reason: 'The evaluator detected likely misunderstanding, so the interviewer should restate the question with a tighter structure.',
  sourceType: 'controller_directed',
});

const buildDeepDiveQuestion = ({ targetTopic = 'project' } = {}) => ({
  type: 'deep_dive_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  followUpDepth: 2,
  text: `Staying with ${targetTopic}, what trade-off, difficulty, or decision did you handle yourself, and how did you judge whether it worked?`,
  reason: 'The latest answer was usable but still partial, so a deeper question should capture decision quality and ownership.',
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

const buildAbductiveProbeQuestion = ({ targetTopic = 'decision_tradeoff', hiddenGap = '' } = {}) => ({
  type: 'abductive_probe_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  followUpDepth: 2,
  text: `You hinted at ${hiddenGap || targetTopic}. What was the hardest trade-off or gap there, and how did you handle it in practice?`,
  reason: 'The controller inferred a hidden gap that should be tested before moving on.',
  sourceType: 'controller_directed',
});

const buildSectionShiftQuestion = ({ nextSectionKey = 'motivation' } = {}) => ({
  type: 'section_shift_follow_up',
  stage: nextSectionKey,
  topic: nextSectionKey,
  followUpDepth: 0,
  text: nextSectionKey === 'motivation'
    ? 'Let us shift to motivation. What makes this role a strong fit for you now?'
    : nextSectionKey === 'behavioural'
      ? 'Let us move to teamwork and problem solving. Can you share one situation where you had to work through a challenge with others?'
      : nextSectionKey === 'technical'
        ? 'Let us move to technical depth. Can you share one example where you made an important implementation or design decision?'
        : nextSectionKey === 'reflection_close'
          ? 'Before we close, what would you improve about one of your past answers or examples if you could answer again?'
          : `Let us move to ${nextSectionKey}. Can you share one concrete example from that area?`,
  reason: 'The current section is sufficiently covered, so the interviewer is moving to the next planned section.',
  sourceType: 'controller_directed',
});

const buildReactTrace = ({ selectedAction, decisionContext, selectedQuestion, environment, evaluatorState }) => {
  const targetTopic = selectedQuestion?.topic || decisionContext?.currentTopic || environment?.questionContext?.latestQuestionTopic || 'role_fit';
  const thoughtParts = [
    `Current section: ${decisionContext?.sectionState?.sectionKey || decisionContext?.currentStage || environment?.questionContext?.latestQuestionStage || 'opening'}.`,
    `Target topic: ${targetTopic}.`,
  ];
  if (decisionContext?.coverageState?.missingTopics?.length) thoughtParts.push(`Missing topics still include ${decisionContext.coverageState.missingTopics.slice(0, 2).join(', ')}.`);
  if (decisionContext?.matchState?.validationTargets?.length) thoughtParts.push(`Validation targets remain for ${decisionContext.matchState.validationTargets.slice(0, 2).join(', ')}.`);
  if (decisionContext?.abductiveState?.shouldProbe) thoughtParts.push(`Hidden gap inferred: ${decisionContext.abductiveState.hiddenGap}.`);
  if (evaluatorState?.misunderstandingFlag) thoughtParts.push('The evaluator signalled likely misunderstanding on the previous answer.');
  else if (evaluatorState?.evidenceGainScore != null) thoughtParts.push(`Latest evidence gain was ${evaluatorState.evidenceGainScore}.`);
  return {
    thoughtSummary: thoughtParts.join(' '),
    actionName: selectedAction,
    observationSummary: environment?.latestAnswer?.text
      ? `Latest answer length was ${environment.latestAnswer.tokenCount} tokens with interaction status ${evaluatorState?.interactionStatus || 'unknown'}.`
      : 'No user answer has been observed yet in the current controller step.',
  };
};

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
  const environment = decisionContext?.environment || null;
  const evaluatorState = decisionContext?.evaluatorState || null;

  if (hasReachedQuestionLimit(session)) {
    const reactTrace = buildReactTrace({
      selectedAction: AGENT_ACTION_TYPES.WRAP_STAGE,
      decisionContext,
      selectedQuestion: { stage: 'wrap_up', topic: 'completed' },
      environment,
      evaluatorState,
    });
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
      reactTrace,
    };
  }

  let selectedQuestion = getNextPoolQuestion(session);

  if (actionType === AGENT_ACTION_TYPES.ASK_PROBING_QUESTION) {
    selectedQuestion = buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || evidenceBundle?.validationTargets?.[0] || 'project' });
  } else if (actionType === AGENT_ACTION_TYPES.REPHRASE_QUESTION) {
    selectedQuestion = buildRephrasedQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project', environment });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION) {
    selectedQuestion = buildDeepDiveQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project' });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION) {
    selectedQuestion = buildValidationQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'claim' });
  } else if (actionType === AGENT_ACTION_TYPES.SWITCH_TOPIC) {
    selectedQuestion = buildSwitchTopicQuestion({ targetTopic: targetTopic || decisionContext?.coverageState?.missingTopics?.[0] || 'role_fit' });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION) {
    selectedQuestion = buildAbductiveProbeQuestion({ targetTopic: targetTopic || decisionContext?.abductiveState?.probeTopic || 'decision_tradeoff', hiddenGap: decisionContext?.abductiveState?.hiddenGap || '' });
  } else if (actionType === AGENT_ACTION_TYPES.SHIFT_SECTION) {
    selectedQuestion = buildSectionShiftQuestion({ nextSectionKey: targetTopic || decisionContext?.sectionState?.nextSectionKey || 'motivation' });
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

  const reactTrace = buildReactTrace({ selectedAction: actionType, decisionContext, selectedQuestion, environment, evaluatorState });

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
    reactTrace,
  };
};
