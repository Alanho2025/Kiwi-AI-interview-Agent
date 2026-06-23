import { describe, expect, it } from 'vitest';
import { normalizeTranscript } from '../../src/services/voice/transcriptNormalizer.js';
import { buildSessionSpeechPhraseList } from '../../src/services/voice/speechPhraseHintService.js';

describe('transcriptNormalizer', () => {
    it('adds candidate and project terminology to session phrase hints', () => {
        const phrases = buildSessionSpeechPhraseList({
            candidateName: 'A Candidate',
            analysisResult: { parsedCvProfile: { projects: [{ title: 'Kiwi Voice Coach' }] } },
        });

        expect(phrases).toEqual(expect.arrayContaining([
            'A Candidate',
            'Kiwi Voice Coach',
            'prompt engineering',
            'test-driven development',
            'Codex',
        ]));
    });

    describe('normalizeTranscript', () => {
        it('should handle empty, null, and undefined input', () => {
            expect(normalizeTranscript('')).toEqual({
                rawText: '',
                normalizedText: '',
                changed: false,
                corrections: [],
            });

            expect(normalizeTranscript(null)).toEqual({
                rawText: '',
                normalizedText: '',
                changed: false,
                corrections: [],
            });

            expect(normalizeTranscript(undefined)).toEqual({
                rawText: '',
                normalizedText: '',
                changed: false,
                corrections: [],
            });
        });

        it('should collapse multiple spaces, tabs, and newlines', () => {
            const result = normalizeTranscript('Hello    world\t\tfoo\n\nbar');
            expect(result.rawText).toBe('Hello world foo bar');
            expect(result.normalizedText).toBe('Hello world foo bar');
            expect(result.changed).toBe(false);
        });

        it('should normalize React Query case-insensitively', () => {
            const testCases = [
                'I used react query',
                'I used REACT QUERY',
                'I used React Query',
                'I used ReAcT qUeRy',
            ];

            testCases.forEach((input) => {
                const result = normalizeTranscript(input);
                expect(result.normalizedText).toContain('React Query');
                expect(result.changed).toBe(input !== result.normalizedText);
                if (result.changed) {
                    expect(result.corrections).toHaveLength(1);
                    expect(result.corrections[0].replacement).toBe('React Query');
                }
            });
        });

        it('should normalize TanStack Query variations', () => {
            const testCases = [
                { input: 'tan stack', expected: 'TanStack Query' },
                { input: 'tan stack query', expected: 'TanStack Query' },
                { input: 'TAN STACK QUERY', expected: 'TanStack Query' },
            ];

            testCases.forEach(({ input, expected }) => {
                const result = normalizeTranscript(input);
                expect(result.normalizedText).toContain(expected);
                expect(result.changed).toBe(true);
            });
        });

        it('should normalize PostgreSQL variations', () => {
            const testCases = [
                'post gray sql',
                'postgre sql',
                'postgres sql',
                'POST GRAY SQL',
            ];

            testCases.forEach((input) => {
                const result = normalizeTranscript(input);
                expect(result.normalizedText).toContain('PostgreSQL');
                expect(result.changed).toBe(true);
                expect(result.corrections.some((c) => c.replacement === 'PostgreSQL')).toBe(true);
            });
        });

        it('should normalize multiple technical terms in one input', () => {
            const input = 'I used react query with post gray sql and node js';
            const result = normalizeTranscript(input);

            expect(result.normalizedText).toContain('React Query');
            expect(result.normalizedText).toContain('PostgreSQL');
            expect(result.normalizedText).toContain('Node.js');
            expect(result.changed).toBe(true);
            expect(result.corrections.length).toBeGreaterThanOrEqual(3);
        });

        it('preserves raw and normalized terminology correction metadata', () => {
            const result = normalizeTranscript('I used by coding and text driven development');

            expect(result.rawText).toBe('I used by coding and text driven development');
            expect(result.normalizedText).toContain('vibe coding');
            expect(result.normalizedText).toContain('test-driven development');
            expect(result.corrections).toHaveLength(2);
        });

        it('should normalize MongoDB case-insensitively', () => {
            const result = normalizeTranscript('I used mongo db for storage');
            expect(result.normalizedText).toContain('MongoDB');
            expect(result.changed).toBe(true);
        });

        it('should normalize acronyms with spaces (JWT, OAuth, RAG, LLM)', () => {
            const testCases = [
                { input: 'j w t authentication', expected: 'JWT' },
                { input: 'o auth login', expected: 'OAuth' },
                { input: 'r a g system', expected: 'RAG' },
                { input: 'l l m model', expected: 'LLM' },
            ];

            testCases.forEach(({ input, expected }) => {
                const result = normalizeTranscript(input);
                expect(result.normalizedText).toContain(expected);
                expect(result.changed).toBe(true);
            });
        });

        it('should preserve original text in rawText field', () => {
            const input = '  react query   with   spaces  ';
            const result = normalizeTranscript(input);

            expect(result.rawText).toBe('react query with spaces');
            expect(result.normalizedText).toBe('React Query with spaces');
            expect(result.changed).toBe(true);
        });

        it('should set changed flag to false when no replacements occur', () => {
            const input = 'This is a normal sentence without technical terms';
            const result = normalizeTranscript(input);

            expect(result.changed).toBe(false);
            expect(result.corrections).toHaveLength(0);
            expect(result.rawText).toBe(result.normalizedText);
        });

        it('should capture all corrections in the corrections array', () => {
            const input = 'react query and post gray sql and node js';
            const result = normalizeTranscript(input);

            expect(result.corrections).toHaveLength(3);
            expect(result.corrections[0].replacement).toBe('React Query');
            expect(result.corrections[1].replacement).toBe('PostgreSQL');
            expect(result.corrections[2].replacement).toBe('Node.js');

            result.corrections.forEach((correction) => {
                expect(correction).toHaveProperty('pattern');
                expect(correction).toHaveProperty('replacement');
                expect(typeof correction.pattern).toBe('string');
                expect(typeof correction.replacement).toBe('string');
            });
        });

        it('should normalize NZ-specific terms', () => {
            const testCases = [
                { input: 'u of a graduate', expected: 'UoA' },
                { input: 'university of auckland', expected: 'University of Auckland' },
                { input: 'te treaty', expected: 'Te Tiriti' },
                { input: 'tall poppy syndrome', expected: 'Tall Poppy Syndrome' },
            ];

            testCases.forEach(({ input, expected }) => {
                const result = normalizeTranscript(input);
                expect(result.normalizedText).toContain(expected);
                expect(result.changed).toBe(true);
            });
        });

        it('should normalize STAR method', () => {
            const result = normalizeTranscript('I used the star method');
            expect(result.normalizedText).toContain('STAR method');
            expect(result.changed).toBe(true);
        });

        it('should handle text with only whitespace', () => {
            const result = normalizeTranscript('   \t\n   ');
            expect(result.rawText).toBe('');
            expect(result.normalizedText).toBe('');
            expect(result.changed).toBe(false);
        });

        it('should apply spacing collapse both before and after replacements', () => {
            const input = '  react   query   with   post   gray   sql  ';
            const result = normalizeTranscript(input);

            // Should not have multiple consecutive spaces
            expect(result.normalizedText).not.toMatch(/\s{2,}/);
            expect(result.normalizedText).toBe('React Query with PostgreSQL');
        });
    });
});

// Made with Bob
