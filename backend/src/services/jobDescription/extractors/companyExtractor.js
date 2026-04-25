const LOCATION_PATTERN = /(Auckland|Wellington|Christchurch|Hamilton|Takanini|Ponsonby|Pukekohe|Remote|Across New Zealand|New Zealand)/i;
const EMPLOYMENT_PATTERN = /^(full[- ]?time|part[- ]?time|contract|permanent|fixed term)$/i;
const SALARY_PATTERN = /(\$|salary|hourly rate|per year|competitive|expected salary)/i;
const NOISE_PATTERN = /^(view all jobs|how you match|show all|posted\b|add expected salary|skills and credentials match your profile|employer questions|what this role does|core requirements|bonus requirements|qualifications|benefits|application notes|company description:?|job description:?|position description|about\b.*|\d+(?:\.\d+)?\s+reviews.*)$/i;
const TRAILING_SPLIT = /\b(?:employment type|job type|location|salary|contract type)\s*:|\b(?:what this role does|key responsibilities|responsibilities|core requirements|bonus requirements|qualifications|benefits|application notes|about the role|what you'll do|what you'll bring)\b/i;

const cleanCompanyValue = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const splitIndex = text.search(TRAILING_SPLIT);
  const head = splitIndex > 0 ? text.slice(0, splitIndex).trim() : text;
  return head.replace(/[.;,:-]+$/g, '').trim();
};

const looksLikeCompanyLine = (line = '') => {
  const text = cleanCompanyValue(line);
  if (!text || LOCATION_PATTERN.test(text) || EMPLOYMENT_PATTERN.test(text) || SALARY_PATTERN.test(text) || NOISE_PATTERN.test(text)) return false;
  if (/^company:/i.test(text)) return true;
  if (/^about\b/i.test(text)) return false;
  return /(?:limited|ltd|digital|software|people|rail|energy|radar|consulting|studio|group|inc|corp|co\.?)(?!.*developer)/i.test(text)
    || (/^[A-Z][A-Za-z0-9& .'-]+$/.test(text) && text.split(' ').length <= 6 && !/(what|about|why|you'll|we're|position|purpose)/i.test(text));
};

export const extractCompanyName = ({ afterTitleLines = [], title = '' } = {}) => {
  const candidates = [];
  const normalizedTitle = cleanCompanyValue(title).toLowerCase();
  for (const [index, line] of afterTitleLines.slice(0, 10).entries()) {
    if (/^company:/i.test(line)) {
      candidates.push({ value: cleanCompanyValue(line.replace(/^company:\s*/i, '')), source: 'labeled_company', score: 0.98 });
      continue;
    }
    if (!looksLikeCompanyLine(line)) continue;
    const value = cleanCompanyValue(line.trim());
    if (!value || value.toLowerCase() == normalizedTitle) continue;
    let score = 0.78;
    if (index == 0) score += 0.08;
    if (/(limited|ltd|inc|corp|group|company|rail|energy|software|digital|people|consulting|radar)\b/i.test(value)) score += 0.08;
    if (value.split(' ').length <= 4) score += 0.04;
    candidates.push({ value, source: 'header_company_candidate', score });
  }

  const best = candidates.filter((item) => item.value).sort((a, b) => b.score - a.score)[0];
  return {
    value: best?.value || '',
    candidates,
    confidence: best?.score || 0.2,
    evidence: best ? [best.value] : [],
  };
};
