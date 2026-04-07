const getLastUserAnswer = (transcript = []) => [...transcript].reverse().find((turn) => turn.role === 'user')?.text || '';
const getAskedAiTurns = (transcript = []) => transcript.filter((turn) => turn.role === 'ai');
const getCurrentPoolIndex = (questionPool = [], askedAiTurns = []) => Math.min(askedAiTurns.length, Math.max(questionPool.length - 1, 0));
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

const pickRetrievedQuestion = (retrievalBundle, selectedQuestion) => {
  if (!retrievalBundle?.items?.length) return null;
  const topicTokens = new Set(tokenize(selectedQuestion?.topic || ''));
  const desiredSource = selectedQuestion?.stage === 'behavioural' ? 'behavioural_bank' : 'question_bank';

  const sameStage = retrievalBundle.items.find((item) => {
    if (![desiredSource, 'question_bank', 'behavioural_bank'].includes(item.sourceType)) return false;
    const skillTags = item.metadata?.skillTags || [];
    if (!topicTokens.size) return item.sourceType === desiredSource;
    return skillTags.some((tag) => topicTokens.has(String(tag).toLowerCase())) || tokenize(item.metadata?.category || '').some((token) => topicTokens.has(token));
  });

  return sameStage || retrievalBundle.items.find((item) => item.sourceType === desiredSource) || retrievalBundle.items.find((item) => item.sourceType === 'question_bank' || item.sourceType === 'behavioural_bank') || null;
};

export const runInterviewerAgent = async ({ session, retrievalBundle = null } = {}) => {
  const transcript = session?.transcript || [];
  const askedAiTurns = getAskedAiTurns(transcript);
  const questionPool = session?.interviewPlan?.questionPool || [];
  const lastUserAnswer = getLastUserAnswer(transcript).toLowerCase();
  const poolIndex = getCurrentPoolIndex(questionPool, askedAiTurns);
  let selectedQuestion = questionPool[poolIndex] || null;

  const retrievedQuestion = pickRetrievedQuestion(retrievalBundle, selectedQuestion);
  if (selectedQuestion && retrievedQuestion && selectedQuestion.stage !== 'opening' && selectedQuestion.stage !== 'wrap_up') {
    selectedQuestion = buildRoleLockedQuestion(retrievedQuestion, selectedQuestion);
  } else if (!selectedQuestion && retrievedQuestion) {
    selectedQuestion = buildRoleLockedQuestion(retrievedQuestion, { stage: retrievedQuestion.sourceType === 'behavioural_bank' ? 'behavioural' : 'technical_core' });
  }

  if (!selectedQuestion) {
    selectedQuestion = {
      type: 'behavioural_follow_up',
      stage: 'behavioural',
      topic: lastUserAnswer.includes('team') ? 'teamwork' : 'problem_solving',
      followUpDepth: 1,
      text: lastUserAnswer.includes('team') ? 'What was your exact role in that team effort, and what result came from it?' : 'Can you give me one specific example that shows how you handled that in practice?',
      reason: 'Fallback follow-up when the structured role-linked pool is exhausted.',
    };
  }

  return {
    questionType: selectedQuestion.type,
    nextQuestion: selectedQuestion.text,
    rationale: selectedQuestion.reason,
    stage: selectedQuestion.stage,
    topic: selectedQuestion.topic,
    followUpDepth: selectedQuestion.followUpDepth || 0,
    retrievalSnapshot: retrievalBundle,
  };
};
