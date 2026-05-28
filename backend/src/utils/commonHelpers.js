/**
 * Common utility functions used across the codebase
 * 
 * This module provides frequently-used helper functions to avoid duplication.
 * All functions are pure (no side effects) and can be safely imported anywhere.
 */

/**
 * Ensure value is an array
 * @param {*} value - Value to check
 * @returns {Array} Array (original if already array, empty array otherwise)
 */
export const ensureArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Remove duplicates from array of strings
 * @param {Array} items - Array of items
 * @returns {Array} Array with unique trimmed non-empty strings
 */
export const unique = (items = []) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

/**
 * Normalize text by trimming whitespace
 * @param {string} value - Text to normalize
 * @returns {string} Trimmed text
 */
export const normalizeText = (value = '') => String(value || '').trim();

/**
 * Normalize text and collapse multiple spaces into single space
 * @param {string} value - Text to normalize
 * @returns {string} Normalized text with single spaces
 */
export const normalizeTextWithSpaces = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

/**
 * Normalize text to lowercase
 * @param {string} value - Text to normalize
 * @returns {string} Lowercase trimmed text
 */
export const normalizeTextLowercase = (value = '') => String(value || '').trim().toLowerCase();

/**
 * Tokenize text into alphanumeric tokens
 * @param {string} value - Text to tokenize
 * @returns {Array<string>} Array of lowercase alphanumeric tokens
 */
export const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Tokenize text including special characters like +, #, .
 * @param {string} value - Text to tokenize
 * @returns {Array<string>} Array of lowercase tokens (preserves +, #, .)
 */
export const tokenizeWithSpecialChars = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);

/**
 * Ensure value is a string
 * @param {*} value - Value to check
 * @param {string} fallback - Fallback value if not string
 * @returns {string} String value or fallback
 */
export const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

/**
 * Ensure value is a finite number
 * @param {*} value - Value to check
 * @param {number} fallback - Fallback value if not number
 * @returns {number} Number value or fallback
 */
export const ensureNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * Check if value is a plain object
 * @param {*} value - Value to check
 * @returns {boolean} True if plain object
 */
export const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

/**
 * Ensure value is a plain object
 * @param {*} value - Value to check
 * @param {Object} fallback - Fallback value if not object
 * @returns {Object} Object value or fallback
 */
export const ensureObject = (value, fallback = {}) => (isObject(value) ? value : fallback);

/**
 * Check if value has content (not empty)
 * @param {*} value - Value to check
 * @returns {boolean} True if value has content
 */
export const hasContent = (value) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(String(value).trim());
};

/**
 * Normalize key by converting to lowercase and trimming
 * @param {string} value - Key to normalize
 * @returns {string} Normalized lowercase key
 */
export const normalizeKey = (value = '') => normalizeText(value).toLowerCase();

/**
 * Split text into words
 * @param {string} value - Text to split
 * @returns {Array<string>} Array of words
 */
export const toWords = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean);

/**
 * Clamp number between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => Math.max(min, Math.min(max, ensureNumber(value)));

// Made with Bob
