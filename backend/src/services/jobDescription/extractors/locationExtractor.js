const LOCATION_PATTERN = /(Auckland|Wellington|Christchurch|Hamilton|Takanini|Ponsonby|Pukekohe|Remote|Across New Zealand|New Zealand)/i;

export const extractLocation = ({ afterTitleLines = [] } = {}) => {
  const candidates = [];
  for (const line of afterTitleLines.slice(0, 12)) {
    if (/^location:/i.test(line)) candidates.push({ value: line.replace(/^location:\s*/i, '').trim(), source: 'labeled_location', score: 0.98 });
    else if (LOCATION_PATTERN.test(line)) candidates.push({ value: line.trim(), source: 'header_location_candidate', score: 0.8 });
  }
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return {
    value: best?.value || '',
    candidates,
    confidence: best?.score || 0.2,
    evidence: best ? [best.value] : [],
  };
};
