export const roundMetric = (value) => Number(Number(value || 0).toFixed(4));

export const averageMetrics = (results = []) => {
  const metricNames = Object.keys(results[0]?.metrics || {});
  return Object.fromEntries(metricNames.map((metricName) => [
    metricName,
    roundMetric(results.reduce((sum, result) => sum + result.metrics[metricName], 0) / Math.max(1, results.length)),
  ]));
};

export const averageScores = (results = []) => roundMetric(
  results.reduce((sum, result) => sum + Number(result.score || 0), 0) / Math.max(1, results.length),
);

export const buildMetricSlices = (results = []) => {
  const slices = {};
  for (const result of results) {
    for (const [labelName, labelValue] of Object.entries(result.labels || {})) {
      const sliceName = `${labelName}:${labelValue}`;
      if (slices[sliceName]) continue;
      const matchingResults = results.filter((candidate) => candidate.labels?.[labelName] === labelValue);
      slices[sliceName] = {
        casesRun: matchingResults.length,
        average: averageScores(matchingResults),
        metrics: averageMetrics(matchingResults),
      };
    }
  }
  return slices;
};
