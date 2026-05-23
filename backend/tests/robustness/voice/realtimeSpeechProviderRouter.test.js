import { beforeEach, describe, expect, it, vi } from 'vitest';

const { azureState, elevenLabsState } = vi.hoisted(() => ({
  azureState: {
    createFail: false,
    startFail: false,
    sessions: [],
  },
  elevenLabsState: {
    createFail: false,
    startFail: false,
    sessions: [],
  },
}));

const buildSession = (providerName, state) => {
  if (state.createFail) throw new Error(`${providerName} create failed`);
  const session = {
    providerName,
    start: vi.fn(async () => {
      if (state.startFail) throw new Error(`${providerName} start failed`);
    }),
    writeAudio: vi.fn(),
    stop: vi.fn(async () => undefined),
  };
  state.sessions.push(session);
  return session;
};

vi.mock('../../../src/services/voice/realtimeSpeechSessionService.js', () => ({
  createRealtimeSpeechSession: vi.fn(() => buildSession('azure', azureState)),
}));

vi.mock('../../../src/services/voice/elevenLabsRealtimeSpeechSessionService.js', () => ({
  createElevenLabsRealtimeSpeechSession: vi.fn(() => buildSession('elevenlabs_realtime', elevenLabsState)),
}));

const { createRoutedRealtimeSpeechSession } = await import('../../../src/services/voice/realtimeSpeechProviderRouter.js');

describe('realtime STT provider router', () => {
  beforeEach(() => {
    azureState.createFail = false;
    azureState.startFail = false;
    azureState.sessions = [];
    elevenLabsState.createFail = false;
    elevenLabsState.startFail = false;
    elevenLabsState.sessions = [];
    delete process.env.VOICE_STT_PROVIDER;
    delete process.env.VOICE_STT_FALLBACK_PROVIDER;
    delete process.env.VOICE_STT_PROVIDER_ORDER;
  });

  it('selects the configured primary STT provider', async () => {
    const events = [];
    process.env.VOICE_STT_PROVIDER = 'elevenlabs';
    process.env.VOICE_STT_FALLBACK_PROVIDER = 'azure';

    const session = createRoutedRealtimeSpeechSession({
      onSessionStarted: (payload) => events.push(payload),
    });
    await session.start();

    expect(session.providerName).toBe('elevenlabs');
    expect(elevenLabsState.sessions).toHaveLength(1);
    expect(azureState.sessions).toHaveLength(0);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'speech_provider_selected',
      provider: 'elevenlabs',
      fallbackFrom: null,
    }));
  });

  it('falls back when the primary STT provider cannot be created', async () => {
    const events = [];
    process.env.VOICE_STT_PROVIDER = 'azure';
    process.env.VOICE_STT_FALLBACK_PROVIDER = 'elevenlabs';
    azureState.createFail = true;

    const session = createRoutedRealtimeSpeechSession({
      onSessionStarted: (payload) => events.push(payload),
    });
    await session.start();

    expect(session.providerName).toBe('elevenlabs');
    expect(azureState.sessions).toHaveLength(0);
    expect(elevenLabsState.sessions).toHaveLength(1);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'speech_provider_selected',
      provider: 'elevenlabs',
      fallbackFrom: 'azure',
    }));
  });

  it('falls back when the selected STT provider fails during start', async () => {
    const events = [];
    const errors = [];
    process.env.VOICE_STT_PROVIDER_ORDER = 'azure,elevenlabs';
    azureState.startFail = true;

    const session = createRoutedRealtimeSpeechSession({
      onError: (payload) => errors.push(payload),
      onSessionStarted: (payload) => events.push(payload),
    });
    await session.start();

    expect(session.providerName).toBe('elevenlabs');
    expect(azureState.sessions[0].start).toHaveBeenCalledTimes(1);
    expect(elevenLabsState.sessions[0].start).toHaveBeenCalledTimes(1);
    expect(errors).toContainEqual(expect.objectContaining({
      type: 'speech_error',
      reason: 'provider_start_failed_fallback_attempted',
      provider: 'azure',
      errorDetails: 'azure start failed',
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: 'speech_provider_selected',
      provider: 'elevenlabs',
      fallbackFrom: 'azure',
    }));
  });

  it('normalizes provider order aliases and forwards audio to the active session', async () => {
    const audio = Buffer.from('pcm');
    process.env.VOICE_STT_PROVIDER_ORDER = 'elevenlabs-realtime,azure-speech';

    const session = createRoutedRealtimeSpeechSession();
    await session.start();
    session.writeAudio(audio);
    await session.stop();

    expect(session.providerName).toBe('elevenlabs_realtime');
    expect(elevenLabsState.sessions[0].writeAudio).toHaveBeenCalledWith(audio);
    expect(elevenLabsState.sessions[0].stop).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when no configured STT provider is supported', () => {
    process.env.VOICE_STT_PROVIDER_ORDER = 'unknown-provider';

    expect(() => createRoutedRealtimeSpeechSession()).toThrow(/No realtime STT provider could be created/);
  });
});
