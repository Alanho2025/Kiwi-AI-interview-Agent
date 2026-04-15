const cleanHeaderLine = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const LOCATION_PATTERN = /(Auckland|Wellington|Christchurch|Hamilton|Takanini|Ponsonby|Pukekohe|Remote|Across New Zealand|New Zealand)/i;
const EMPLOYMENT_PATTERN = /^(full[- ]?time|part[- ]?time|contract|permanent|fixed term)$/i;
const SALARY_PATTERN = /(\$|salary|hourly rate|per year|competitive|expected salary)/i;
const NOISE_PATTERN = /^(view all jobs|how you match|show all|posted\b|add expected salary|skills and credentials match your profile|employer questions|3\.58 reviews.*)$/i;
const HEADING_PATTERN = /^(what this role does|core requirements|bonus requirements|qualifications|benefits|application notes|what you'll do|what you'll bring|about the role|about you|key responsibilities|purpose of the role|position description|a day in the life|bonus points for|what we're looking for|what you will bring|what's in it for you)$/i;

const isLikelyCategoryLine = (line = '') => /information & communication technology|government & defence|product management|database development|business\/systems analysts/i.test(line);
const isShortContinuationLine = (line = '') => /^[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,2}$/.test(line) && !/(limited|ltd|digital|software|people|rail|energy|radar)/i.test(line);

const looksLikeCompanyLine = (line = '') => {
  if (!line || LOCATION_PATTERN.test(line) || EMPLOYMENT_PATTERN.test(line) || SALARY_PATTERN.test(line) || NOISE_PATTERN.test(line) || HEADING_PATTERN.test(line) || /^company:/i.test(line) || /^employment type:/i.test(line)) return false;
  if (isLikelyCategoryLine(line)) return false;
  if (isShortContinuationLine(line) && line.split(' ').length <= 3) return false;
  return /(?:limited|ltd|digital|software|people|rail|energy|radar|kiwirail)/i.test(line) || (/^[A-Z][A-Za-z0-9& .'-]+$/.test(line) && line.split(' ').length <= 6);
};

const buildTitle = (head = [], fallbackTitle = '') => {
  if (fallbackTitle) {
    const idx = head.findIndex((line) => line === fallbackTitle);
    if (fallbackTitle.endsWith('New') && idx >= 0 && head[idx + 1] === 'Zealand') return `${fallbackTitle} Zealand`;
    if (fallbackTitle.endsWith('& Workflow') && idx >= 0 && /Automation Focus\)/i.test(head[idx + 1] || '')) return `${fallbackTitle} ${head[idx + 1]}`;
    return fallbackTitle;
  }
  const first = head.find((line) => !NOISE_PATTERN.test(line) && !looksLikeCompanyLine(line) && !LOCATION_PATTERN.test(line) && !EMPLOYMENT_PATTERN.test(line) && !SALARY_PATTERN.test(line) && !isLikelyCategoryLine(line));
  if (!first) return '';
  const firstIndex = head.findIndex((line) => line === first);
  const second = head[firstIndex + 1] || '';
  if (first.endsWith('New') && second === 'Zealand') return `${first} ${second}`;
  return first;
};

export const extractJobDescriptionHeader = ({ rawJD = '', fallbackTitle = '' }) => {
  const lines = String(rawJD || '').split(/\r?\n/).map(cleanHeaderLine).filter(Boolean);
  const head = lines.slice(0, 18);
  const title = buildTitle(head, fallbackTitle);
  const titleTokens = title.split(' ');
  let afterTitleIndex = head.findIndex((line) => line === title);
  if (afterTitleIndex === -1 && title.endsWith(' Zealand')) {
    const firstPart = title.replace(/ Zealand$/, '');
    afterTitleIndex = head.findIndex((line, idx) => line === firstPart && head[idx + 1] === 'Zealand');
    if (afterTitleIndex !== -1) afterTitleIndex += 1;
  }
  if (afterTitleIndex === -1) afterTitleIndex = head.findIndex((line) => titleTokens.length > 2 && line.includes(titleTokens[0]));
  const afterTitle = afterTitleIndex >= 0 ? head.slice(afterTitleIndex + 1) : head;
  const companyName = (afterTitle.find((line) => /^company:/i.test(line)) || '').replace(/^company:\s*/i, '') || afterTitle.find((line) => looksLikeCompanyLine(line)) || '';
  const location = (afterTitle.find((line) => /^location:/i.test(line)) || '').replace(/^location:\s*/i, '') || afterTitle.find((line) => LOCATION_PATTERN.test(line)) || '';
  const employmentType = (afterTitle.find((line) => /^employment type:/i.test(line)) || '').replace(/^employment type:\s*/i, '') || afterTitle.find((line) => EMPLOYMENT_PATTERN.test(line)) || '';
  const salaryText = (afterTitle.find((line) => /^salary:/i.test(line)) || '').replace(/^salary:\s*/i, '') || afterTitle.find((line) => SALARY_PATTERN.test(line)) || '';
  const contractType = [title, ...afterTitle].find((line) => /(\d+\s*(?:month|year)\s*contract|fixed term)/i.test(line)) || '';

  return {
    title,
    companyName,
    location,
    employmentType,
    salaryText,
    contractType,
    source: 'seek_header',
  };
};
