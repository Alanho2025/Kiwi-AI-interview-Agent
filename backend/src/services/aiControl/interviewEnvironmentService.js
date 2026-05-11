const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const getLatestTurn = (transcript = [], role) => [...ensureArray(transcript)].reverse().find((turn) => turn.role === role) || null;

const buildQuestionContext = (session = {}) => {
  const latestAiTurn = getLatestTurn(session.transcript, 'ai');
  const previousAiTurns = ensureArray(session.transcript).filter((turn) => turn.role === 'ai').slice(-3);
  return {
    latestQuestionText: normalizeText(latestAiTurn?.text),
    latestQuestionStage: latestAiTurn?.metadata?.stage || 'opening',
    latestQuestionTopic: latestAiTurn?.metadata?.topic || 'self_intro',
    previousQuestionTopics: previousAiTurns.map((turn) => turn.metadata?.topic).filter(Boolean),
    previousQuestionStages: previousAiTurns.map((turn) => turn.metadata?.stage).filter(Boolean),
  };
};

const buildCandidateContext = (session = {}) => {
  const profile = session.analysisResult?.parsedCvProfile || session.cvProfile || {};
  const cvAnalysis = profile.cvAnalysis || session.analysisResult?.matchingDetails?.cvAnalysis || {};
  return {
    candidateName: profile.candidateName || session.candidateName || null,
    candidateIntro: cvAnalysis.candidateIntro || '',
    careerDirection: cvAnalysis.careerDirection || '',
    strongestEvidence: ensureArray(cvAnalysis.strongestEvidence).slice(0, 5),
    jdRelevantEvidence: ensureArray(cvAnalysis.jdRelevantEvidence).slice(0, 5),
    suggestedInterviewHooks: ensureArray(cvAnalysis.suggestedInterviewHooks).slice(0, 8),
    weakOrMissingEvidence: ensureArray(cvAnalysis.weakOrMissingEvidence).slice(0, 6),
    strengths: ensureArray(session.analysisResult?.explanation?.strengths).slice(0, 5),
    gaps: ensureArray(session.analysisResult?.explanation?.gaps).slice(0, 5),
    projects: ensureArray(profile.projects).slice(0, 4),
    skills: ensureArray(profile.skills).map((item) => (typeof item === 'string' ? item : item?.label)).filter(Boolean).slice(0, 8),
  };
};

const buildRoleContext = (session = {}) => {
  const jdProfile = session.analysisResult?.parsedJdProfile || {};
  return {
    targetRole: session.targetRole || jdProfile.title || null,
    priorityTopics: ensureArray(session.analysisResult?.matchingDetails?.questionPlanHints?.priorityTopics).slice(0, 6),
    validationTargets: ensureArray(session.analysisResult?.matchingDetails?.validationTargets).slice(0, 6),
    requiredSkills: ensureArray(jdProfile.requiredSkills || jdProfile.technicalSkillRequirements).slice(0, 8),
  };
};

const buildCoverageContext = (session = {}) => {
  const aiTurns = ensureArray(session.transcript).filter((turn) => turn.role === 'ai');
  const topicsCovered = [...new Set(aiTurns.map((turn) => turn.metadata?.topic).filter(Boolean))];
  const stagesVisited = [...new Set(aiTurns.map((turn) => turn.metadata?.stage).filter(Boolean))];
  return {
    topicsCovered,
    stagesVisited,
    questionCount: aiTurns.length,
    answerCount: ensureArray(session.transcript).filter((turn) => turn.role === 'user').length,
  };
};

const buildNzCultureContext = (session = {}) => {
  const settings = session.settings || {};
  if (!settings.enableNZCultureFit) return null;

  const hints = session.analysisResult?.matchingDetails?.questionPlanHints || {};
  const nzQuestions = ensureArray(hints.nzCultureQuestions);

  return {
    enabled: true,
    questionBank: nzQuestions.map((q) => ({
      id: q.id,
      dimension: q.dimension,
      question: q.question,
      followUp: q.followUp,
      scoringCriteria: q.scoringCriteria,
    })),
    coachingDirective:
      'NZ WORKPLACE CULTURE COACHING (active):\n'
      + 'When the candidate answers behavioural questions, also evaluate for NZ workplace communication signals:\n'
      + '- Teamwork language ("we", shared outcomes) over solo heroics\n'
      + '- Humility with evidence — avoid "I was the best" phrasing\n'
      + '- Relationship awareness — mention stakeholders, users, teammates by role\n'
      + '- Approachability — flat hierarchy, willingness to speak up\n'
      + '- Sustainable work — prioritisation over glorified overwork\n'
      + 'If the candidate\'s answer lacks NZ signals, gently probe with a follow-up like:\n'
      + '"That\'s a good answer. Could you also tell me about how you worked with others on that, or how you communicated the outcome?"',
  };
};

export const buildInterviewEnvironment = ({ session = {}, retrievalBundle = null, latestEvaluation = null } = {}) => {
  const questionContext = buildQuestionContext(session);
  const latestUserTurn = getLatestTurn(session.transcript, 'user');
  const latestAnswerText = normalizeText(latestUserTurn?.text);
  const latestAnswerTokens = tokenize(latestAnswerText);

  return {
    sessionId: session.id,
    userId: session.userId,
    questionContext,
    candidateContext: buildCandidateContext(session),
    roleContext: buildRoleContext(session),
    coverageContext: buildCoverageContext(session),
    nzCultureContext: buildNzCultureContext(session),
    latestAnswer: {
      text: latestAnswerText,
      tokenCount: latestAnswerTokens.length,
      hasNumbers: /\d/.test(latestAnswerText),
      tokenSet: latestAnswerTokens,
    },
    retrievalContext: {
      objective: retrievalBundle?.objective || null,
      sourceTypes: ensureArray(retrievalBundle?.items).map((item) => item.sourceType),
      sourceQuality: retrievalBundle?.sourceQuality || 'limited',
    },
    latestEvaluation: latestEvaluation || null,
    constraints: {
      totalQuestions: Number(session.totalQuestions || 0),
      currentQuestionIndex: Number(session.currentQuestionIndex || 1),
      avoidTopicRepetition: true,
      keepQuestionShort: true,
    },
  };
};

