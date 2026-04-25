import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

const { speechSession } = vi.hoisted(() => ({
      speechSession: {
        start: vi.fn().mockResolvedValue(undefined),
        writeAudio: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.mock('../../src/services/voice/realtimeSpeechSessionService.js', () => ({
  createRealtimeSpeechSession: vi.fn(() => speechSession),
}));

describe('realtime voice socket integration flow', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { attachRealtimeVoiceSocketServer } = await import('../../src/api/realtimeVoiceSocket.js');
    server = http.createServer();
    attachRealtimeVoiceSocketServer(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `ws://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('accepts a live socket, writes binary audio, and stops on stop message', async () => {
    const events = [];
    const socket = new WebSocket(`${baseUrl}/api/interview/session-1/voice/live?language=en-NZ&sampleRate=16000`);
    socket.on('message', (message) => events.push(JSON.parse(String(message))));

    await new Promise((resolve) => socket.once('open', resolve));
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (events.some((event) => event.type === 'ready')) {
          clearInterval(timer);
          resolve();
        }
      }, 5);
    });

    socket.send(Buffer.from([1, 2, 3]));
    socket.send(JSON.stringify({ type: 'stop' }));

    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (events.some((event) => event.type === 'stopped')) {
          clearInterval(timer);
          resolve();
        }
      }, 5);
    });

    expect(speechSession.start).toHaveBeenCalled();
    expect(speechSession.writeAudio).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
    expect(speechSession.stop).toHaveBeenCalled();

    socket.close();
  });

  it('responds to ping without crashing the speech session', async () => {
    const events = [];
    const socket = new WebSocket(`${baseUrl}/api/interview/session-1/voice/live`);
    socket.on('message', (message) => events.push(JSON.parse(String(message))));

    await new Promise((resolve) => socket.once('open', resolve));
    socket.send(JSON.stringify({ type: 'ping' }));

    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (events.some((event) => event.type === 'pong')) {
          clearInterval(timer);
          resolve();
        }
      }, 5);
    });

    expect(events.some((event) => event.type === 'ready')).toBe(true);
    expect(events.some((event) => event.type === 'pong')).toBe(true);

    socket.close();
  });
});
