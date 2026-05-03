import { ROLE_KEYWORDS, cleanLineLabel } from '../jobDescriptionShared.js';

const CATEGORY_PATTERN = /^(engineering|information technology|information & communication technology|accounting|administration|sales|marketing|hospitality|healthcare|education)\s*-|\binformation\s*&\s*communication\s*technology\b/i;
const NOISE_PATTERN = /^(view all jobs|how you match|show all|posted\b|add expected salary|skills and credentials match your profile|employer questions|\d+(?:\.\d+)?\s+reviews.*|company description:?|job description:?|position description|about us|about the company|about the role|about you|why join us|benefits|requirements|qualifications|application notes?)$/i;
const FIELD_OR_SECTION_SPLIT = /\b(?:company|employment type|job type|location|salary|contract type)\s*:|\b(?:about us|about the company|about the role|about you|why join us|what this role does|key responsibilities|responsibilities|core requirements|bonus requirements|requirements|qualifications|benefits|application notes|what you'll do|what you'll bring)\b/i;
const TITLE_START_PATTERN = /^([a-z0-9&/()+,.' -]{1,100}?\b(?:engineer|developer|manager|designer|analyst|architect|consultant|specialist|intern|graduate|scientist|administrator|programme|program)\b(?:\s*\([^)]{1,40}\))?)/i;
const ACRONYMS = new Set(['AI', 'ML', 'UI', 'UX', 'QA', 'SQL', 'API', 'AWS', 'GCP', 'PHP', 'HTML', 'CSS', 'C#', '.NET', 'DBT', 'DV2']);

const ROLE_NOUN_PATTERN = /\b(?:engineer|developer|designer|analyst|architect|consultant|specialist|intern|graduate|scientist|administrator|programme|program)\b/i;
const FALSE_POSITIVE_HIRING_ROLES = /\b(?:hiring manager|hiring coordinator|recruitment manager|talent acquisition specialist|people & culture advisor|people and culture advisor)\b/i;
const MARKETING_TITLE_PREFIX_PATTERNS = [
  /^(?:we\s+are\s+)?(?:now\s+)?hiring\s*[:：]?\s+(?:for\s+)?(?:(?:a|an|the)\s+)?/i,
  /^we\s+are\s+looking\s+for\s+(?:(?:a|an|the)\s+)?/i,
  /^we\s+are\s+seeking\s+(?:(?:a|an|the)\s+)?/i,
  /^join\s+us\s+as\s+(?:(?:a|an|the)\s+)?/i,
  /^as\s+(?:a|an|the)\s+/i,
  /^open\s+role\s*[:：]?\s*/i,
  /^role\s*[:：]?\s*/i,
  /^position\s*[:：]?\s*/i,
  /^job\s+title\s*[:：]?\s*/i,
];

const titleCaseToken = (part = '') => {
  const trimmed = part.trim();
  const core = trimmed.replace(/^[^A-Za-z0-9#.]+|[^A-Za-z0-9#.]+$/g, '');
  const upper = core.toUpperCase();
  if (ACRONYMS.has(upper)) return trimmed.replace(core, upper);
  if (/^[A-Z0-9#+./-]+$/.test(core) && core !== core.toLowerCase()) return trimmed;
  const titledCore = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
  return core ? trimmed.replace(core, titledCore) : trimmed;
};

const toTitleCase = (value = '') => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .map(titleCaseToken)
  .join(' ')
  .replace(/\bAi\b/g, 'AI')
  .replace(/\bMl\b/g, 'ML')
  .replace(/\bUi\b/g, 'UI')
  .replace(/\bUx\b/g, 'UX');

const normalizeCandidate = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().replace(/[.:;,-]+$/g, '').trim();
const ROLE_TITLE_TRAILING_CONTEXT_PATTERN = /\s+(?:at|with|for)\s+[A-Z][A-Za-z0-9&.'’ -]{1,80}(?:,|\s+you(?:'|’)ll|\s+you\s+will|\s+you\s+are|\s+is\b|\s+are\b).*$/i;

export const cleanRoleTitleCandidate = (value = '') => {
  let text = normalizeCandidate(value)
    .replace(ROLE_TITLE_TRAILING_CONTEXT_PATTERN, '')
    .replace(/\s+to join\b.*$/i, '');
  if (!text) return '';
  if (FALSE_POSITIVE_HIRING_ROLES.test(text)) return text;

  for (const pattern of MARKETING_TITLE_PREFIX_PATTERNS) {
    const cleaned = normalizeCandidate(text.replace(pattern, ''));
    if (cleaned && cleaned !== text && ROLE_NOUN_PATTERN.test(cleaned)) {
      text = cleaned;
      break;
    }
  }

  return text;
};

const normalizeKey = (value = '') => normalizeCandidate(String(value || '').toLowerCase());

const looksLikeNoise = (value = '') => {
  const text = normalizeCandidate(value);
  if (!text) return true;
  if (NOISE_PATTERN.test(text)) return true;
  if (CATEGORY_PATTERN.test(text)) return true;
  if (text.split(' ').length > 12) return true;
  if (text.length > 100) return true;
  return false;
};

const buildJoinedTitleCandidate = (first = '', second = '') => {
  const left = normalizeCandidate(first);
  const right = normalizeCandidate(second);
  if (!left || !right) return '';
  const cleanedLeft = cleanRoleTitleCandidate(left);
  if (cleanedLeft && cleanedLeft !== left && ROLE_KEYWORDS.test(cleanedLeft)) return toTitleCase(cleanedLeft);
  if (looksLikeNoise(left) || looksLikeNoise(right)) return '';
  if (!ROLE_KEYWORDS.test(left)) return '';
  if (left.includes(',')) return '';
  if (/^(company|location|employment type|job type|salary|contract type)\s*:/i.test(right)) return '';
  if (/^(about us|about the company|about the role|about you|why join us|what this role does|key responsibilities|responsibilities|core requirements|bonus requirements|requirements|qualifications|benefits|application notes?)$/i.test(right)) return '';
  if (/(limited|ltd|inc|corp|group|company|rail|energy|software|digital|people|consulting|radar)\b/i.test(right)) return '';
  if (right.split(' ').length > 4) return '';
  const joined = normalizeCandidate(`${left} ${right}`);
  if (joined.split(' ').length > 10 || joined.length > 90) return '';
  if (!ROLE_KEYWORDS.test(joined)) return '';
  return toTitleCase(joined);
};

const extractInlineTitle = (line = '') => {
  const text = normalizeCandidate(line);
  if (!text) return '';
  const splitMatch = text.search(FIELD_OR_SECTION_SPLIT);
  const head = splitMatch > 0 ? text.slice(0, splitMatch).trim() : text;
  const labelled = /^job title:|^role title:|^position title:/i.test(head) ? cleanLineLabel(head) : head;
  const cleanedLabelled = cleanRoleTitleCandidate(labelled);
  const matched = normalizeCandidate((cleanedLabelled.match(TITLE_START_PATTERN) || [])[1] || cleanedLabelled);
  if (looksLikeNoise(matched)) return '';
  if (!ROLE_KEYWORDS.test(matched)) return '';
  return toTitleCase(matched);
};

export const extractJobTitle = ({ lines = [] } = {}) => {
  const candidates = [];
  const head = lines.slice(0, 8);

  for (const line of head) {
    const inline = extractInlineTitle(line);
    if (!inline) continue;
    const score = /^job title:|^role title:|^position title:/i.test(line) ? 0.99 : 0.92;
    candidates.push({ value: inline, source: 'header_or_inline_title', score });
  }

  for (let index = 0; index < Math.min(head.length - 1, 4); index += 1) {
    const joined = buildJoinedTitleCandidate(head[index], head[index + 1]);
    if (!joined) continue;
    candidates.push({ value: joined, source: 'joined_header_title', score: 0.95 });
  }

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const key = normalizeKey(candidate.value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  const best = deduped[0];
  const value = best?.value || 'Target Role';
  return {
    value,
    candidates: deduped,
    confidence: best?.score || 0.2,
    evidence: best ? [best.value] : [],
  };
};
