import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('external service failure fallbacks', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('falls back to a valid interview plan when DeepSeek times out', async () => {
    vi.doMock('../../../src/services/deepseekService.js', () => ({
      callDeepSeek: vi.fn(async () => {
        throw new Error('DeepSeek timeout');
      }),
    }));

    const { generatePlan } = await import('../../../src/services/interviewPlanService.js');
    const plan = await generatePlan('CV text', 'JD text', { seniorityLevel: 'Junior', focusArea: 'Combined' }, {
      candidateName: 'Ellen',
      jobTitle: 'Software Engineer',
      matchScore: 50,
      confidence: 0.6,
      decision: { label: 'manual_review' },
      explanation: {},
      requirementChecks: [],
      interviewFocus: ['JavaScript'],
    });

    expect(plan.candidateName).toBe('Ellen');
    expect(plan.jobTitle).toBe('Software Engineer');
    expect(plan.questionPool).toEqual([]);
    expect(plan.fallbackRules.short_answer).toBe('ask_probe');
  });

  it('falls back to a valid interview plan when DeepSeek returns malformed JSON', async () => {
    vi.doMock('../../../src/services/deepseekService.js', () => ({
      callDeepSeek: vi.fn(async () => 'not json at all'),
    }));

    const { generatePlan } = await import('../../../src/services/interviewPlanService.js');
    const plan = await generatePlan('CV text', 'JD text', { seniorityLevel: 'Junior', focusArea: 'Combined' }, {
      candidateName: 'Ellen',
      jobTitle: 'Software Engineer',
      matchScore: 50,
      confidence: 0.6,
      decision: { label: 'manual_review' },
      explanation: {},
      requirementChecks: [],
    });

    expect(plan.jobTitle).toBe('Software Engineer');
    expect(plan.planPreview).toMatch(/balanced interview/i);
  });

  it('rejects an empty STT transcript with a controlled validation error', async () => {
    vi.doMock('../../../src/services/sessionService.js', () => ({
      appendTranscriptTurn: vi.fn(),
      updateLatestTranscriptTurnMetadata: vi.fn(),
      updateSession: vi.fn(),
    }));
    vi.doMock('../../../src/services/masterAiService.js', () => ({
      runTask: vi.fn(),
    }));
    vi.doMock('../../../src/services/storageService.js', () => ({
      saveBufferToLocalStorage: vi.fn(async () => ({ storageKey: 'voice-input/x.wav' })),
    }));
    vi.doMock('../../../src/services/voice/azureSpeechService.js', () => ({
      transcribeShortAudio: vi.fn(async () => ({ text: '', provider: 'azure', language: 'en-NZ', confidence: 0.1 })),
      synthesizeSpeech: vi.fn(),
    }));
    vi.doMock('../../../src/services/session/sessionQuestionService.js', () => ({
      getLatestQuestionForSession: vi.fn(async () => ({ id: 'q1' })),
    }));
    vi.doMock('../../../src/services/interview/interviewSessionService.js', () => ({
      saveInterviewAnswerWithDetails: vi.fn(),
    }));

    const { processVoiceReply } = await import('../../../src/services/voice/voiceOrchestrationService.js');

    await expect(processVoiceReply({
      req: {},
      session: { id: 's1' },
      userId: 'u1',
      file: { buffer: Buffer.from('audio'), originalname: 'a.wav', mimetype: 'audio/wav' },
      language: 'en-NZ',
      tryGenerateReportForCompletedSession: vi.fn(),
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Speech could not be transcribed',
    });
  });

  it('returns text-only voice response when TTS fails after a valid transcript', async () => {
    const updateLatestTranscriptTurnMetadata = vi.fn();
    vi.doMock('../../../src/services/sessionService.js', () => ({
      appendTranscriptTurn: vi.fn(),
      updateLatestTranscriptTurnMetadata,
      updateSession: vi.fn(async () => ({
        id: 's1',
        transcript: [{ role: 'ai', text: 'Next question?', questionId: 'q2' }],
      })),
    }));
    vi.doMock('../../../src/services/masterAiService.js', () => ({
      runTask: vi.fn(async () => ({
        isComplete: false,
        nextQuestionOrder: 2,
        nextQuestion: 'Next question?',
        displayText: 'Next question?',
        interviewerTurn: { displayText: 'Next question?' },
      })),
    }));
    vi.doMock('../../../src/services/storageService.js', () => ({
      saveBufferToLocalStorage: vi.fn(async () => ({ storageKey: 'voice-input/x.wav' })),
    }));
    vi.doMock('../../../src/services/voice/azureSpeechService.js', () => ({
      transcribeShortAudio: vi.fn(async () => ({ text: 'My answer', provider: 'azure', language: 'en-NZ', confidence: 0.9, raw: {} })),
      synthesizeSpeech: vi.fn(async () => {
        throw new Error('TTS down');
      }),
    }));
    vi.doMock('../../../src/services/session/sessionQuestionService.js', () => ({
      getLatestQuestionForSession: vi.fn(async () => ({ id: 'q1' })),
    }));
    vi.doMock('../../../src/services/interview/interviewSessionService.js', () => ({
      saveInterviewAnswerWithDetails: vi.fn(),
    }));

    const { processVoiceReply } = await import('../../../src/services/voice/voiceOrchestrationService.js');
    const result = await processVoiceReply({
      req: {},
      session: { id: 's1' },
      userId: 'u1',
      file: { buffer: Buffer.from('audio'), originalname: 'a.wav', mimetype: 'audio/wav' },
      language: 'en-NZ',
      tryGenerateReportForCompletedSession: vi.fn(),
    });

    expect(result.assistantAudio).toBeNull();
    expect(result.agentResult.nextQuestion).toBe('Next question?');
    expect(updateLatestTranscriptTurnMetadata).toHaveBeenCalledWith('s1', 'ai', {
      voice: {
        synthesisFailed: true,
        reason: 'TTS down',
      },
    });
  });
});
