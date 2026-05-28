/**
 * File responsibility: String manipulation utilities.
 * Main responsibilities:
 * - Provide pure string transformation functions.
 * - Support slug generation and formatting.
 * - No side effects, no state, no I/O.
 */

/**
 * Convert text to snake_case slug format.
 * Removes special characters, collapses underscores, trims edges.
 * @param {string} value - The text to slugify
 * @returns {string} Snake_case slug
 */
export const slugifyLabel = (value = '') =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');

/**
 * Convert snake_case to Title Case.
 * @param {string} canonical - Snake_case string
 * @returns {string} Title Case string
 */
export const prettifyCanonicalRole = (canonical = '') =>
    canonical
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

// Made with Bob
