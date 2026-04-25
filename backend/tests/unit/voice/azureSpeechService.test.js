import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  delete process.env.AZURE_SPEECH_KEY;
  delete process.env.AZURE_SPEECH_REGION;
});

describe('azureSpeechService', () => {
  it('fails clearly when Azure Speech is not configured', async () => {
    const { synthesizeSpeech } = await import('../../../src/services/voice/azureSpeechService.js');

    await expect(synthesizeSpeech({ text: 'hello' })).rejects.toMatchObject({
      code: 'VOICE_PROVIDER_NOT_CONFIGURED',
      statusCode: 500,
    });
  });

  it('rejects empty audio before calling the provider', async () => {
    process.env.AZURE_SPEECH_KEY = 'key';
    process.env.AZURE_SPEECH_REGION = 'australiaeast';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeShortAudio } = await import('../../../src/services/voice/azureSpeechService.js');

    await expect(transcribeShortAudio({
      buffer: Buffer.alloc(0),
      mimetype: 'audio/wav',
      originalname: 'empty.wav',
    })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns assistant audio metadata when TTS succeeds', async () => {
    process.env.AZURE_SPEECH_KEY = 'key';
    process.env.AZURE_SPEECH_REGION = 'australiaeast';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'token-1' })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Buffer.from('audio-bytes') }));

    const { synthesizeSpeech } = await import('../../../src/services/voice/azureSpeechService.js');
    const result = await synthesizeSpeech({ text: 'Next question?', voiceName: 'en-NZ-MollyNeural' });

    expect(result).toEqual(expect.objectContaining({
      provider: 'azure-speech-rest',
      contentType: 'audio/mpeg',
      voiceName: 'en-NZ-MollyNeural',
    }));
    expect(Buffer.from(result.audioBuffer).toString()).toBe('audio-bytes');
  });
});
