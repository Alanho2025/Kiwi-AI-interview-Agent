/**
 * File responsibility: Role canonicalization rules configuration.
 * Main responsibilities:
 * - Define patterns for matching job titles to canonical role identifiers.
 * - Support role family classification.
 */

/**
 * Rules for canonicalizing role titles.
 * Each rule contains:
 * - canonical: The canonical role identifier
 * - family: The role family category
 * - patterns: Array of RegExp patterns to match against role text
 */
export const ROLE_CANONICAL_RULES = [
    { canonical: 'data_scientist', family: 'data_science', patterns: [/data scientist/i, /content science/i] },
    { canonical: 'data_analyst', family: 'analytics', patterns: [/data analyst/i, /business intelligence/i, /analytics?/i] },
    { canonical: 'machine_learning_engineer', family: 'ai_ml', patterns: [/machine learning engineer/i, /ml engineer/i, /ai engineer/i, /ai-enabled/i, /data and ai engineer/i] },
    { canonical: 'software_engineer', family: 'software_development', patterns: [/software engineer/i, /software developer/i, /programmer/i, /web software engineer/i] },
    { canonical: 'frontend_engineer', family: 'frontend', patterns: [/front[ -]?end/i, /ui engineer/i, /react developer/i] },
    { canonical: 'backend_engineer', family: 'backend', patterns: [/back[ -]?end/i, /api developer/i, /server[- ]side/i] },
    { canonical: 'full_stack_engineer', family: 'software_development', patterns: [/full[ -]?stack/i] },
    { canonical: 'devops_engineer', family: 'devops', patterns: [/devops/i, /site reliability/i, /sre/i, /platform engineer/i] },
    { canonical: 'accessibility_specialist', family: 'frontend', patterns: [/accessibility specialist/i, /web accessibility/i] },
    { canonical: 'big_data_administrator', family: 'data_engineering', patterns: [/big data/i, /data warehousing/i, /data engineer/i] },
    { canonical: 'project_manager', family: 'project_management', patterns: [/project manager/i, /program manager/i, /delivery manager/i] },
];

// Made with Bob
