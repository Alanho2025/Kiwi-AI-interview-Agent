export const buildScoreExplanations = ({ scores = {}, candidateFeedback = {} } = {}) => {
  const turnBreakdowns = candidateFeedback.turnBreakdowns || [];
  const frameworkTurns = turnBreakdowns.filter((turn) => Number.isFinite(Number(turn.frameworkBreakdown?.normalizedScore)));
  return {
    overall: {
      score: scores.overall || 0,
      formula: 'Interview performance score',
      inputs: {
        interviewPerformance: scores.interviewPerformance || 0,
      },
      explanation: 'The overall score reflects the evidence and framework quality of your interview answers.',
    },
    interviewPerformance: {
      score: scores.interviewPerformance || 0,
      formula: frameworkTurns.length
        ? 'Average of applicable framework turn scores, converted to 0–100'
        : (scores.evaluatedTurnCount || 0) > 0
          ? '40% evidence strength + 30% direct experience ratio + 30% turn breakdown score'
          : '55% evidence strength + 45% direct experience ratio',
      components: {
        evidenceStrengthScore: scores.evidenceStrength || 0,
        directEvidenceTurns: scores.directEvidenceTurns || 0,
        frameworkTurnCount: frameworkTurns.length,
      },
      explanation: frameworkTurns.length
        ? 'The interview score averages the deterministic framework score for every applicable answer. Conversation and closing turns are excluded.'
        : 'This legacy score uses the evidence fields stored with the original report.',
    },
    frameworkRules: {
      explanation: 'Behavioural answers use STARR. Role-specific answers use the resolved role framework, with not-applicable dimensions excluded from the denominator.',
      turnLevelBreakdowns: frameworkTurns
        .map((turn) => ({
          turnId: turn.id || turn.questionId || turn.question || 'unknown',
          frameworkKey: turn.frameworkKey || '',
          frameworkLabel: turn.frameworkLabel || '',
          score: Number(turn.frameworkBreakdown.normalizedScore),
          mainGapKey: turn.frameworkBreakdown.mainGapKey || '',
          explanation: turn.frameworkBreakdown.summary || turn.frameworkBreakdown.scoreReason || '',
        })),
    }
  };
};

export const getScoreLimitations = () => {
  return [
    'Scores are based on the available interview transcript and session evidence.',
    'Scores should be treated as coaching signals, not final hiring decisions.',
    'Low transcript confidence or incomplete answers may reduce scoring confidence.',
  ];
};
