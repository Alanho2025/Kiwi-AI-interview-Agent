/**
 * Unit tests for speechConfidenceGate.js
 * Tests all confidence assessment logic, rejection reasons, and acceptance criteria
 */

import { describe, expect, it } from 'vitest';
import {
    getConfidenceStatus,
    buildConfidenceGate,
    assessRealtimeVoiceTranscript,
    validateRealtimeVoiceTranscript,
} from '../../src/services/voice/speechConfidenceGate.js';

describe('speechConfidenceGate', () => {
    describe('getConfidenceStatus', () => {
        it('returns "high" for confidence >= 0.75', () => {
            expect(getConfidenceStatus(0.75)).toBe('high');
            expect(getConfidenceStatus(0.85)).toBe('high');
            expect(getConfidenceStatus(0.95)).toBe('high');
            expect(getConfidenceStatus(1.0)).toBe('high');
        });

        it('returns "medium" for confidence >= 0.45 and < 0.75', () => {
            expect(getConfidenceStatus(0.45)).toBe('medium');
            expect(getConfidenceStatus(0.60)).toBe('medium');
            expect(getConfidenceStatus(0.74)).toBe('medium');
        });

        it('returns "low" for confidence < 0.45', () => {
            expect(getConfidenceStatus(0.0)).toBe('low');
            expect(getConfidenceStatus(0.20)).toBe('low');
            expect(getConfidenceStatus(0.44)).toBe('low');
        });

        it('returns "unknown" for non-number or NaN confidence', () => {
            expect(getConfidenceStatus(null)).toBe('unknown');
            expect(getConfidenceStatus(undefined)).toBe('unknown');
            expect(getConfidenceStatus(NaN)).toBe('unknown');
            expect(getConfidenceStatus('0.5')).toBe('unknown');
        });

        it('respects custom thresholds', () => {
            const customThresholds = { high: 0.85, medium: 0.70 };
            expect(getConfidenceStatus(0.80, customThresholds)).toBe('medium');
            expect(getConfidenceStatus(0.85, customThresholds)).toBe('high');
            expect(getConfidenceStatus(0.65, customThresholds)).toBe('low');
        });
    });

    describe('buildConfidenceGate', () => {
        it('builds gate for high confidence', () => {
            const gate = buildConfidenceGate(0.85);
            expect(gate).toEqual({
                status: 'high',
                shouldConfirm: false,
                shouldRecordAgain: false,
            });
        });

        it('builds gate for medium confidence', () => {
            const gate = buildConfidenceGate(0.60);
            expect(gate).toEqual({
                status: 'medium',
                shouldConfirm: true,
                shouldRecordAgain: false,
            });
        });

        it('builds gate for low confidence', () => {
            const gate = buildConfidenceGate(0.30);
            expect(gate).toEqual({
                status: 'low',
                shouldConfirm: true,
                shouldRecordAgain: true,
            });
        });

        it('builds gate for unknown confidence', () => {
            const gate = buildConfidenceGate(null);
            expect(gate).toEqual({
                status: 'unknown',
                shouldConfirm: true,
                shouldRecordAgain: false,
            });
        });
    });

    describe('assessRealtimeVoiceTranscript - rejection cases', () => {
        it('rejects empty transcript', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: '',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'EMPTY_TRANSCRIPT',
                message: 'I did not catch your answer. Please try again.',
            });
        });

        it('rejects whitespace-only transcript', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: '   ',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'EMPTY_TRANSCRIPT',
            });
        });

        it('rejects non-final VAD transcript (isFinal: false)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: false },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'NON_FINAL_VAD_TRANSCRIPT',
                message: 'Your answer still sounds incomplete. Please finish your answer before moving on.',
            });
        });

        it('rejects non-final VAD transcript (final: false)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, final: false },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'NON_FINAL_VAD_TRANSCRIPT',
            });
        });

        it('rejects transcript with zero STT segments', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 0, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'NO_FINAL_STT_SEGMENTS',
                message: 'I did not catch your answer clearly. Please try again.',
            });
        });

        it('rejects transcript that is too short (< 2 words)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'React',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'TOO_SHORT_TRANSCRIPT',
                message: 'I only caught a very short answer. Please say a little more before I move to the next question.',
            });
        });

        it('rejects transcript that is too short (< 8 characters)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'Yes no',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'TOO_SHORT_TRANSCRIPT',
            });
        });

        it('rejects transcript with speech duration too short (< 900ms)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React and Node.js',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 800, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'SPEECH_TOO_SHORT',
                message: 'I only heard a brief sound. Please give your full answer before I move on.',
            });
        });

        it('rejects filler transcripts - "ok" (caught by TOO_SHORT first)', () => {
            // Note: "ok" has only 2 characters (< 8), so it's caught by TOO_SHORT check
            // before the filler check, which is the actual implementation behavior
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'ok',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'TOO_SHORT_TRANSCRIPT',
                message: 'I only caught a very short answer. Please say a little more before I move to the next question.',
            });
        });

        it('rejects filler transcripts - "yeah" (caught by TOO_SHORT first)', () => {
            // Note: "Yeah" has only 4 characters (< 8), so it's caught by TOO_SHORT check
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'Yeah',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'TOO_SHORT_TRANSCRIPT',
            });
        });

        it('rejects filler transcripts - "um" (caught by TOO_SHORT first)', () => {
            // Note: "Um..." has only 5 characters (< 8), so it's caught by TOO_SHORT check
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'Um...',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'TOO_SHORT_TRANSCRIPT',
            });
        });

        it('rejects filler transcripts - "thank you"', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'Thank you!',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'FILLER_TRANSCRIPT',
            });
        });

        it('rejects low confidence short transcript', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React',
                asrConfidence: 0.30,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'LOW_CONFIDENCE_TRANSCRIPT',
                message: 'Voice recognition was not confident it heard that correctly. Please repeat your answer from the start.',
            });
        });

        it('rejects medium confidence with insufficient words (< 6 words)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'React and Node',
                asrConfidence: 0.60,
                vad: { speechDurationMs: 3000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'MEDIUM_CONFIDENCE_INSUFFICIENT_EVIDENCE',
                message: 'I only caught part of that. Please repeat your answer with a bit more detail.',
            });
        });

        it('rejects medium confidence with insufficient speech duration (< 2500ms)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React and Node.js for the project',
                asrConfidence: 0.60,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'MEDIUM_CONFIDENCE_INSUFFICIENT_EVIDENCE',
            });
        });

        it('rejects unknown confidence with insufficient words (< 8 words)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'React Node PostgreSQL',
                asrConfidence: null,
                vad: { speechDurationMs: 4000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'UNKNOWN_CONFIDENCE_INSUFFICIENT_EVIDENCE',
                message: 'I need to hear that more clearly before I can continue. Please repeat your answer.',
            });
        });

        it('rejects unknown confidence with insufficient speech duration (< 3500ms)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React Node PostgreSQL and Express for the backend',
                asrConfidence: null,
                vad: { speechDurationMs: 3000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'UNKNOWN_CONFIDENCE_INSUFFICIENT_EVIDENCE',
            });
        });
    });

    describe('assessRealtimeVoiceTranscript - acceptance cases', () => {
        it('accepts high confidence transcript with sufficient content', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend and Node.js for the backend',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 3000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: true,
                decision: 'accept',
                reason: 'VALID_TRANSCRIPT',
                message: null,
            });
            expect(result.confidenceGate.status).toBe('high');
        });

        it('accepts medium confidence with sufficient evidence', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend and Node.js for the backend API',
                asrConfidence: 0.60,
                vad: { speechDurationMs: 3000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: true,
                decision: 'accept',
                reason: 'VALID_TRANSCRIPT',
            });
            expect(result.confidenceGate.status).toBe('medium');
        });

        it('accepts unknown confidence with sufficient evidence', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend and Node.js for the backend API',
                asrConfidence: null,
                vad: { speechDurationMs: 4000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: true,
                decision: 'accept',
                reason: 'VALID_TRANSCRIPT',
            });
            expect(result.confidenceGate.status).toBe('unknown');
        });

        it('includes metrics in acceptance result', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React and Node.js',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2500, sttSegmentCount: 2, isFinal: true },
            });

            expect(result.metrics).toEqual({
                words: 5,
                characters: 24,
                speechDurationMs: 2500,
                sttSegmentCount: 2,
            });
        });
    });

    describe('assessRealtimeVoiceTranscript - low confidence contentful case', () => {
        it('requests understanding confirmation for contentful low-confidence transcript', () => {
            const longAnswer = 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.';

            const result = assessRealtimeVoiceTranscript({
                transcriptText: longAnswer,
                asrConfidence: 0.24,
                vad: { speechDurationMs: 42000, sttSegmentCount: 3, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'confirm_understanding',
                reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
                message: null,
                requiresUnderstandingConfirmation: true,
                shouldProcessAnswer: false,
                countsAsQuestion: false,
                transcriptQuality: 'low_confidence_but_contentful',
            });
            expect(result.confidenceGate.shouldConfirm).toBe(true);
            expect(result.confidenceGate.shouldRecordAgain).toBe(false);
        });

        it('rejects low confidence if not contentful enough (< 25 words)', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React and Node.js for the project with PostgreSQL database',
                asrConfidence: 0.24,
                vad: { speechDurationMs: 42000, sttSegmentCount: 3, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'LOW_CONFIDENCE_TRANSCRIPT',
            });
        });

        it('rejects low confidence if not contentful enough (< 120 characters)', () => {
            const shortText = 'React Node PostgreSQL Express MongoDB Redis Docker Kubernetes AWS Lambda API Gateway DynamoDB S3 CloudFront Route53 EC2 RDS';

            const result = assessRealtimeVoiceTranscript({
                transcriptText: shortText,
                asrConfidence: 0.24,
                vad: { speechDurationMs: 42000, sttSegmentCount: 3, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'LOW_CONFIDENCE_TRANSCRIPT',
            });
        });

        it('rejects low confidence if speech duration too short (< 8000ms)', () => {
            const longAnswer = 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.';

            const result = assessRealtimeVoiceTranscript({
                transcriptText: longAnswer,
                asrConfidence: 0.24,
                vad: { speechDurationMs: 7000, sttSegmentCount: 3, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'LOW_CONFIDENCE_TRANSCRIPT',
            });
        });

        it('rejects low confidence if no STT segments', () => {
            const longAnswer = 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.';

            const result = assessRealtimeVoiceTranscript({
                transcriptText: longAnswer,
                asrConfidence: 0.24,
                vad: { speechDurationMs: 42000, sttSegmentCount: 0, isFinal: true },
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'NO_FINAL_STT_SEGMENTS',
            });
        });
    });

    describe('assessRealtimeVoiceTranscript - custom rules', () => {
        it('respects custom minWords rule', () => {
            const customRules = { minWords: 5, minCharacters: 8, minAcceptedSpeechMs: 900 };

            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'React Node PostgreSQL',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
                rules: customRules,
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'TOO_SHORT_TRANSCRIPT',
            });
        });

        it('respects custom minCharacters rule', () => {
            const customRules = { minWords: 2, minCharacters: 50, minAcceptedSpeechMs: 900 };

            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'React and Node',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
                rules: customRules,
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'TOO_SHORT_TRANSCRIPT',
            });
        });

        it('respects custom minAcceptedSpeechMs rule', () => {
            const customRules = { minWords: 2, minCharacters: 8, minAcceptedSpeechMs: 3000 };

            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React and Node.js',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2500, sttSegmentCount: 1, isFinal: true },
                rules: customRules,
            });

            expect(result).toMatchObject({
                ok: false,
                decision: 'reject',
                reason: 'SPEECH_TOO_SHORT',
            });
        });
    });

    describe('assessRealtimeVoiceTranscript - edge cases', () => {
        it('handles missing VAD gracefully', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: null,
            });

            expect(result.ok).toBe(true);
            expect(result.metrics.speechDurationMs).toBe(0);
            expect(result.metrics.sttSegmentCount).toBe(null);
        });

        it('handles VAD with missing fields', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: {},
            });

            expect(result.ok).toBe(true);
            expect(result.metrics.speechDurationMs).toBe(0);
            expect(result.metrics.sttSegmentCount).toBe(null);
        });

        it('handles negative speech duration', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: { speechDurationMs: -1000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result.metrics.speechDurationMs).toBe(0);
        });

        it('handles non-finite speech duration', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: { speechDurationMs: Infinity, sttSegmentCount: 1, isFinal: true },
            });

            expect(result.metrics.speechDurationMs).toBe(0);
        });

        it('trims whitespace from transcript', () => {
            const result = assessRealtimeVoiceTranscript({
                transcriptText: '  I used React for the frontend  ',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            });

            expect(result.ok).toBe(true);
            expect(result.metrics.characters).toBe(29); // "I used React for the frontend" after trim
        });
    });

    describe('validateRealtimeVoiceTranscript', () => {
        it('is an alias for assessRealtimeVoiceTranscript', () => {
            const params = {
                transcriptText: 'I used React for the frontend',
                asrConfidence: 0.85,
                vad: { speechDurationMs: 2000, sttSegmentCount: 1, isFinal: true },
            };

            const result1 = assessRealtimeVoiceTranscript(params);
            const result2 = validateRealtimeVoiceTranscript(params);

            expect(result1).toEqual(result2);
        });
    });
});

// Made with Bob
