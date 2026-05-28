/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Provide pure helper functions for schema normalization
 * - Keep type checking and data transformation logic reusable
 * Maintenance notes:
 * - All functions here should be pure (no side effects)
 * - Add new normalization helpers here instead of in service files
 */

import {
    TRUST_LABELS,
    CONFIDENCE_LEVELS,
    FEEDBACK_STATUSES,
    STAR_PART_VALUES,
} from '../config/schemaValidationConstants.js';

/**
 * Check if value is a plain object (not array, not null)
 */
export const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

/**
 * Ensure value is an array, return empty array if not
 */
export const ensureArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Ensure value is a finite number, return fallback if not
 */
export const ensureNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * Ensure value is a string, return fallback if not
 */
export const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

/**
 * Normalize decision object with label and reasonCodes
 */
export const normalizeDecision = (decision = {}) => ({
    label: ensureString(decision.label, 'manual_review'),
    reasonCodes: ensureArray(decision.reasonCodes).filter(Boolean),
});

/**
 * Normalize section object with id, title, and content
 */
export const normalizeSection = (section = {}, index = 0) => ({
    id: ensureString(section.id, `section_${index + 1}`),
    title: ensureString(section.title, `Section ${index + 1}`),
    content: ensureString(section.content),
});

/**
 * Normalize candidate feedback item with all fields
 */
export const normalizeCandidateFeedbackItem = (item = {}) => ({
    id: ensureString(item.id),
    label: ensureString(item.label),
    title: ensureString(item.title),
    theme: ensureString(item.theme),
    value: ensureNumber(item.value, 0),
    interpretation: ensureString(item.interpretation),
    explanation: ensureString(item.explanation),
    whyItMatters: ensureString(item.whyItMatters),
    action: ensureString(item.action),
    advice: ensureString(item.advice),
    example: ensureString(item.example),
    weak: ensureString(item.weak),
    better: ensureString(item.better),
    quote: ensureString(item.quote),
    context: ensureString(item.context),
    critique: ensureString(item.critique),
    rewrite: ensureString(item.rewrite),
    description: ensureString(item.description),
    displayValue: ensureString(item.displayValue),
    unit: ensureString(item.unit),
    evidenceLabel: TRUST_LABELS.has(item.evidenceLabel) ? item.evidenceLabel : 'supported_by_answer',
    confidenceLevel: CONFIDENCE_LEVELS.has(item.confidenceLevel) ? item.confidenceLevel : 'medium',
    evidenceSources: ensureArray(item.evidenceSources).filter(Boolean),
    evidenceReason: ensureString(item.evidenceReason),
    needsUserConfirmation: Boolean(item.needsUserConfirmation),
    feedbackStatus: FEEDBACK_STATUSES.has(item.feedbackStatus) ? item.feedbackStatus : 'confirmed_feedback',
});

/**
 * Normalize score explanation with summary, helped, lowered, next
 */
export const normalizeScoreExplanation = (item = {}) => ({
    summary: ensureString(item.summary),
    helped: ensureString(item.helped),
    lowered: ensureString(item.lowered),
    next: ensureString(item.next),
});

/**
 * Normalize score explanations object with overall, cvJdMatch, interview
 */
export const normalizeScoreExplanations = (value = {}) => ({
    overall: normalizeScoreExplanation(value.overall),
    cvJdMatch: normalizeScoreExplanation(value.cvJdMatch),
    interview: normalizeScoreExplanation(value.interview),
});

/**
 * Normalize dimension reasons with business, logic, evidence
 */
export const normalizeDimensionReasons = (value = {}) => ({
    business: ensureString(value.business),
    logic: ensureString(value.logic),
    evidence: ensureString(value.evidence),
});

/**
 * Normalize STAR breakdown with situation, task, action, result
 */
export const normalizeStarBreakdown = (value = {}) => {
    if (value == null) return null;
    const normalizePart = (part) => STAR_PART_VALUES.includes(part) ? part : 'missing';
    return {
        situation: normalizePart(value.situation),
        task: normalizePart(value.task),
        action: normalizePart(value.action),
        result: normalizePart(value.result),
        mainMissingElement: ensureString(value.mainMissingElement, 'result'),
        scoreReason: ensureString(value.scoreReason),
    };
};

/**
 * Normalize structure breakdown (non-STAR)
 */
export const normalizeStructureBreakdown = (value = {}) => {
    if (!isObject(value)) return null;
    return {
        ...value,
        mainMissingElement: ensureString(value.mainMissingElement),
        scoreReason: ensureString(value.scoreReason),
    };
};

/**
 * Normalize turn breakdown with question, answer, feedback, scores, etc.
 */
export const normalizeTurnBreakdown = (item = {}) => ({
    question: ensureString(item.question),
    answer: ensureString(item.answer),
    feedback: ensureString(item.feedback),
    questionType: ensureString(item.questionType),
    questionStage: ensureString(item.questionStage),
    questionTopic: ensureString(item.questionTopic),
    rubricType: ensureString(item.rubricType, 'star'),
    starApplicable: item.starApplicable !== false,
    structureLabel: ensureString(item.structureLabel, item.starApplicable === false ? 'Answer structure' : 'STAR evidence'),
    structureBreakdown: normalizeStructureBreakdown(item.structureBreakdown || item.starBreakdown),
    scores: isObject(item.scores)
        ? {
            business: ensureNumber(item.scores.business, 0),
            logic: ensureNumber(item.scores.logic, 0),
            evidence: ensureNumber(item.scores.evidence, 0),
        }
        : { business: 0, logic: 0, evidence: 0 },
    dimensionReasons: normalizeDimensionReasons(item.dimensionReasons || item.scoreReasons),
    starBreakdown: item.starApplicable === false ? null : normalizeStarBreakdown(item.starBreakdown || {}),
    evidenceLabel: TRUST_LABELS.has(item.evidenceLabel) ? item.evidenceLabel : 'supported_by_answer',
    confidenceLevel: CONFIDENCE_LEVELS.has(item.confidenceLevel) ? item.confidenceLevel : 'medium',
    evidenceSources: ensureArray(item.evidenceSources).filter(Boolean),
    evidenceReason: ensureString(item.evidenceReason),
    needsUserConfirmation: Boolean(item.needsUserConfirmation),
    feedbackStatus: FEEDBACK_STATUSES.has(item.feedbackStatus) ? item.feedbackStatus : 'confirmed_feedback',
});

/**
 * Normalize NZ workplace dimension
 */
export const normalizeNzWorkplaceDimension = (item = {}) => ({
    id: ensureString(item.id),
    label: ensureString(item.label),
    score: ensureNumber(item.score, 0),
    observed: Boolean(item.observed),
    riskDetected: Boolean(item.riskDetected),
    evidenceQuote: ensureString(item.evidenceQuote),
    riskQuote: ensureString(item.riskQuote),
    feedback: ensureString(item.feedback),
});

/**
 * Normalize NZ workplace evidence
 */
export const normalizeNzWorkplaceEvidence = (item = {}) => ({
    dimension: ensureString(item.dimension),
    quote: ensureString(item.quote),
    signal: ensureString(item.signal),
});

/**
 * Normalize NZ suggested rewrite
 */
export const normalizeNzSuggestedRewrite = (item = null) => isObject(item)
    ? {
        weak: ensureString(item.weak),
        better: ensureString(item.better),
        reason: ensureString(item.reason),
    }
    : null;

/**
 * Normalize NZ workplace fit
 */
export const normalizeNzWorkplaceFit = (value = {}) => ({
    enabled: Boolean(value.enabled),
    score: Number.isFinite(Number(value.score)) ? Number(value.score) : null,
    summary: ensureString(value.summary),
    dimensionScores: ensureArray(value.dimensionScores).map(normalizeNzWorkplaceDimension),
    strengths: ensureArray(value.strengths).filter(Boolean),
    gaps: ensureArray(value.gaps).filter(Boolean),
    evidence: ensureArray(value.evidence).map(normalizeNzWorkplaceEvidence),
    suggestedRewrite: normalizeNzSuggestedRewrite(value.suggestedRewrite),
});

/**
 * Normalize company motivation signal
 */
export const normalizeCompanyMotivationSignal = (value = {}) => ({
    score: ensureNumber(value.score, 0),
    comment: ensureString(value.comment),
});

/**
 * Normalize company motivation fit
 */
export const normalizeCompanyMotivationFit = (value = {}) => ({
    source: ensureString(value.source, 'general_fallback'),
    score: ensureNumber(value.score, 0),
    summary: ensureString(value.summary),
    matchedValues: ensureArray(value.matchedValues).map((item) => ({
        value: ensureString(item.value),
        candidateQuote: ensureString(item.candidateQuote),
        comment: ensureString(item.comment),
    })),
    missingValues: ensureArray(value.missingValues).map((item) => ({
        value: ensureString(item.value),
        whyItMatters: ensureString(item.whyItMatters),
        suggestion: ensureString(item.suggestion),
    })),
    candidateResearchSignal: normalizeCompanyMotivationSignal(value.candidateResearchSignal),
    roleMotivationSignal: normalizeCompanyMotivationSignal(value.roleMotivationSignal),
    suggestedRewrite: ensureString(value.suggestedRewrite),
    fallbackReason: ensureString(value.fallbackReason),
    evidenceStrength: ensureString(value.evidenceStrength),
});

/**
 * Normalize voice delivery summary
 */
export const normalizeVoiceDeliverySummary = (value = {}) => isObject(value)
    ? {
        turnCount: ensureNumber(value.turnCount, 0),
        averageWordsPerMinute: Number.isFinite(Number(value.averageWordsPerMinute)) ? Number(value.averageWordsPerMinute) : null,
        averageSpeakingDurationSeconds: Number.isFinite(Number(value.averageSpeakingDurationSeconds)) ? Number(value.averageSpeakingDurationSeconds) : null,
        totalFillerCount: ensureNumber(value.totalFillerCount, 0),
        totalLongPauseCount: ensureNumber(value.totalLongPauseCount, 0),
        totalRepeatedCorrections: ensureNumber(value.totalRepeatedCorrections, 0),
        totalUnclearSpeechSegments: ensureNumber(value.totalUnclearSpeechSegments, 0),
        deliveryConfidence: ensureString(value.deliveryConfidence),
        feedback: ensureArray(value.feedback).filter(Boolean),
    }
    : null;

// Made with Bob