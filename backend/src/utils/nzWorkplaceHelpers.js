/**
 * Helper functions for NZ workplace fit scoring.
 * Pure functions for text processing, pattern matching, and score calculation.
 */

/**
 * Ensure value is an array
 */
export const ensureArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Normalize text by collapsing whitespace
 */
export const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

/**
 * Tokenize text into lowercase words
 */
export const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Extract candidate turns from transcript
 */
export const candidateTurns = (transcript = []) => ensureArray(transcript)
    .filter((turn) => String(turn?.role || '').toLowerCase() === 'user')
    .map((turn) => normalizeText(turn.text))
    .filter(Boolean);

/**
 * Split turns into sentences
 */
export const splitSentences = (turns = []) => turns
    .flatMap((text) => text.split(/(?<=[.!?])\s+|\n+/))
    .map(normalizeText)
    .filter(Boolean);

/**
 * Find first sentence matching any pattern
 */
export const firstMatch = (sentences = [], patterns = []) => sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence))) || '';

/**
 * Count how many patterns match the text
 */
export const countMatches = (text = '', patterns = []) => patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);

/**
 * Clamp score to 0-10 range with one decimal
 */
export const clampScore = (value) => Math.max(0, Math.min(10, Number(value.toFixed(1))));

/**
 * Build dimension score object
 */
export const buildDimensionScore = ({ dimension, transcriptText, sentences, findValueById }) => {
    const positiveCount = countMatches(transcriptText, dimension.positive);
    const gapCount = countMatches(transcriptText, dimension.gap);
    const evidenceQuote = firstMatch(sentences, dimension.positive);
    const riskQuote = firstMatch(sentences, dimension.gap);
    const score = clampScore(4.5 + Math.min(3.5, positiveCount * 1.4) - Math.min(3, gapCount * 1.8));

    const kbEntry = findValueById(dimension.id);

    return {
        id: dimension.id,
        label: dimension.label,
        score,
        observed: positiveCount > 0,
        riskDetected: gapCount > 0,
        evidenceQuote,
        riskQuote,
        feedback: positiveCount > 0 && gapCount === 0 ? dimension.strength : dimension.gapText,
        culturalContext: kbEntry?.whyItMatters || null,
        exampleAnswer: kbEntry?.exampleAnswer || null,
        interviewSignals: kbEntry?.interviewSignals || [],
    };
};

/**
 * Build summary text based on score and feedback
 */
export const buildSummary = ({ score, strengths, gaps }) => {
    if (score >= 8) return 'Your answers showed strong NZ workplace communication signals: clear evidence, collaboration, and respectful professional tone.';
    if (score >= 6.5) return 'Your answers showed useful NZ workplace fit signals, with room to make collaboration and relationship-building more explicit.';
    if (strengths.length > 0) return 'Your answers had some NZ workplace fit signals, but several responses would land better with clearer teamwork, humility, and communication evidence.';
    if (gaps.length > 0) return 'The transcript did not yet show enough observable NZ workplace communication evidence, so the coaching should be treated as preparation guidance.';
    return 'There was not enough candidate transcript evidence to assess NZ workplace communication fit.';
};

/**
 * Pick suggested rewrite based on detected risks
 */
export const pickSuggestedRewrite = ({ sentences, dimensionScores }) => {
    const risk = dimensionScores.find((item) => item.riskQuote);
    if (risk?.id === 'teamwork' || risk?.id === 'humility_confidence') {
        return {
            weak: risk.riskQuote,
            better: 'I led the main implementation, and I kept the team aligned through design checks and review so the final solution matched our shared goal.',
            reason: 'This keeps ownership clear while showing collaboration, humility, and shared outcomes.',
        };
    }

    const genericTeamwork = sentences.find((sentence) => /\b(good team player|work well in teams|communication is important)\b/i.test(sentence));
    if (genericTeamwork) {
        return {
            weak: genericTeamwork,
            better: 'When our team hit a blocker, I clarified the issue, coordinated the next step with teammates, and helped us reach a shared decision.',
            reason: 'This turns a broad claim into a concrete teamwork and communication example.',
        };
    }

    const firstCandidateSentence = sentences[0] || '';
    return {
        weak: firstCandidateSentence,
        better: firstCandidateSentence
            ? `${firstCandidateSentence} I would also add who I worked with, how I communicated the decision, and what result it created for the team or user.`
            : '',
        reason: 'NZ workplace interview answers usually land better when they connect personal action to team, user, or stakeholder impact.',
    };
};

// Made with Bob
