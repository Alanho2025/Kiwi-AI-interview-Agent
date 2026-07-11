/**
 * Report utility functions
 * Pure functions for report data processing and formatting
 */

/**
 * Build a status object for UI display
 * @param {string} variant - Status variant: 'info', 'success', 'error'
 * @param {string} title - Status title
 * @param {string} message - Status message
 * @returns {Object} Status object
 */
export const buildStatus = (variant, title, message) => ({ variant, title, message });

/**
 * Check if an error indicates a missing report
 * @param {Error} error - Error object
 * @returns {boolean} True if error indicates missing report
 */
export const isMissingReportError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('report not found') || message.includes('no report exists');
};

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} timeoutMessage - Error message on timeout
 * @returns {Promise} Promise that rejects on timeout
 */
export const withTimeout = (promise, timeoutMs, timeoutMessage) => {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        window.clearTimeout(timeoutId);
    });
};

const formatScore = (value, suffix = '') => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(2)}${suffix}` : 'Not available';
};

const formatListItem = (item) => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return String(item ?? '');
    return item.title || item.label || item.description || item.content || item.summary || JSON.stringify(item);
};

const ROLE_FIT_COVERAGE_LABELS = {
    covered: 'Clearly demonstrated',
    partial: 'Partly demonstrated',
    missing: 'Needs stronger evidence',
    unavailable: 'Not assessed',
};

const ROLE_FIT_ANSWER_LABELS = {
    strong: 'Strong match for this answer',
    partial: 'Partly matched this focus',
    weak: 'Needs a clearer connection',
    off_target: 'Did not yet answer this focus',
    unavailable: 'Not assessed',
};

/**
 * Format report as readable text
 * Mirrors backend formatReportAsText function
 * @param {Object} report - Report object from MongoDB
 * @returns {string} Formatted text string
 */
export const formatReportAsText = (report) => {
    const lines = [];
    const r = report.report || {};
    const qa = report.qaResult || {};

    lines.push('KIWI AI INTERVIEW AGENT - INTERVIEW REPORT');
    lines.push('==========================================');
    lines.push(`Generated: ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : new Date().toLocaleString()}`);
    lines.push(`Session ID: ${report.sessionId}`);
    lines.push(`Report Status: ${report.latestStatus || 'unknown'}`);
    lines.push(`Schema Version: ${r.schemaVersion || 'unknown'}`);
    lines.push('');

    if (r.candidateName || r.jobTitle) {
        lines.push('CANDIDATE & ROLE');
        lines.push('================');
        if (r.candidateName) lines.push(`Candidate: ${r.candidateName}`);
        if (r.jobTitle) lines.push(`Target Role: ${r.jobTitle}`);
        lines.push('');
    }

    if (r.summary) {
        lines.push('EXECUTIVE SUMMARY');
        lines.push('=================');
        lines.push(r.summary);
        lines.push('');
    }

    if (r.scores) {
        lines.push('SCORES');
        lines.push('======');
        if (r.scores.overall !== undefined) lines.push(`Overall Score: ${formatScore(r.scores.overall, '/100')}`);
        if (r.scores.macro !== undefined) lines.push(`Macro Score: ${formatScore(r.scores.macro, '/100')}`);
        if (r.scores.micro !== undefined) lines.push(`Micro Score: ${formatScore(r.scores.micro, '/100')}`);
        if (r.scores.requirements !== undefined) lines.push(`Requirements Score: ${formatScore(r.scores.requirements, '/100')}`);
        if (r.scores.evidenceStrength !== undefined) lines.push(`Evidence Strength: ${formatScore(r.scores.evidenceStrength, '/4')}`);
        if (r.scores.directEvidenceTurns !== undefined) lines.push(`Direct Evidence Turns: ${r.scores.directEvidenceTurns}`);
        if (r.scores.hypotheticalTurns !== undefined) lines.push(`Hypothetical Turns: ${r.scores.hypotheticalTurns}`);
        lines.push('');
    }

    if (r.sections && r.sections.length > 0) {
        lines.push('DETAILED ANALYSIS');
        lines.push('=================');
        lines.push('');
        r.sections.forEach((section, i) => {
            lines.push(`${i + 1}. ${section.title || 'Section'}`);
            lines.push('-'.repeat(section.title ? section.title.length + 3 : 10));
            if (section.content) {
                lines.push(section.content);
            }
            lines.push('');
        });
    }

    if (r.roleFit?.status && r.roleFit.status !== 'legacy') {
        const roleFit = r.roleFit;
        const coverage = roleFit.roleIntentCoverage || {};
        lines.push('HOW YOUR ANSWERS MATCHED THIS ROLE');
        lines.push('==================================');
        if (roleFit.status === 'unavailable') {
            lines.push('Role-specific coaching was unavailable. Existing interview feedback remains available.');
        } else {
            lines.push(`${coverage.covered || 0} of ${coverage.total || 0} focus areas clearly demonstrated.`);
            (coverage.items || []).forEach((item) => {
                lines.push(`- ${item.label || 'Role focus'}: ${ROLE_FIT_COVERAGE_LABELS[item.status] || 'Not assessed'}`);
            });
            (roleFit.answerAlignments || []).forEach((alignment, index) => {
                lines.push('');
                lines.push(`Answer ${index + 1}: ${alignment.question || 'Interview question'}`);
                lines.push(`${ROLE_FIT_ANSWER_LABELS[alignment.label] || 'Not assessed'} (${Number(alignment.score || 0)}/100)`);
                if (alignment.diagnosis?.mainIssue) lines.push(alignment.diagnosis.mainIssue);
                if (alignment.betterAnswerPlan?.direction) lines.push(`Next step: ${alignment.betterAnswerPlan.direction}`);
            });
        }
        lines.push('');
    }

    if (r.recommendations && r.recommendations.length > 0) {
        lines.push('RECOMMENDATIONS');
        lines.push('===============');
        r.recommendations.forEach((rec, i) => {
            lines.push(`${i + 1}. ${formatListItem(rec)}`);
        });
        lines.push('');
    }

    if (r.interviewMetrics) {
        lines.push('INTERVIEW METRICS');
        lines.push('=================');
        const m = r.interviewMetrics;
        if (m.candidateTurnCount !== undefined) lines.push(`Candidate Turns: ${m.candidateTurnCount}`);
        if (m.interviewerQuestionCount !== undefined) lines.push(`Interviewer Questions: ${m.interviewerQuestionCount}`);
        if (m.plannedQuestionCount !== undefined) lines.push(`Planned Questions: ${m.plannedQuestionCount}`);
        if (m.extraAiTurnCount !== undefined) lines.push(`Extra AI Turns: ${m.extraAiTurnCount}`);
        if (m.interviewCompletedByLimit !== undefined) lines.push(`Completed by Limit: ${m.interviewCompletedByLimit ? 'Yes' : 'No'}`);
        lines.push('');
    }

    if (r.evidenceDiagnostics) {
        lines.push('EVIDENCE DIAGNOSTICS');
        lines.push('====================');
        const ed = r.evidenceDiagnostics;
        if (ed.averageStrength !== undefined) lines.push(`Average Strength: ${ed.averageStrength}/4`);
        if (ed.totals) {
            lines.push('Evidence Type Breakdown:');
            if (ed.totals.direct_past_experience !== undefined) lines.push(`  - Direct Past Experience: ${ed.totals.direct_past_experience}`);
            if (ed.totals.adjacent_experience !== undefined) lines.push(`  - Adjacent Experience: ${ed.totals.adjacent_experience}`);
            if (ed.totals.hypothetical_understanding !== undefined) lines.push(`  - Hypothetical Understanding: ${ed.totals.hypothetical_understanding}`);
            if (ed.totals.generic_filler !== undefined) lines.push(`  - Generic Filler: ${ed.totals.generic_filler}`);
        }
        lines.push('');
    }

    if (qa && Object.keys(qa).length > 0) {
        lines.push('QUALITY ASSURANCE');
        lines.push('=================');
        if (report.latestStatus) lines.push(`Report Status: ${report.latestStatus}`);
        if (qa.coverage !== undefined) lines.push(`Coverage: ${qa.coverage}%`);
        if (qa.coverageScore !== undefined) lines.push(`Coverage Score: ${qa.coverageScore}/100`);
        if (qa.quality !== undefined) lines.push(`Quality: ${qa.quality}%`);
        if (qa.completeness !== undefined) lines.push(`Completeness: ${qa.completeness}%`);
        if (qa.hallucinationRisk) lines.push(`Hallucination Risk: ${qa.hallucinationRisk}`);
        if (qa.notes && qa.notes.length > 0) {
            lines.push('QA Notes:');
            qa.notes.forEach((note, i) => {
                lines.push(`  ${i + 1}. ${formatListItem(note)}`);
            });
        }
        const qaFlags = qa.flags || qa.qualityFlags || [];
        if (qaFlags.length > 0) {
            lines.push('QA Flags:');
            qaFlags.forEach((flag, i) => {
                lines.push(`  ${i + 1}. ${formatListItem(flag)}`);
            });
        }
        lines.push('');
    }

    lines.push('END OF REPORT');
    lines.push('=============');

    return lines.join('\n');
};

// Made with Bob
