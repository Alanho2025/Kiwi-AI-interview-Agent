/**
 * Speech confidence gate configuration
 * Centralizes thresholds and rules for ASR confidence assessment
 */

export const DEFAULT_CONFIDENCE_THRESHOLDS = {
    high: 0.75,
    medium: 0.45,
};

export const DEFAULT_ACCEPTANCE_RULES = {
    minWords: 2,
    minCharacters: 8,
    minAcceptedSpeechMs: 900,
    mediumMinWords: 6,
    mediumMinSpeechMs: 2500,
    unknownMinWords: 8,
    unknownMinSpeechMs: 3500,
    lowConfidenceContentfulMinWords: 25,
    lowConfidenceContentfulMinCharacters: 120,
    lowConfidenceContentfulMinSpeechMs: 8000,
    contentfulLowConfidenceMinWords: 25,
    contentfulLowConfidenceMinCharacters: 120,
    contentfulLowConfidenceMinSpeechMs: 8000,
};

export const FILLER_TRANSCRIPTS = new Set([
    'ok',
    'okay',
    'yeah',
    'yes',
    'yep',
    'no',
    'nope',
    'hello',
    'hi',
    'um',
    'uh',
    'thanks',
    'thank you',
]);

// Made with Bob
