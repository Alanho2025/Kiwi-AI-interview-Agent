/**
 * Helper functions for OpsLite service
 * Pure functions for data transformation and calculations
 */

/**
 * Ensures value is an array
 * @param {*} value - Value to convert to array
 * @returns {Array} Array representation of value
 */
export const ensureArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Calculates average of numeric values
 * @param {Array} values - Array of values to average
 * @returns {number} Average value rounded to 2 decimal places, or 0 if no valid values
 */
export const average = (values = []) => {
    const nums = values.map(Number).filter((value) => Number.isFinite(value));
    return nums.length ? Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2)) : 0;
};

/**
 * Gets the latest report artifact from analysis
 * @param {Object} analysis - Analysis object with reportArtifacts array
 * @returns {Object} Latest report artifact or empty object
 */
export const latestReportArtifact = (analysis = {}) => ensureArray(analysis.reportArtifacts).at(-1) || {};

/**
 * Finds a step in latency breakdown by name
 * @param {Object} latency - Latency breakdown object
 * @param {Array<string>} names - Array of possible step names to match
 * @returns {Object|undefined} Matching step or undefined
 */
export const findStep = (latency = {}, names = []) => {
    const steps = ensureArray(latency.steps);
    return steps.find((step) => names.includes(step.step) || names.includes(step.name));
};

/**
 * Returns first finite number from arguments
 * @param {...*} values - Values to check
 * @returns {number|undefined} First finite number or undefined
 */
export const firstFinite = (...values) => values.map(Number).find((value) => Number.isFinite(value));

/**
 * Gets step mark timestamp in milliseconds
 * @param {Object} latency - Latency breakdown object
 * @param {Array<string>} names - Array of possible step names
 * @returns {number|undefined} Step mark in ms or undefined
 */
export const getStepMarkMs = (latency = {}, names = []) => firstFinite(
    findStep(latency, names)?.msFromStart,
    findStep(latency, names)?.timestampMs,
    findStep(latency, names)?.atMs,
);

/**
 * Gets step duration in milliseconds
 * @param {Object} latency - Latency breakdown object
 * @param {Array<string>} names - Array of possible step names
 * @returns {number|undefined} Step duration in ms or undefined
 */
export const getStepDurationMs = (latency = {}, names = []) => firstFinite(
    findStep(latency, names)?.durationMs,
    findStep(latency, names)?.ms,
);

/**
 * Extracts latency payload from event
 * @param {Object} event - Event object
 * @returns {Object} Latency breakdown object
 */
export const getLatencyPayload = (event = {}) => event.latencyBreakdown || event.latency || event.realtimeLatency || {};

/**
 * Resolves voice response latency from event
 * Prioritizes voiceResponseLatencyMs, then firstAudioSentMs, then step marks
 * @param {Object} event - Event object with latency data
 * @returns {number|undefined} Voice response latency in ms or undefined
 */
export const resolveVoiceResponseLatencyMs = (event = {}) => {
    const latency = getLatencyPayload(event);

    // These marks are stored as msFromStart by realtimeVoiceLatencySummary.js.
    // In realtime voice requests, the backend request starts after the client has finalized the user voice turn,
    // so first_audio_sent is the closest stored operational measure for "AI starts speaking" latency.
    return firstFinite(
        latency.voiceResponseLatencyMs,
        latency.firstAudioSentMs,
        latency.firstAudioSent,
        latency.ttsFirstAudioMs,
        getStepMarkMs(latency, ['first_audio_sent']),
        getStepMarkMs(latency, ['adaptive.tts_first_audio']),
        getStepMarkMs(latency, ['first_sentence_ready']),
    );
};

/**
 * Resolves total runtime from event
 * @param {Object} event - Event object with latency data
 * @returns {number|undefined} Total runtime in ms or undefined
 */
export const resolveRuntimeTotalMs = (event = {}) => {
    const latency = getLatencyPayload(event);
    return firstFinite(latency.totalTurnMs, latency.totalMs, latency.runtimeTraceTotalMs);
};

/**
 * Resolves latency duration from event
 * @param {Object} event - Event object with latency data
 * @param {Array<string>} names - Step names to search for
 * @param {Array<string>} flatKeys - Direct property keys to check
 * @returns {number|undefined} Duration in ms or undefined
 */
export const resolveLatencyDurationMs = (event = {}, names = [], flatKeys = []) => {
    const latency = getLatencyPayload(event);
    return firstFinite(
        ...flatKeys.map((key) => latency[key]),
        getStepDurationMs(latency, names),
    );
};

/**
 * Gets threshold value with fallback
 * @param {Object} thresholds - Thresholds object
 * @param {string} key - Threshold key
 * @param {number} fallback - Fallback value if not found
 * @returns {number} Threshold value or fallback
 */
export const thresholdValue = (thresholds = {}, key, fallback = 0) => {
    const value = Number(thresholds[key]);
    return Number.isFinite(value) ? value : fallback;
};

/**
 * Determines if a suite passed based on thresholds
 * @param {Object} summary - Suite summary object
 * @returns {boolean} True if suite passed all thresholds
 */
export const didSuitePass = (summary = {}) => {
    if (summary.label === 'Plan Eval Suite Summary') {
        return Number(summary.reportsAvailable || 0) === Number(summary.suitesAttempted || 0)
            && Number(summary.processPassRate || 0) === 1;
    }

    const thresholds = summary.thresholds || {};
    const minAverage = thresholdValue(thresholds, 'minAverage', 0);
    const failBelow = thresholdValue(thresholds, 'failBelow', 0);
    const minCriticalAverage = thresholdValue(thresholds, 'minCriticalAverage', 0);
    const criticalFailBelow = thresholdValue(thresholds, 'criticalFailBelow', 0);

    const averagePassed = Number(summary.average || 0) >= minAverage;
    const criticalAveragePassed = summary.criticalAverage === undefined || Number(summary.criticalAverage || 0) >= minCriticalAverage;
    const casesPassed = ensureArray(summary.results).every((item) => Number(item.score || 0) >= failBelow);
    const criticalCasesPassed = ensureArray(summary.results).every((item) => item.criticalScore === undefined || Number(item.criticalScore || 0) >= criticalFailBelow);

    return averagePassed && criticalAveragePassed && casesPassed && criticalCasesPassed;
};

/**
 * Collects failed cases from suite summary
 * @param {Object} summary - Suite summary object
 * @returns {Array} Array of failed cases with id, score, and failedChecks
 */
export const collectFailedCases = (summary = {}) => ensureArray(summary.results)
    .filter((item) => ensureArray(item.failedChecks).length > 0)
    .map((item) => ({
        id: item.id || item.case || 'case',
        score: item.score,
        failedChecks: ensureArray(item.failedChecks),
    }));

/**
 * Builds empty eval report summary structure
 * @returns {Object} Empty summary with default structure
 */
export const buildEmptyEvalReportSummary = () => ({
    reportDirectoryFound: false,
    totalSuites: 0,
    totalCases: 0,
    averageScore: 0,
    passRate: 0,
    warningCaseCount: 0,
    failedSuites: [],
    failedCases: [],
    suites: [],
    groups: {
        analysisQuality: [],
        trajectoryQuality: [],
        groundingSafety: [],
        voiceQuality: [],
        reliability: [],
    },
    riskCoverage: [],
});

// Made with Bob
