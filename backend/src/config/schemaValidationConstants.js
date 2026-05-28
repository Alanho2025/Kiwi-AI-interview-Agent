/**
 * File responsibility: Configuration module.
 * Main responsibilities:
 * - Define constants and configuration data for schema validation
 * - Keep validation rules and allowed values centralized
 * Maintenance notes:
 * - Add new validation constants here instead of hardcoding in service files
 * - Keep constants grouped by their validation domain
 */

/**
 * Valid trust labels for evidence sources
 */
export const TRUST_LABELS = new Set([
    'supported_by_cv',
    'supported_by_jd',
    'supported_by_answer',
    'supported_by_nz_guide',
    'needs_user_confirmation',
]);

/**
 * Valid confidence levels for evidence
 */
export const CONFIDENCE_LEVELS = new Set([
    'high',
    'medium',
    'low',
]);

/**
 * Valid feedback statuses for candidate feedback items
 */
export const FEEDBACK_STATUSES = new Set([
    'confirmed_feedback',
    'downgraded_feedback',
    'needs_confirmation',
    'refused_claim',
]);

/**
 * Valid STAR breakdown part values
 */
export const STAR_PART_VALUES = ['clear', 'partial', 'missing'];

/**
 * Default schema version
 */
export const DEFAULT_SCHEMA_VERSION = 'v3';

/**
 * Default candidate name
 */
export const DEFAULT_CANDIDATE_NAME = 'Candidate';

/**
 * Default job title
 */
export const DEFAULT_JOB_TITLE = 'Target Role';

/**
 * Default confidence value
 */
export const DEFAULT_CONFIDENCE = 0.4;

/**
 * Default decision for manual review
 */
export const DEFAULT_DECISION = {
    label: 'manual_review',
    reasonCodes: [],
};

// Made with Bob