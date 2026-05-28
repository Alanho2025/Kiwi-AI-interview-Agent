/**
 * File responsibility: Configuration module.
 * Main responsibilities:
 * - Define constants for AI usage tracking
 * - Keep stage labels and provider labels centralized
 * Maintenance notes:
 * - Add new stage labels or provider labels here
 */

/**
 * Default stage labels for AI usage tracking
 */
export const DEFAULT_STAGE_LABELS = {
    cv_parse: 'CV parse',
    jd_parse: 'JD parse',
    cv_jd_match: 'CV-JD match',
    interview: 'Interview',
    report_generated: 'Report generation',
    report_qa: 'Report QA',
};

/**
 * Provider labels for AI usage tracking
 */
export const PROVIDER_LABELS = {
    deepseek: 'DeepSeek',
    azure_speech: 'Azure Speech',
    elevenlabs: 'ElevenLabs',
    local: 'Local',
};

// Made with Bob