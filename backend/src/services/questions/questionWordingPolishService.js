const normalizeWhitespace = (text = '') => String(text || '').replace(/\s+/g, ' ').trim();

const ensureQuestionMark = (text = '') => {
  const clean = normalizeWhitespace(text);
  if (!clean) return '';
  return /[?？]$/.test(clean) ? clean : `${clean}?`;
};

const replaceCaseInsensitive = (text = '', pattern, replacement) => String(text || '').replace(pattern, replacement);

export const compactSpokenJDRequirement = (text = '') => {
  let clean = normalizeWhitespace(text);
  if (!clean) return '';

  // Detect verbose multi-clause JD lists (e.g. "able to sit with business units across commercial, marketing, design, manufacturing, and finance...")
  const words = clean.split(/\s+/);
  if (/\b(?:able to|experience in|evidence for|responsible for)\b.{20,}\b(?:across|and|or)\b/i.test(clean) || words.length > 25) {
    if (/translate technical concepts/i.test(clean) || (/communication/i.test(clean) && /stakeholder|non-technical|business/i.test(clean))) {
      clean = 'Tell me about a time you translated complex technical concepts for non-technical stakeholders or senior leadership. What was your approach, and what was the result?';
    } else if (/automation/i.test(clean) || /workflow/i.test(clean)) {
      clean = 'Tell me about a concrete example where you used automation. What decision or trade-off did you handle yourself?';
    } else if (/stakeholder|client|customer/i.test(clean)) {
      clean = 'Tell me about a real example where you aligned with non-technical stakeholders to deliver a feature. What was the outcome?';
    } else if (words.length > 28) {
      clean = `${words.slice(0, 22).join(' ')}... What was your approach and the result?`;
    }
  }

  return ensureQuestionMark(clean);
};

export const polishQuestionWording = (text = '') => {
  let next = normalizeWhitespace(text);
  if (!next) return '';

  next = replaceCaseInsensitive(
    next,
    /^Tell me about a time you showed documentation[.?]?$/i,
    'Tell me about a time when you created or improved documentation. What changed afterwards?'
  );

  next = replaceCaseInsensitive(
    next,
    /\bshowed documentation\b/gi,
    'created or improved documentation'
  );

  next = replaceCaseInsensitive(
    next,
    /\bshowed communication\b/gi,
    'communicated clearly'
  );

  next = replaceCaseInsensitive(
    next,
    /\bshowed teamwork\b/gi,
    'worked effectively with others'
  );

  next = replaceCaseInsensitive(
    next,
    /\bshowed leadership\b/gi,
    'helped guide a team decision'
  );

  next = compactSpokenJDRequirement(next);

  return ensureQuestionMark(next);
};

export const hasAwkwardQuestionWording = (text = '') => {
  const clean = normalizeWhitespace(text);
  if (!clean) return false;

  return /\bshowed (documentation|communication|teamwork|leadership)\b/i.test(clean);
};
