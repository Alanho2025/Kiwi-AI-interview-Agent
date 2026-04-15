import { ROLE_KEYWORDS, cleanLineLabel } from '../jobDescriptionShared.js';

const NOISE_PATTERN = /^(view all jobs|how you match|show all|posted\b|add expected salary|skills and credentials match your profile|employer questions|\d+(?:\.\d+)?\s+reviews.*|company description:?|job description:?|position description|about us|about the company|about the role|about you|why join us|benefits|requirements|qualifications|application notes?)$/i;
const FIELD_OR_SECTION_SPLIT = /\b(?:company|employment type|job type|location|salary|contract type)\s*:|\b(?:about us|about the company|about the role|about you|why join us|what this role does|key responsibilities|responsibilities|core requirements|bonus requirements|requirements|qualifications|benefits|application notes|what you'll do|what you'll bring)\b/i;
const TITLE_START_PATTERN = /^([a-z0-9&/()+,.' -]{1,100}?\b(?:engineer|developer|manager|designer|analyst|architect|consultant|specialist|intern|scientist|administrator|programme|program)\b(?:\s*\([^)]{1,40}\))?)/i;
const ACRONYMS = new Set(['AI', 'ML', 'UI', 'UX', 'QA', 'SQL', 'API', 'AWS', 'GCP', 'PHP', 'HTML', 'CSS', 'C#', '.NET', 'DBT', 'DV2']);

const toTitleCase = (value = '') => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => {
    const trimmed = part.trim();
    const upper = trimmed.toUpperCase();
    if (ACRONYMS.has(upper)) return upper;
    if (/^[A-Z0-9#+./-]+$/.test(trimmed) && trimmed !== trimmed.toLowerCase()) return trimmed;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  })
  .join(' ');

const normalizeCandidate = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().replace(/[.:;,-]+$/g, '').trim();

const normalizeKey = (value = '') => normalizeCandidate(String(value || '').toLowerCase());

const buildJoinedTitleCandidate = (first = '', second = '') => {
  const left = normalizeCandidate(first);
  const right = normalizeCandidate(second);
  if (!left || !right) return '';
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
const looksLikeNoise = (value = '') => {
  const text = normalizeCandidate(value);
  if (!text) return true;
  if (NOISE_PATTERN.test(text)) return true;
  if (text.split(' ').length > 12) return true;
  if (text.length > 100) return true;
  return false;
};

const extractInlineTitle = (line = '') => {
  const text = normalizeCandidate(line);
  if (!text) return '';
  const splitMatch = text.search(FIELD_OR_SECTION_SPLIT);
  const head = splitMatch > 0 ? text.slice(0, splitMatch).trim() : text;
  const labelled = /^job title:|^role title:|^position title:/i.test(head) ? cleanLineLabel(head) : head;
  const matched = normalizeCandidate((labelled.match(TITLE_START_PATTERN) || [])[1] || labelled);
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
