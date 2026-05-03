const LOCATION_PATTERN = /(Auckland|Wellington|Christchurch|Hamilton|Takanini|Ponsonby|Pukekohe|Remote|Across New Zealand|New Zealand)/i;
const ROLE_TITLE_PATTERN = /\b(engineer|developer|analyst|consultant|specialist|graduate|manager|architect|designer|scientist|intern)\b/i;

const cleanLocationCandidate = (line = '') => String(line || '').replace(/\s+/g, ' ').trim().replace(/^location:\s*/i, '');

export const extractLocation = ({ afterTitleLines = [] } = {}) => {
  const candidates = [];
  for (const line of afterTitleLines.slice(0, 12)) {
    const value = cleanLocationCandidate(line);
    if (/^location:/i.test(line)) candidates.push({ value, source: 'labeled_location', score: 0.98 });
    else if (LOCATION_PATTERN.test(value) && !ROLE_TITLE_PATTERN.test(value)) {
      const score = value.includes(',') ? 0.9 : 0.8;
      candidates.push({ value, source: 'header_location_candidate', score });
    }
  }
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return {
    value: best?.value || '',
    candidates,
    confidence: best?.score || 0.2,
    evidence: best ? [best.value] : [],
  };
};
