import { beforeEach, describe, expect, it, vi } from 'vitest';

const { azureState, elevenLabsState } = vi.hoisted(() => ({
  azureState: { shouldFail: false },
  elevenLabsState: { shouldFail: false },
}));

vi.mock('../../../src/services/voice/azureSpeechService.js', () => ({
  synthesizeSpeech: vi.fn(async () => {
    if (azureState.shouldFail) {
      const err = new Error('Azure Speech 500 Internal Error');
      err.statusCode = 500;
      throw err;
    }
    return { audioBuffer: Buffer.from('azure-audio'), provider: 'azure' };
  }),
}));

vi.mock('../../../src/services/voice/elevenLabsSpeechService.js', () => ({
  synthesizeSpeech: vi.fn(async () => {
    if (elevenLabsState.shouldFail) {
      const err = new Error('ElevenLabs 500 Internal Error');
      err.statusCode = 500;
      throw err;
    }
    return { audioBuffer: Buffer.from('elevenlabs-audio'), provider: 'elevenlabs' };
  }),
  streamSynthesizeSpeech: vi.fn(),
}));

const { getTtsProviderOrder, synthesizeSpeech } = await import('../../../src/services/voice/ttsProviderRouter.js');
const { createRoutedRealtimeSpeechSession } = await import('../../../src/services/voice/realtimeSpeechProviderRouter.js');

describe('4. providerRouterFailover: STT / TTS Provider Failover & Degraded Path', () => {
  beforeEach(() => {
    azureState.shouldFail = false;
    elevenLabsState.shouldFail = false;
    delete process.env.VOICE_STT_PROVIDER;
    delete process.env.VOICE_STT_FALLBACK_PROVIDER;
    delete process.env.VOICE_STT_PROVIDER_ORDER;
    delete process.env.VOICE_TTS_PROVIDER;
    delete process.env.VOICE_TTS_FALLBACK_PROVIDER;
    delete process.env.VOICE_TTS_PROVIDER_ORDER;
  });

  it('correctly configures primary and fallback TTS provider order', () => {
    process.env.VOICE_TTS_PROVIDER = 'azure';
    process.env.VOICE_TTS_FALLBACK_PROVIDER = 'elevenlabs';

    const order = getTtsProviderOrder();
    expect(order).toEqual(['azure', 'elevenlabs']);
  });

  it('falls back to secondary TTS provider when primary provider throws a 500 error during synthesis', async () => {
    process.env.VOICE_TTS_PROVIDER = 'azure';
    process.env.VOICE_TTS_FALLBACK_PROVIDER = 'elevenlabs';
    azureState.shouldFail = true;

    const result = await synthesizeSpeech({ text: 'Hello candidate' });

    expect(result.provider).toBe('elevenlabs');
    expect(result.audioBuffer.toString()).toBe('elevenlabs-audio');
  });

  it('throws structured AppError when all configured TTS providers fail', async () => {
    process.env.VOICE_TTS_PROVIDER = 'azure';
    process.env.VOICE_TTS_FALLBACK_PROVIDER = 'elevenlabs';
    azureState.shouldFail = true;
    elevenLabsState.shouldFail = true;

    await expect(synthesizeSpeech({ text: 'Hello candidate' })).rejects.toThrow(
      /No TTS provider could synthesize speech/
    );
  });

  it('throws structured error when no STT provider can be initialized', () => {
    process.env.VOICE_STT_PROVIDER_ORDER = 'invalid_speech_provider';

    expect(() => createRoutedRealtimeSpeechSession()).toThrow(
      /No realtime STT provider could be created/
    );
  });
});
