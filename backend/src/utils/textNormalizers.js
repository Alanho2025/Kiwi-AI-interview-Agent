/**
 * File responsibility: Text normalization utilities.
 * Main responsibilities:
 * - Provide pure text transformation functions.
 * - No side effects, no state, no I/O.
 */

/**
 * Collapse multiple consecutive whitespace characters into single spaces and trim.
 * @param {string} text - The text to normalize
 * @returns {string} Text with collapsed whitespace
 */
export const collapseSpacing = (text) => text.replace(/\s+/g, ' ').trim();

// Made with Bob
