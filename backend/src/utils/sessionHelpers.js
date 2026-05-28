/**
 * Session helper functions
 * Extracted from sessionShared.js for better maintainability
 */

import {
    ROLE_ACRONYMS,
    DISPLAY_TITLE_ROLE_NOUN_PATTERN,
    DISPLAY_TITLE_FALSE_POSITIVE_HIRING_ROLES,
    DISPLAY_TITLE_MARKETING_PREFIX_PATTERNS,
    RETENTION_DAYS,
    DEFAULT_VARCHAR_MAX_LENGTH,
} from '../config/sessionConstants.js';

export const buildFullTranscript = (turns) => turns.map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`).join('\n\n');

export const retentionDate = () => new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

export const clampVarchar = (value, maxLength = DEFAULT_VARCHAR_MAX_LENGTH, fallback = '') => {
    const text = String(value ?? fallback ?? '').trim() || fallback;
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

export const titleCaseWords = (value = '') => value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
        if (ROLE_ACRONYMS.has(part.toUpperCase())) return part.toUpperCase();
        if (/^\.?net$/i.test(part)) return '.NET';
        const parenthetical = part.match(/^\(([^)]+)\)$/);
        if (parenthetical?.[1]) {
            const inner = parenthetical[1];
            const upperInner = inner.toUpperCase();
            if (ROLE_ACRONYMS.has(upperInner)) return `(${upperInner})`;
            return `(${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()})`;
        }
        if (/^[A-Z0-9_/-]{2,}$/.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');

export const cleanDisplayTitle = (value = '') => {
    let text = String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/[.,;:!?-]+\s*$/, '')
        .trim();

    if (!text || DISPLAY_TITLE_FALSE_POSITIVE_HIRING_ROLES.test(text)) return text;

    for (const pattern of DISPLAY_TITLE_MARKETING_PREFIX_PATTERNS) {
        const cleaned = text.replace(pattern, '').replace(/[.,;:!?-]+\s*$/, '').trim();
        if (cleaned && cleaned !== text && DISPLAY_TITLE_ROLE_NOUN_PATTERN.test(cleaned)) {
            text = cleaned;
            break;
        }
    }

    return text;
};

export const extractDisplayTitle = (...candidates) => {
    for (const candidate of candidates) {
        const text = String(candidate || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        const directTitleMatch = text.match(/(?:job\s*title|position|role)\s*:\s*([^\n.]{3,120})/i);
        if (directTitleMatch?.[1]) return cleanDisplayTitle(directTitleMatch[1]);

        const commonRoleMatch = text.match(/\b((?:Junior|Senior|Lead|Principal|Staff|Graduate|Mid-Level|Solutions|Software|Backend|Frontend|Full[-\s]?Stack|Mobile|DevOps|Data|Civil|Platform|QA|Test|Product|AI|Machine Learning|Cloud|Automation|Telehealth)?\s*(?:Software Engineer|Solutions Engineer|Backend Engineer|Frontend Engineer|Full Stack Engineer|Mobile Developer|React Native Developer|DevOps Engineer|Data Engineer|Data \w+ AI Engineer|Data & AI Engineer|AI Engineer|Automation Coordinator|Workflow Automation Assistant|Civil Engineer|Platform Engineer|QA Engineer|Test Engineer|Product Manager|Developer|Data Scientist|Machine Learning Engineer|Cloud Engineer|Psychologist|Coordinator|Assistant))\b/i);
        if (commonRoleMatch?.[1]) return cleanDisplayTitle(commonRoleMatch[1]);

        const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) || '';
        if (firstLine && firstLine.length <= 120 && !/^(we|our|about|in\b)\b/i.test(firstLine)) return cleanDisplayTitle(firstLine);

        const sentenceMatch = text.match(/^([^.!?]{8,140}?)(?:[.!?]|$)/);
        if (sentenceMatch?.[1] && !/^(we|our|in\b)\b/i.test(sentenceMatch[1].trim())) return cleanDisplayTitle(sentenceMatch[1]);

        return cleanDisplayTitle(text.slice(0, 80));
    }

    return 'Interview Session';
};

export const normalizeRequirementKey = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();

export const findUniversalRequirementTarget = ({ topic = '', rubric = {} } = {}) => {
    const key = normalizeRequirementKey(topic);
    const requirements = rubric.universalRoleProfile?.requirements || rubric.metadata?.universalRoleProfile?.requirements || [];
    return requirements.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const labels = [item.text, item.label, item.normalizedCapability].map(normalizeRequirementKey).filter(Boolean);
        return labels.includes(key) || labels.some((label) => key.includes(label) || label.includes(key));
    }) || null;
};

// Made with Bob
