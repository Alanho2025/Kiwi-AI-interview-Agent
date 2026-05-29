import { describe, expect, it, vi } from 'vitest';

const processRealtimeVoiceTurnMock = vi.fn();

vi.mock('../../../src/services/voice/realtimeVoiceTurnService.js', () => ({
    processRealtimeVoiceTurn: processRealtimeVoiceTurnMock,
}));

vi.mock('../../../src/services/voice/ttsStreamQueue.js', () => ({
    streamAssistantSpeech: vi.fn(async () => { }),
}));

vi.mock('../../../src/services/voice/speechConfidenceGate.js', () => ({
    assessRealtimeVoiceTranscript: vi.fn(() => ({
        ok: true,
        decision: 'accept',
        reason: 'ACCEPTED',
        message: null,
        confidenceGate: null,
        metrics: null,
    })),
}));

vi.mock('../../../src/services/voice/voiceTurnWarmContextService.js', () => ({
    default: {
        prepareWarmContext: vi.fn(async () => { }),
    },
}));

vi.mock('../../../src/services/voice/transcriptUnderstandingSummary.js', () => ({
    buildTranscriptConfirmationPrompt: vi.fn((text) => `Did I understand this correctly: ${text}`),
}));

vi.mock('../../../src/services/voice/voiceAcknowledgementService.js', () => ({
    generateVoiceMicroAcknowledgement: vi.fn(async () => ''),
}));

describe('duplexTurnCoordinator transcript confirmation flow', () => {
    const createBaseOptions = ({ pendingConfirmation }) => {
        const sentMessages = [];
        let pending = pendingConfirmation;

        return {
            options: {
                session: {
                    id: 'session-1',
                    status: 'in_progress',
                    currentQuestionIndex: 1,
                    transcript: [],
                    interviewPlan: {
                        questionPool: [],
                        questions: [],
                    },
                },
                userId: 'user-1',
                voiceName: 'en-NZ-MollyNeural',
                language: 'en-NZ',
                asrSource: 'azure',
                clientTurnId: 'voice-turn-1-3',
                sendJson: (payload) => sentMessages.push(payload),
                bargeInController: {
                    startAssistantSpeech: vi.fn(() => 'speech-token-1'),
                    finishAssistantSpeech: vi.fn(),
                    isTokenActive: vi.fn(() => true),
                },
                logger: {
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                },
                getPendingTranscriptConfirmation: () => pending,
                setPendingTranscriptConfirmation: (nextPending) => {
                    pending = nextPending;
                },
            },
            sentMessages,
            getPending: () => pending,
        };
    };

    it('merges yes-plus-clarification text before sending the answer to the realtime planner', async () => {
        vi.useFakeTimers();

        processRealtimeVoiceTurnMock.mockResolvedValueOnce({
            updatedSession: {
                id: 'session-1',
                status: 'in_progress',
                transcript: [],
                interviewPlan: {
                    questionPool: [],
                    questions: [],
                },
            },
            transcription: {
                text: 'merged transcript',
            },
            latency: {
                total: 1,
            },
            agentResult: {
                isComplete: false,
            },
        });

        const pendingConfirmation = {
            id: 'pending-1',
            originalTranscript:
                'The outcome is that generated data does not reflect the real situation.',
            asrConfidence: 0.44,
            vad: {
                speechDurationMs: 42349,
                sttSegmentCount: 3,
            },
            assessment: {
                reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
            },
        };

        const { options, sentMessages, getPending } = createBaseOptions({ pendingConfirmation });

        const { createDuplexTurnCoordinator } = await import(
            '../../../src/services/voice/duplexTurnCoordinator.js'
        );

        const coordinator = createDuplexTurnCoordinator(options);

        const resultPromise = coordinator.processFinalTranscript({
            transcriptText:
                'Yes, I think you are correct. I think the AI generated data will not be used in the real situation.',
            asrConfidence: 0.56,
            vad: {
                speechDurationMs: 24696,
            },
        });

        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toBeTruthy();
        expect(getPending()).toBe(null);

        expect(processRealtimeVoiceTurnMock).toHaveBeenCalledTimes(1);

        const callArg = processRealtimeVoiceTurnMock.mock.calls[0][0];

        expect(callArg.skipTranscriptGate).toBe(true);
        expect(callArg.transcriptText).toContain(
            'The outcome is that generated data does not reflect the real situation.',
        );
        expect(callArg.transcriptText).toContain(
            'User clarification after confirming transcript:',
        );
        expect(callArg.transcriptText).toContain(
            'AI generated data will not be used in the real situation',
        );

        expect(callArg.transcriptConfirmation.confirmedByUser).toBe(true);
        expect(callArg.transcriptConfirmation.confirmationDecision).toBe(
            'confirm_with_clarification',
        );
        expect(callArg.transcriptConfirmation.usedClarification).toBe(true);

        expect(sentMessages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'transcript_confirmation_resolved',
                    decision: 'confirm_with_clarification',
                    countsAsQuestion: false,
                }),
                expect.objectContaining({
                    type: 'turn_done',
                }),
            ]),
        );

        vi.useRealTimers();
    });

    it('uses contentful clarification as the corrected answer instead of asking for yes or no again', async () => {
        vi.useFakeTimers();

        processRealtimeVoiceTurnMock.mockResolvedValueOnce({
            updatedSession: {
                id: 'session-1',
                status: 'in_progress',
                transcript: [],
                interviewPlan: {
                    questionPool: [],
                    questions: [],
                },
            },
            transcription: {
                text: 'merged transcript',
            },
            latency: {
                total: 1,
            },
            agentResult: {
                isComplete: false,
            },
        });

        const pendingConfirmation = {
            id: 'pending-2',
            originalTranscript:
                'The outcome is that generated data does not reflect the real situation.',
            asrConfidence: 0.44,
            vad: {
                speechDurationMs: 42349,
                sttSegmentCount: 3,
            },
            assessment: {
                reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
            },
        };

        const { options, sentMessages, getPending } = createBaseOptions({ pendingConfirmation });

        const { createDuplexTurnCoordinator } = await import(
            '../../../src/services/voice/duplexTurnCoordinator.js'
        );

        const coordinator = createDuplexTurnCoordinator(options);

        const resultPromise = coordinator.processFinalTranscript({
            transcriptText:
                'The main point is that real data reflects real users better than generated data.',
            asrConfidence: 0.62,
            vad: {
                speechDurationMs: 9000,
            },
        });

        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toBeTruthy();
        expect(getPending()).toBe(null);

        expect(processRealtimeVoiceTurnMock).toHaveBeenCalledTimes(1);

        const callArg = processRealtimeVoiceTurnMock.mock.calls[0][0];

        expect(callArg.transcriptText).toContain(
            'User clarification after transcript check:',
        );
        expect(callArg.transcriptText).toContain(
            'real data reflects real users better than generated data',
        );

        expect(callArg.transcriptConfirmation.confirmationDecision).toBe('clarification');
        expect(callArg.transcriptConfirmation.usedClarification).toBe(true);

        expect(sentMessages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'transcript_confirmation_resolved',
                    decision: 'clarification',
                    countsAsQuestion: false,
                }),
            ]),
        );

        vi.useRealTimers();
    });
});