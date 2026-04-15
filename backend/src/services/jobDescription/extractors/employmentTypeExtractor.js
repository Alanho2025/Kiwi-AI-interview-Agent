const EMPLOYMENT_PATTERN = /(full[- ]?time|part[- ]?time|contract|permanent|fixed term)/i;
const TRAILING_SPLIT = /\b(?:what this role does|key responsibilities|responsibilities|core requirements|bonus requirements|qualifications|benefits|application notes|about the role|what you'll do|what you'll bring|company|location|salary|contract type)\b/i;

const cleanEmploymentValue = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const splitIndex = text.search(TRAILING_SPLIT);
  const head = splitIndex > 0 ? text.slice(0, splitIndex).trim() : text;
  const match = head.match(/\b(permanent\s+full[- ]?time|full[- ]?time|part[- ]?time|fixed term|contract)\b/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : head.replace(/[.;,:-]+$/g, '').trim();
};

export const extractEmploymentType = ({ afterTitleLines = [], flatText = '' } = {}) => {
  const candidates = [];
  for (const line of afterTitleLines.slice(0, 12)) {
    if (/^employment type:/i.test(line)) candidates.push({ value: cleanEmploymentValue(line.replace(/^employment type:\s*/i, '')), source: 'labeled_employment_type', score: 0.98 });
    else if (/^job type:/i.test(line)) candidates.push({ value: cleanEmploymentValue(line.replace(/^job type:\s*/i, '')), source: 'labeled_job_type', score: 0.95 });
    else if (EMPLOYMENT_PATTERN.test(line)) {
      const match = line.match(EMPLOYMENT_PATTERN);
      candidates.push({ value: cleanEmploymentValue(match?.[1] || line.trim()), source: 'header_employment_candidate', score: 0.82 });
    }
  }

  if (candidates.length === 0) {
    const flatMatch = String(flatText || '').match(/\b(permanent\s+full[- ]?time|full[- ]?time|part[- ]?time|fixed term|contract)\b/i);
    if (flatMatch) candidates.push({ value: cleanEmploymentValue(flatMatch[1]), source: 'flat_text_candidate', score: 0.76 });
  }

  const best = candidates.filter((item) => item.value).sort((a, b) => b.score - a.score)[0];
  return {
    value: best?.value ? best.value.replace(/\s+/g, ' ').trim().replace(/^./, (s) => s.toUpperCase()) : '',
    candidates,
    confidence: best?.score || 0.2,
    evidence: best ? [best.value] : [],
  };
};
