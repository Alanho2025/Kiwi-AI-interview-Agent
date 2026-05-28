/**
 * Tests for commonHelpers utility functions
 */

import { describe, it, expect } from 'vitest';
import {
    ensureArray,
    unique,
    normalizeText,
    normalizeTextWithSpaces,
    normalizeTextLowercase,
    tokenize,
    tokenizeWithSpecialChars,
    ensureString,
    ensureNumber,
    isObject,
    ensureObject,
    hasContent,
    normalizeKey,
    toWords,
    clamp,
} from '../../src/utils/commonHelpers.js';

describe('commonHelpers', () => {
    describe('ensureArray', () => {
        it('should return array as-is', () => {
            expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
            expect(ensureArray([])).toEqual([]);
        });

        it('should return empty array for non-arrays', () => {
            expect(ensureArray(null)).toEqual([]);
            expect(ensureArray(undefined)).toEqual([]);
            expect(ensureArray('string')).toEqual([]);
            expect(ensureArray(123)).toEqual([]);
            expect(ensureArray({})).toEqual([]);
        });
    });

    describe('unique', () => {
        it('should remove duplicates', () => {
            expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
        });

        it('should trim and filter empty strings', () => {
            expect(unique(['  a  ', 'b', '', '  ', 'a'])).toEqual(['a', 'b']);
        });

        it('should handle non-string items', () => {
            expect(unique([1, 2, 1, 3])).toEqual(['1', '2', '3']);
        });

        it('should handle empty array', () => {
            expect(unique([])).toEqual([]);
            expect(unique()).toEqual([]);
        });
    });

    describe('normalizeText', () => {
        it('should trim whitespace', () => {
            expect(normalizeText('  hello  ')).toBe('hello');
            expect(normalizeText('\n\thello\n')).toBe('hello');
        });

        it('should handle empty values', () => {
            expect(normalizeText('')).toBe('');
            expect(normalizeText(null)).toBe('');
            expect(normalizeText(undefined)).toBe('');
        });

        it('should convert to string', () => {
            expect(normalizeText(123)).toBe('123');
            expect(normalizeText(true)).toBe('true');
        });
    });

    describe('normalizeTextWithSpaces', () => {
        it('should collapse multiple spaces', () => {
            expect(normalizeTextWithSpaces('hello   world')).toBe('hello world');
            expect(normalizeTextWithSpaces('a  b  c')).toBe('a b c');
        });

        it('should handle tabs and newlines', () => {
            expect(normalizeTextWithSpaces('hello\t\nworld')).toBe('hello world');
        });
    });

    describe('normalizeTextLowercase', () => {
        it('should convert to lowercase', () => {
            expect(normalizeTextLowercase('HELLO')).toBe('hello');
            expect(normalizeTextLowercase('Hello World')).toBe('hello world');
        });

        it('should trim whitespace', () => {
            expect(normalizeTextLowercase('  HELLO  ')).toBe('hello');
        });
    });

    describe('tokenize', () => {
        it('should split into alphanumeric tokens', () => {
            expect(tokenize('hello-world')).toEqual(['hello', 'world']);
            expect(tokenize('test123')).toEqual(['test123']);
        });

        it('should not filter short tokens', () => {
            expect(tokenize('a b cd')).toEqual(['a', 'b', 'cd']);
        });

        it('should convert to lowercase', () => {
            expect(tokenize('Hello World')).toEqual(['hello', 'world']);
        });

        it('should handle empty input', () => {
            expect(tokenize('')).toEqual([]);
            expect(tokenize()).toEqual([]);
        });
    });

    describe('tokenizeWithSpecialChars', () => {
        it('should preserve special characters', () => {
            expect(tokenizeWithSpecialChars('C++ C#')).toEqual(['c++', 'c#']);
            expect(tokenizeWithSpecialChars('node.js')).toEqual(['node.js']);
        });
    });

    describe('ensureString', () => {
        it('should return string as-is', () => {
            expect(ensureString('hello')).toBe('hello');
        });

        it('should return fallback for non-strings', () => {
            expect(ensureString(123)).toBe('');
            expect(ensureString(null)).toBe('');
            expect(ensureString(123, 'default')).toBe('default');
        });
    });

    describe('ensureNumber', () => {
        it('should return number as-is', () => {
            expect(ensureNumber(123)).toBe(123);
            expect(ensureNumber(0)).toBe(0);
            expect(ensureNumber(-5)).toBe(-5);
        });

        it('should convert string numbers', () => {
            expect(ensureNumber('123')).toBe(123);
            expect(ensureNumber('45.67')).toBe(45.67);
        });

        it('should return fallback for non-numbers', () => {
            expect(ensureNumber('abc')).toBe(0);
            expect(ensureNumber(null)).toBe(0);
            expect(ensureNumber(NaN)).toBe(0);
            expect(ensureNumber(Infinity)).toBe(0);
            expect(ensureNumber('abc', 99)).toBe(99);
        });
    });

    describe('isObject', () => {
        it('should return true for plain objects', () => {
            expect(isObject({})).toBe(true);
            expect(isObject({ a: 1 })).toBe(true);
        });

        it('should return false for non-objects', () => {
            expect(isObject(null)).toBeFalsy();
            expect(isObject(undefined)).toBeFalsy();
            expect(isObject([])).toBe(false);
            expect(isObject('string')).toBe(false);
            expect(isObject(123)).toBe(false);
        });
    });

    describe('ensureObject', () => {
        it('should return object as-is', () => {
            const obj = { a: 1 };
            expect(ensureObject(obj)).toBe(obj);
        });

        it('should return fallback for non-objects', () => {
            expect(ensureObject(null)).toEqual({});
            expect(ensureObject([])).toEqual({});
            expect(ensureObject('string')).toEqual({});
            expect(ensureObject(null, { default: true })).toEqual({ default: true });
        });
    });

    describe('hasContent', () => {
        it('should return true for non-empty values', () => {
            expect(hasContent('hello')).toBe(true);
            expect(hasContent([1])).toBe(true);
            expect(hasContent({ a: 1 })).toBe(true);
            expect(hasContent(123)).toBe(true);
        });

        it('should return false for empty values', () => {
            expect(hasContent('')).toBe(false);
            expect(hasContent('  ')).toBe(false);
            expect(hasContent([])).toBe(false);
            expect(hasContent({})).toBe(false);
            expect(hasContent(null)).toBe(false);
            expect(hasContent(undefined)).toBe(false);
            expect(hasContent(0)).toBe(false);
        });
    });

    describe('normalizeKey', () => {
        it('should convert to lowercase key', () => {
            expect(normalizeKey('HELLO')).toBe('hello');
            expect(normalizeKey('  Hello  ')).toBe('hello');
        });
    });

    describe('toWords', () => {
        it('should split into words', () => {
            expect(toWords('hello world')).toEqual(['hello', 'world']);
            expect(toWords('one  two   three')).toEqual(['one', 'two', 'three']);
        });

        it('should handle empty input', () => {
            expect(toWords('')).toEqual([]);
            expect(toWords('  ')).toEqual([]);
        });
    });

    describe('clamp', () => {
        it('should clamp value between min and max', () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(15, 0, 10)).toBe(10);
        });

        it('should handle edge cases', () => {
            expect(clamp(0, 0, 10)).toBe(0);
            expect(clamp(10, 0, 10)).toBe(10);
        });

        it('should handle non-numeric values', () => {
            expect(clamp('abc', 0, 10)).toBe(0);
            expect(clamp(null, 0, 10)).toBe(0);
        });
    });
});

// Made with Bob
