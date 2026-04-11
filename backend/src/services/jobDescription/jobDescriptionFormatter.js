/**
 * File responsibility: Service module for formatting job description rubric.
 * Main responsibilities: Format rubric objects for readable display.
 */

import { unique } from './jobDescriptionShared.js';

/**
 * Purpose: Format the structured job description rubric into clean markdown summary.
 * Inputs: rubric from buildStructuredJobDescriptionRubric.
 * Returns: Readable markdown string.
 */
export const formatStructuredJobDescription = (rubric) => {
    const {
        title,
        roleSummary,
        responsibilities = [],
        qualifications = [],
        keywords = [],
        macroCriteria = [],
        microCriteria = [],
        technicalSkillRequirements = [],
        softSkillRequirements = [],
        requirements = [],
        roleCanonical,
        roleLevel,
    } = rubric;

    const macroLabels = unique(macroCriteria.map(c => typeof c === 'object' ? c.label : c)).slice(0, 6);
    const microLabels = unique(microCriteria.map(c => typeof c === 'object' ? c.label : c)).slice(0, 12);
    const reqLabels = unique(requirements.map(r => typeof r === 'object' ? r.label : r)).slice(0, 10);

    return `# ${title || roleCanonical || 'Target Role'} (${roleLevel || 'Mid-Senior'})

## Role Summary
${Array.isArray(roleSummary) ? roleSummary.slice(0, 2).join('\\n') : roleSummary || 'Role scope derived from JD responsibilities.'}

## Key Responsibilities (${responsibilities.length})
${responsibilities.slice(0, 6).map(r => `• ${r}`).join('\\n') || 'N/A'}

## Must-Have Qualifications (${qualifications.length})
${qualifications.slice(0, 5).map(q => `• ${q}`).join('\\n') || 'N/A'}

## Core Skills
**Technical:** ${technicalSkillRequirements.slice(0, 8).join(', ') || 'N/A'}
**Soft:** ${softSkillRequirements.slice(0, 6).join(', ') || 'N/A'}

## Macro Criteria (${macroLabels.length})
${macroLabels.map(m => `• ${m}`).join('\\n') || 'N/A'}

## Key Micro Criteria (${microLabels.length})
${microLabels.map(m => `• ${m}`).join('\\n') || 'N/A'}

## Key Requirements (${reqLabels.length})
${reqLabels.map(r => `• ${r}`).join('\\n') || 'N/A'}

**Keywords:** ${keywords.slice(0, 12).join(', ') || 'N/A'}`;
};

