export const buildScoreExplanations = ({ scores = {}, candidateFeedback = {} } = {}) => {
  return {
    overall: {
      score: scores.overall || 0,
      formula: '50% CV-JD match + 50% interview performance',
      inputs: {
        cvJdMatch: scores.cvJdMatch || 0,
        interviewPerformance: scores.interviewPerformance || 0,
      },
      explanation: 'The overall score blends CV-JD requirement match with actual interview performance to measure true role readiness.',
    },
    cvJdMatch: {
      score: scores.cvJdMatch || 0,
      formula: 'Match score from macro fit, micro evidence, requirement coverage, and risk signals.',
      components: {
        macro: scores.macro || 0,
        micro: scores.micro || 0,
        requirements: scores.requirements || 0,
      },
      explanation: 'This score evaluates how well the uploaded CV aligns with the specific JD requirements based on parsed evidence.',
    },
    interviewPerformance: {
      score: scores.interviewPerformance || 0,
      formula: (scores.evaluatedTurnCount || 0) > 0 
        ? '40% evidence strength + 30% direct experience ratio + 30% turn breakdown score'
        : '55% evidence strength + 45% direct experience ratio',
      components: {
        evidenceStrengthScore: scores.evidenceStrength || 0,
        directEvidenceTurns: scores.directEvidenceTurns || 0,
      },
      explanation: 'The interview score rewards specific project examples and measurable outcomes over hypothetical statements.',
    },
    starStructure: {
      explanation: 'STARR is applied only to behavioural or project questions. Self-introduction and company motivation answers use separate context-specific rubrics.',
      turnLevelBreakdowns: (candidateFeedback.turnBreakdowns || [])
        .filter((turn) => turn.starrApplicable)
        .map((turn) => ({
          turnId: turn.id || turn.questionId || 'unknown',
          score: turn.starrQualityScore || 0,
          missingElement: turn.mainMissingElement || 'none',
          explanation: turn.missingElementExplanation || '',
        })),
    }
  };
};

export const getScoreLimitations = () => {
  return [
    'Scores are based on available CV, JD, transcript, and session evidence.',
    'Scores should be treated as coaching signals, not final hiring decisions.',
    'Low transcript confidence or incomplete answers may reduce scoring confidence.',
  ];
};
