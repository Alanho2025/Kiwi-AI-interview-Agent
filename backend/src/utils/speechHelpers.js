/**
 * Speech processing helper functions
 * Pure utility functions for text normalization and speech metrics
 */

export const normalizeText = (value = '') => String(value || '').trim();

export const countWords = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean).length;

export const normalizeForFillerCheck = (value = '') =>
    normalizeText(value).toLowerCase().replace(/[^\w\s']/g, '').replace(/\s+/g, ' ');

export const getSpeechDurationMs = (vad = null) => {
    const duration = Number(vad?.speechDurationMs ?? vad?.durationMs ?? 0);
    return Number.isFinite(duration) ? Math.max(0, duration) : 0;
};

export const getSttSegmentCount = (vad = null) => {
    const segmentCount = Number(vad?.sttSegmentCount);
    return Number.isFinite(segmentCount) ? segmentCount : null;
};

export const isFillerTranscript = (value = '', fillerSet) =>
    fillerSet.has(normalizeForFillerCheck(value));

export const hasContentfulLowConfidenceEvidence = ({ words, characters, speechDurationMs, sttSegmentCount, rules }) => {
    const minWords = rules.contentfulLowConfidenceMinWords ?? rules.lowConfidenceContentfulMinWords ?? 25;
    const minCharacters = rules.contentfulLowConfidenceMinCharacters ?? rules.lowConfidenceContentfulMinCharacters ?? 120;
    const minSpeechMs = rules.contentfulLowConfidenceMinSpeechMs ?? rules.lowConfidenceContentfulMinSpeechMs ?? 8000;
    const hasEnoughText = words >= minWords && characters >= minCharacters;
    const hasEnoughSpeech = speechDurationMs >= minSpeechMs;
    const hasFinalSpeechEvidence = sttSegmentCount === null || sttSegmentCount > 0;
    return hasEnoughText && hasEnoughSpeech && hasFinalSpeechEvidence;
};

// Made with Bob
