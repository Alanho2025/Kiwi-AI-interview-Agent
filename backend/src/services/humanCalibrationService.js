const DEFAULT_SAMPLE_SET = [
  { id: 'strong_star', label: 'Strong STAR answer', dimensions: ['STAR completeness', 'role relevance', 'evidence quality', 'clarity'] },
  { id: 'vague_answer', label: 'Vague answer', dimensions: ['evidence quality', 'usefulness of improvement advice'] },
  { id: 'technical_answer', label: 'Technical answer', dimensions: ['role relevance', 'STAR completeness'] },
  { id: 'overlong_answer', label: 'Overlong answer', dimensions: ['clarity', 'usefulness of improvement advice'] },
  { id: 'weak_result', label: 'Answer with weak Result', dimensions: ['STAR completeness', 'confidence label accuracy'] },
  { id: 'unsupported_skill_claim', label: 'Unsupported skill claim', dimensions: ['confidence label accuracy', 'evidence quality'] },
];

export const buildHumanCalibrationPilot = ({ records = [] } = {}) => {
  const completed = records.filter((item) => item.systemScore != null && item.humanScore != null);
  const averageDiff = completed.length
    ? Number((completed.reduce((sum, item) => sum + Math.abs(Number(item.systemScore) - Number(item.humanScore)), 0) / completed.length).toFixed(2))
    : null;
  const agreementRate = completed.length
    ? Number((completed.filter((item) => Math.abs(Number(item.systemScore) - Number(item.humanScore)) <= 1).length / completed.length).toFixed(2))
    : null;

  return {
    sampleSet: DEFAULT_SAMPLE_SET,
    reviewerTarget: '2-3 reviewers',
    completedRatings: completed.length,
    agreementRate,
    averageScoreDifference: averageDiff,
    commonDisagreementPatterns: completed
      .filter((item) => Math.abs(Number(item.systemScore) - Number(item.humanScore)) > 1)
      .map((item) => item.dimension || item.sampleId)
      .slice(0, 5),
  };
};
