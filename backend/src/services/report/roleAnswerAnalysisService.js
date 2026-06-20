const round = (value = 0) => Number(Number(value || 0).toFixed(2));

const signalStatus = ({ answer = '', patterns = [] } = {}) => {
  if (!String(answer || '').trim()) return { status: 'missing', score: 0 };
  const matched = patterns.some((pattern) => pattern.test(answer));
  if (matched) return { status: 'clear', score: 10 };
  return String(answer).split(/\s+/).filter(Boolean).length >= 12
    ? { status: 'partial', score: 5 }
    : { status: 'missing', score: 0 };
};

export const calculateFrameworkScore = (dimensions = []) => {
  const applicable = dimensions.filter((item) => item.status !== 'not_applicable');
  const totalScore = round(applicable.reduce((sum, item) => sum + Number(item.score || 0), 0));
  const maxScore = applicable.length * 10;
  return {
    totalScore,
    maxScore,
    normalizedScore: maxScore ? round((totalScore / maxScore) * 10) : 0,
  };
};

export const analyzeRoleSpecificAnswer = ({ answer = '', rubric = {} } = {}) => {
  const dimensions = (rubric.dimensions || []).map((definition) => {
    const result = signalStatus({ answer, patterns: definition.patterns || [] });
    return {
      key: definition.key,
      label: definition.label,
      ...result,
      reason: result.status === 'clear'
        ? `${definition.label} evidence is explicit in the answer.`
        : result.status === 'partial'
          ? `${definition.label} is implied but needs a clearer, role-specific explanation.`
          : `${definition.label} evidence is missing from the answer.`,
    };
  });
  const score = calculateFrameworkScore(dimensions);
  const mainGap = dimensions
    .filter((item) => item.status !== 'not_applicable')
    .sort((left, right) => left.score - right.score)[0];
  return {
    dimensions,
    mainGapKey: mainGap?.key || '',
    mainMissingElement: mainGap?.key || '',
    summary: rubric.evidenceMode === 'knowledge_explanation'
      ? 'This evaluates answer structure and evidence only; domain correctness requires a trusted reference.'
      : `This evaluates the answer against the ${rubric.frameworkLabel} framework.`,
    scoreReason: mainGap?.reason || 'No applicable framework dimensions were available.',
    ...score,
  };
};
