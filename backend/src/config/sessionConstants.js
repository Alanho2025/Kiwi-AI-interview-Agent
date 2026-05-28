/**
 * Session-related constants
 * Extracted from sessionShared.js for better maintainability
 */

export const ROLE_ACRONYMS = new Set(['QA', 'NZ', 'API', 'SQL', 'AWS', 'GCP', 'UI', 'UX']);

export const DISPLAY_TITLE_ROLE_NOUN_PATTERN = /\b(?:engineer|developer|designer|analyst|architect|consultant|specialist|intern|scientist|administrator|programme|program|product manager|coordinator|assistant|psychologist)\b/i;

export const DISPLAY_TITLE_FALSE_POSITIVE_HIRING_ROLES = /\b(?:hiring manager|hiring coordinator|recruitment manager|talent acquisition specialist|people & culture advisor|people and culture advisor)\b/i;

export const DISPLAY_TITLE_MARKETING_PREFIX_PATTERNS = [
    /^(?:we\s+are\s+)?(?:now\s+)?hiring\s*[:：]?\s+(?:for\s+)?(?:(?:a|an|the)\s+)?/i,
    /^we\s+are\s+looking\s+for\s+(?:(?:a|an|the)\s+)?/i,
    /^join\s+us\s+as\s+(?:(?:a|an|the)\s+)?/i,
    /^open\s+role\s*[:：]?\s*/i,
    /^role\s*[:：]?\s*/i,
    /^position\s*[:：]?\s*/i,
];

export const RETENTION_DAYS = 90;
export const DEFAULT_VARCHAR_MAX_LENGTH = 255;

// Made with Bob
