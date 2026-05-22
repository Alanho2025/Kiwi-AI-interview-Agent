import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordSpeechUsageMock } = vi.hoisted(() => ({
  recordSpeechUsageMock: vi.fn(),
}));

vi.mock('../../../src/services/aiUsageTrackingService.js', () => ({
  recordSpeechUsage: recordSpeechUsageMock,
}));

const { synthesizeSpeech } = await import('../../../src/services/voice/elevenLabsSpeechService.js');
const { AI_USAGE_PROVIDERS } = await import('../../../src/db/models/aiUsageEventModel.js');

describe('ElevenLabs speech service', () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = 'test-eleven-key';
    process.env.ELEVENLABS_VOICE_ID = 'voice-123';
    process.env.ELEVENLABS_MODEL_ID = 'eleven_turbo_v2_5';
    process.env.ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';
    recordSpeechUsageMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends ElevenLabs TTS requests and records provider-specific usage', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
      arrayBuffer: async () => Buffer.from('mp3-bytes').buffer,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await synthesizeSpeech({
      text: 'Welcome to the interview.',
      usageContext: {
        userId: 'user-1',
        sessionId: 'session-1',
        stage: 'interview',
        source: 'test',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/text-to-speech/voice-123/stream');
    expect(String(url)).toContain('output_format=mp3_44100_128');
    expect(request.headers['xi-api-key']).toBe('test-eleven-key');
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({
      text: 'Welcome to the interview.',
      model_id: 'eleven_turbo_v2_5',
      voice_settings: expect.objectContaining({
        stability: expect.any(Number),
        similarity_boost: expect.any(Number),
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      provider: 'elevenlabs',
      contentType: 'audio/mpeg',
      voiceName: 'elevenlabs:voice-123',
    }));
    expect(recordSpeechUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'elevenlabs',
      operation: 'text_to_speech',
      textCharacters: 'Welcome to the interview.'.length,
    }));
  });

  it('allows ElevenLabs usage events through the model provider enum', () => {
    expect(AI_USAGE_PROVIDERS).toContain('elevenlabs');
  });
});
