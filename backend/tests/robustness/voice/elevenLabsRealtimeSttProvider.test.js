import { beforeEach, describe, expect, it, vi } from 'vitest';

const { socketState } = vi.hoisted(() => ({
  socketState: {
    instances: [],
    emitCommittedOnVadAudio: true,
    emitCommittedOnManualCommit: true,
    emitCloseOnClose: false,
  },
}));

vi.mock('ws', () => {
  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;

    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.readyState = MockWebSocket.OPEN;
      this.sent = [];
      this.closed = false;
      this.terminated = false;
      this.handlers = new Map();
      socketState.instances.push(this);
      queueMicrotask(() => this.emit('open'));
    }

    on(event, handler) {
      this.handlers.set(event, [...(this.handlers.get(event) || []), { handler, once: false }]);
      return this;
    }

    once(event, handler) {
      this.handlers.set(event, [...(this.handlers.get(event) || []), { handler, once: true }]);
      return this;
    }

    off(event, handler) {
      this.handlers.set(event, (this.handlers.get(event) || []).filter((entry) => entry.handler !== handler));
      return this;
    }

    emit(event, ...args) {
      const entries = this.handlers.get(event) || [];
      for (const entry of entries) entry.handler(...args);
      this.handlers.set(event, entries.filter((entry) => !entry.once));
      return entries.length > 0;
    }

    send(payload) {
      this.sent.push(payload);
      const parsed = JSON.parse(payload);
      if (
        (parsed.commit && socketState.emitCommittedOnManualCommit) ||
        (!parsed.commit && socketState.emitCommittedOnVadAudio)
      ) {
        socketState.emitCommittedOnVadAudio = false;
        queueMicrotask(() => this.emit('message', Buffer.from(JSON.stringify({
          message_type: 'committed_transcript',
          text: 'I improved the support workflow.',
        }))));
      }
    }

    close() {
      this.closed = true;
      if (socketState.emitCloseOnClose) {
        this.readyState = MockWebSocket.CLOSED;
        queueMicrotask(() => this.emit('close', 1000, Buffer.from('closed')));
      }
    }

    terminate() {
      this.terminated = true;
      this.readyState = MockWebSocket.CLOSED;
    }
  }

  return { default: MockWebSocket };
});

const { createElevenLabsRealtimeSttProvider } = await import('../../../benchmarks/voice-asr-fallback/adapters/elevenlabsRealtimeSttProvider.js');

describe('ElevenLabs realtime STT provider', () => {
  beforeEach(() => {
    socketState.instances = [];
    socketState.emitCommittedOnVadAudio = true;
    socketState.emitCommittedOnManualCommit = true;
    socketState.emitCloseOnClose = false;
    process.env.ELEVENLABS_API_KEY = 'test-eleven-key';
    delete process.env.ELEVENLABS_STT_COMMIT_STRATEGY;
    process.env.ELEVENLABS_STT_FINAL_TIMEOUT_MS = '20';
    process.env.ELEVENLABS_STT_CLOSE_TIMEOUT_MS = '5';
  });

  it('uses VAD commits by default and does not send manual commit on finalize', async () => {
    const finals = [];
    const provider = await createElevenLabsRealtimeSttProvider({
      sampleRate: 16000,
      language: 'en-NZ',
      fixture: { keywords: [] },
      callbacks: {
        onPartial: vi.fn(),
        onFinal: (payload) => finals.push(payload),
        onError: vi.fn(),
      },
    });

    provider.write(Buffer.from([1, 2, 3]));
    await provider.finalize();

    const socket = socketState.instances[0];
    expect(String(socket.url)).toContain('commit_strategy=vad');
    expect(String(socket.url)).toContain('vad_silence_threshold_secs=0.8');
    expect(socket.sent.map((payload) => JSON.parse(payload).commit)).toEqual([false]);
    expect(finals).toEqual([expect.objectContaining({ text: 'I improved the support workflow.' })]);
    expect(socket.closed).toBe(true);
    expect(socket.terminated).toBe(true);
  });

  it('fails quickly when VAD never returns a committed transcript', async () => {
    socketState.emitCommittedOnVadAudio = false;
    const provider = await createElevenLabsRealtimeSttProvider({
      sampleRate: 16000,
      language: 'en-NZ',
      fixture: { keywords: [] },
      callbacks: {
        onPartial: vi.fn(),
        onFinal: vi.fn(),
        onError: vi.fn(),
      },
    });

    provider.write(Buffer.from([1, 2, 3]));

    await expect(provider.finalize()).rejects.toThrow(/Timed out waiting 20ms/);
  });

  it('still supports manual commit when explicitly configured', async () => {
    socketState.emitCommittedOnVadAudio = false;
    process.env.ELEVENLABS_STT_COMMIT_STRATEGY = 'manual';
    const provider = await createElevenLabsRealtimeSttProvider({
      sampleRate: 16000,
      language: 'en-NZ',
      fixture: { keywords: [] },
      callbacks: {
        onPartial: vi.fn(),
        onFinal: vi.fn(),
        onError: vi.fn(),
      },
    });

    provider.write(Buffer.from([1, 2, 3]));
    await provider.finalize();

    const socket = socketState.instances[0];
    expect(String(socket.url)).toContain('commit_strategy=manual');
    expect(socket.sent.map((payload) => JSON.parse(payload).commit)).toEqual([true]);
  });
});
