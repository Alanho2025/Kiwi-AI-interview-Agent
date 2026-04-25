/**
 * File responsibility: ASR transcript normalization.
 * Main responsibilities:
 * - Apply conservative, domain-safe corrections after speech recognition.
 * - Preserve the user's meaning and avoid essay-style rewriting.
 * - Return structured correction metadata for debugging and UI display.
 */

const SAFE_REPLACEMENTS = [
  [/\breact query\b/gi, 'React Query'],
  [/\btan\s*stack(?: query)?\b/gi, 'TanStack Query'],
  [/\bpost\s*gray\s*sql\b/gi, 'PostgreSQL'],
  [/\bpostgre\s*sql\b/gi, 'PostgreSQL'],
  [/\bpostgres\s*sql\b/gi, 'PostgreSQL'],
  [/\bmongo\s*db\b/gi, 'MongoDB'],
  [/\bnode\s*js\b/gi, 'Node.js'],
  [/\bexpress\s*js\b/gi, 'Express.js'],
  [/\brest\s*a\s*p\s*i\b/gi, 'REST API'],
  [/\bj\s*w\s*t\b/gi, 'JWT'],
  [/\bo\s*auth\b/gi, 'OAuth'],
  [/\br\s*a\s*g\b/gi, 'RAG'],
  [/\bl\s*l\s*m\b/gi, 'LLM'],
  [/\bv\s*l\s*l\s*m\b/gi, 'vLLM'],
  [/\bdeep\s*seek\b/gi, 'DeepSeek'],
  [/\bu\s*of\s*a\b/gi, 'UoA'],
  [/\buniversity of auckland\b/gi, 'University of Auckland'],
  [/\bte\s*treaty\b/gi, 'Te Tiriti'],
  [/\btall\s*poppy\s*syndrome\b/gi, 'Tall Poppy Syndrome'],
  [/\bstar\s*method\b/gi, 'STAR method'],
];

const collapseSpacing = (text) => text.replace(/\s+/g, ' ').trim();

export function normalizeTranscript(rawText = '') {
  const originalText = collapseSpacing(String(rawText || ''));
  let normalizedText = originalText;
  const corrections = [];

  for (const [pattern, replacement] of SAFE_REPLACEMENTS) {
    const before = normalizedText;
    normalizedText = normalizedText.replace(pattern, replacement);
    if (before !== normalizedText) {
      corrections.push({ pattern: String(pattern), replacement });
    }
  }

  normalizedText = collapseSpacing(normalizedText);

  return {
    rawText: originalText,
    normalizedText,
    changed: originalText !== normalizedText,
    corrections,
  };
}
