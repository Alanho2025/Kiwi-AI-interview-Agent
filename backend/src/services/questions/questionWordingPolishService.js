const normalizeWhitespace = (text = '') => String(text || '').replace(/\s+/g, ' ').trim();

const ensureQuestionMark = (text = '') => {
  const clean = normalizeWhitespace(text);
  if (!clean) return '';
  return /[?？]$/.test(clean) ? clean : `${clean}?`;
};

const replaceCaseInsensitive = (text = '', pattern, replacement) => String(text || '').replace(pattern, replacement);

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

  return ensureQuestionMark(next);
};

export const hasAwkwardQuestionWording = (text = '') => {
  const clean = normalizeWhitespace(text);
  if (!clean) return false;

  return /\bshowed (documentation|communication|teamwork|leadership)\b/i.test(clean);
};
