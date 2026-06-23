/**
 * File responsibility: ASR transcript replacement patterns configuration.
 * Main responsibilities:
 * - Define safe, domain-specific text replacements for speech recognition output.
 * - Preserve user meaning while correcting common ASR misrecognitions.
 */

/**
 * Safe replacement patterns for ASR transcript normalization.
 * Each entry is [RegExp pattern, replacement string].
 * Patterns are applied in order, case-insensitively.
 */
export const SAFE_REPLACEMENTS = [
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
    [/\bby coding\b/gi, 'vibe coding'],
    [/\bproper engineering\b/gi, 'prompt engineering'],
    [/\btext driven(?: development)?\b/gi, 'test-driven development'],
];

// Made with Bob
