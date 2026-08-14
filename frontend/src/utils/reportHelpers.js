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

const hasInterviewPerformance = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : value;
    return (typeof normalized === 'number' || typeof normalized === 'string')
        && normalized !== ''
        && Number.isFinite(Number(normalized));
};

const formatListItem = (item) => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return String(item ?? '');
    return item.title || item.label || item.message || item.description || item.content || item.summary || JSON.stringify(item);
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

    lines.push('KIWI AI INTERVIEW AGENT - INTERVIEW REPORT');
    lines.push('==========================================');
    lines.push(`Generated: ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : new Date().toLocaleString()}`);
    lines.push(`Report Status: ${report.latestStatus || 'unknown'}`);
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

    if (r.legacyLimitations?.length) {
        lines.push('REPORT LIMITATION');
        lines.push('=================');
        r.legacyLimitations.forEach((item) => lines.push(`- ${formatListItem(item)}`));
        lines.push('');
    }

    if (r.transcriptRisks?.length) {
        lines.push('TRANSCRIPT RISKS');
        lines.push('================');
        r.transcriptRisks.forEach((item) => lines.push(`- ${formatListItem(item)}`));
        lines.push('');
    }

    if (hasInterviewPerformance(r.scores?.overall)) {
        lines.push('SCORES');
        lines.push('======');
        lines.push(`Interview Performance: ${formatScore(r.scores.overall, '/100')}`);
        lines.push('');
    }

    const scoreExplanations = hasInterviewPerformance(r.scores?.overall)
        ? Object.entries(r.scoreExplanations || {})
            .filter(([key, item]) => key === 'overall' && item?.explanation)
        : [];
    if (scoreExplanations.length) {
        lines.push('SCORE EXPLANATIONS');
        lines.push('==================');
        scoreExplanations.forEach(([key, item]) => {
            lines.push(`- ${key}: ${item.explanation}`);
        });
        lines.push('');
    }

    const feedback = r.candidateFeedback || {};
    if (feedback.plainEnglishMetrics?.length) {
        lines.push('KEY INSIGHTS');
        lines.push('============');
        feedback.plainEnglishMetrics.slice(0, 3).forEach((item) => {
            const title = item?.title || item?.label || 'Insight';
            const detail = item?.description || item?.interpretation || item?.summary || '';
            lines.push(`- ${title}${detail ? `: ${detail}` : ''}`);
        });
        lines.push('');
    }

    if (feedback.improvementPriorities?.length) {
        lines.push('TOP IMPROVEMENTS');
        lines.push('================');
        feedback.improvementPriorities.slice(0, 3).forEach((item, index) => {
            lines.push(`${index + 1}. ${item.title || 'Improvement'}`);
            if (item.whyItMatters || item.detail) lines.push(item.whyItMatters || item.detail);
            if (item.action || item.example) lines.push(`Next step: ${item.action || item.example}`);
        });
        lines.push('');
    }

    if (feedback.turnBreakdowns?.length) {
        lines.push('ANSWER FEEDBACK');
        lines.push('===============');
        feedback.turnBreakdowns.forEach((turn, index) => {
            lines.push(`${index + 1}. ${turn.question || 'Interview question'}`);
            if (turn.answer || turn.answerSummary) lines.push(`Your answer: ${turn.answer || turn.answerSummary}`);
            if (turn.feedback) lines.push(`Feedback: ${turn.feedback}`);
            
            const frameworkLabel = turn.frameworkLabel || turn.structureLabel || 'Role-specific reasoning';
            if (turn.frameworkBreakdown?.dimensions?.length) {
                const score = Number(turn.frameworkBreakdown.normalizedScore);
                lines.push(`Framework: ${frameworkLabel}${Number.isFinite(score) ? ` (${score}/10)` : ''}`);
                turn.frameworkBreakdown.dimensions
                    .filter((d) => d.status !== 'not_applicable')
                    .forEach((d) => {
                        lines.push(`  - ${d.label} (${Number(d.score || 0)}/10): ${d.reason || String(d.status).replace(/_/g, ' ')}`);
                    });
            } else if (turn.scores && !turn.starrBreakdown && !turn.starBreakdown) {
                lines.push(`Framework: ${frameworkLabel}`);
                lines.push(`  - Business: ${turn.scores.business ?? '-'}/10`);
                lines.push(`  - Logic: ${turn.scores.logic ?? '-'}/10`);
                lines.push(`  - Evidence: ${turn.scores.evidence ?? '-'}/10`);
            }

            if (turn.durationAssessment?.eligible) {
                const d = turn.durationAssessment;
                lines.push(`Duration: ${d.seconds || 0}s (${d.earnedPoints || 0}/${d.maxPoints || 10})`);
            }
        });
        lines.push('');
    }

    if (feedback.answerRewriteExamples?.length) {
        lines.push('HOW TO ANSWER BETTER');
        lines.push('====================');
        feedback.answerRewriteExamples.forEach((item, index) => {
            lines.push(`${index + 1}. Weaker: ${item.weak || 'Not available'}`);
            lines.push(`   Stronger: ${item.better || item.failureReason || 'Rewrite unavailable'}`);
        });
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

    lines.push('END OF REPORT');
    lines.push('=============');

    return lines.join('\n');
};

// Made with Bob
