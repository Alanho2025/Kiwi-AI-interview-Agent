import { beforeEach, describe, expect, it, vi } from 'vitest';

const { azureState, elevenLabsState } = vi.hoisted(() => ({
  azureState: {
    fail: false,
    calls: [],
  },
  elevenLabsState: {
    fail: false,
    calls: [],
  },
}));

vi.mock('../../../src/services/voice/azureSpeechService.js', () => ({
  synthesizeSpeech: vi.fn(async (options) => {
    azureState.calls.push(options);
    if (azureState.fail) throw new Error('azure unavailable');
    return {
      audioBuffer: Buffer.from('azure-audio'),
      contentType: 'audio/mpeg',
      voiceName: options.voiceName || 'en-NZ-MollyNeural',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      provider: 'azure-speech-rest',
    };
  }),
}));

vi.mock('../../../src/services/voice/elevenLabsSpeechService.js', () => ({
  synthesizeSpeech: vi.fn(async (options) => {
    elevenLabsState.calls.push(options);
    if (elevenLabsState.fail) throw new Error('elevenlabs unavailable');
    return {
      audioBuffer: Buffer.from('elevenlabs-audio'),
      contentType: 'audio/mpeg',
      voiceName: 'elevenlabs:voice-1',
      outputFormat: 'mp3_44100_128',
      provider: 'elevenlabs',
    };
  }),
  streamSynthesizeSpeech: vi.fn(async function* (options) {
    elevenLabsState.calls.push(options);
    if (elevenLabsState.fail) throw new Error('elevenlabs unavailable');
    yield {
      audioBuffer: Buffer.from('elevenlabs-audio'),
      contentType: 'audio/mpeg',
      voiceName: 'elevenlabs:voice-1',
      outputFormat: 'mp3_44100_128',
      provider: 'elevenlabs',
      chunkIndex: 0,
      isStreaming: true,
    };
  }),
}));

const { getTtsProviderOrder, synthesizeSpeech } = await import('../../../src/services/voice/ttsProviderRouter.js');

describe('TTS provider router', () => {
  beforeEach(() => {
    azureState.fail = false;
    azureState.calls = [];
    elevenLabsState.fail = false;
    elevenLabsState.calls = [];
    delete process.env.VOICE_TTS_PROVIDER;
    delete process.env.VOICE_TTS_FALLBACK_PROVIDER;
    delete process.env.VOICE_TTS_PROVIDER_ORDER;
    delete process.env.VOICE_STT_PROVIDER;
    delete process.env.VOICE_STT_FALLBACK_PROVIDER;
    delete process.env.VOICE_STT_PROVIDER_ORDER;
  });

  it('uses explicit TTS provider configuration before STT routing defaults', async () => {
    process.env.VOICE_STT_PROVIDER = 'azure';
    process.env.VOICE_TTS_PROVIDER = 'elevenlabs';
    process.env.VOICE_TTS_FALLBACK_PROVIDER = 'azure';

    const result = await synthesizeSpeech({ text: 'Hello there' });

    expect(result.provider).toBe('elevenlabs');
    expect(elevenLabsState.calls).toHaveLength(1);
    expect(azureState.calls).toHaveLength(0);
  });

  it('falls back to ElevenLabs when Azure TTS cannot synthesize', async () => {
    process.env.VOICE_TTS_PROVIDER = 'azure';
    process.env.VOICE_TTS_FALLBACK_PROVIDER = 'elevenlabs';
    azureState.fail = true;

    const result = await synthesizeSpeech({ text: 'Tell me about your project.' });

    expect(result.provider).toBe('elevenlabs');
    expect(azureState.calls).toHaveLength(1);
    expect(elevenLabsState.calls).toHaveLength(1);
  });

  it('keeps TTS routing independent from STT provider env when TTS env is unset', async () => {
    process.env.VOICE_STT_PROVIDER = 'elevenlabs';
    process.env.VOICE_STT_FALLBACK_PROVIDER = 'azure';

    expect(getTtsProviderOrder()).toEqual(['azure', 'elevenlabs']);

    const result = await synthesizeSpeech({ text: 'What was your role?' });

    expect(result.provider).toBe('azure-speech-rest');
    expect(azureState.calls).toHaveLength(1);
    expect(elevenLabsState.calls).toHaveLength(0);
  });

  it('uses ElevenLabs for TTS only when TTS env explicitly asks for it', async () => {
    process.env.VOICE_STT_PROVIDER = 'azure';
    process.env.VOICE_TTS_PROVIDER = 'elevenlabs';

    expect(getTtsProviderOrder()).toEqual(['elevenlabs']);

    const result = await synthesizeSpeech({ text: 'What was your role?' });

    expect(result.provider).toBe('elevenlabs');
    expect(elevenLabsState.calls).toHaveLength(1);
    expect(azureState.calls).toHaveLength(0);
  });

  it('normalizes provider order aliases for ElevenLabs realtime STT names', () => {
    process.env.VOICE_TTS_PROVIDER_ORDER = 'elevenlabs-realtime,azure-speech';

    expect(getTtsProviderOrder()).toEqual(['elevenlabs_realtime', 'azure_speech']);
  });
});
