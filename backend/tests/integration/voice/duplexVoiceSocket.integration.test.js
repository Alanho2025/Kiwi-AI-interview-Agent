import http from 'node:http';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachDuplexVoiceSocketServer } from '../../../src/api/duplexVoiceSocket.js';

const waitForOpen = (socket) => new Promise((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});

const waitForMessage = (socket, predicate = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket message.')), 1000);
  const onMessage = (data) => {
    const payload = JSON.parse(String(data));
    if (!predicate(payload)) return;
    clearTimeout(timer);
    socket.off('message', onMessage);
    resolve(payload);
  };
  socket.on('message', onMessage);
});

const closeServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

describe('duplex voice WebSocket integration', () => {
  let server;
  let baseWsUrl;
  let token;
  let dependencyMocks;
  let jsonMessages;
  let binaryChunks;
  let sockets;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'duplex-ws-integration-secret';
    token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    jsonMessages = [];
    binaryChunks = [];
    sockets = [];
    dependencyMocks = {
      loadOwnedSessionOrThrow: vi.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'in_progress',
        mode: 'voice',
        transcript: [],
      }),
      ensureInterviewInProgress: vi.fn(),
      createDuplexVoiceAgentSession: vi.fn(({ sendJson }) => ({
        handleJsonMessage: vi.fn(async (payload) => {
          jsonMessages.push(payload);
          if (payload.type === 'session_start') sendJson({ type: 'listening_started', source: 'integration_mock' });
          if (payload.type === 'ping') sendJson({ type: 'pong', source: 'integration_mock' });
          if (payload.type === 'barge_in') sendJson({ type: 'barge_in_acknowledged', source: 'integration_mock' });
          if (payload.type === 'session_stop') sendJson({ type: 'session_stopped', source: 'integration_mock' });
        }),
        handleBinaryAudio: vi.fn(async (message) => {
          binaryChunks.push(Buffer.from(message).length);
          sendJson({ type: 'audio_received', bytes: Buffer.from(message).length });
        }),
        close: vi.fn(),
      })),
    };

    server = http.createServer((_req, res) => {
      res.statusCode = 404;
      res.end('not found');
    });
    attachDuplexVoiceSocketServer(server, {
      loadDuplexVoiceDependencies: async () => dependencyMocks,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseWsUrl = `ws://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    for (const socket of sockets) {
      try { socket.close(); } catch {}
      try { socket.terminate(); } catch {}
    }
    if (server?.listening) await closeServer(server);
  });

  it('authenticates, loads owned session, and routes JSON plus binary audio events', async () => {
    const socket = new WebSocket(`${baseWsUrl}/api/interview/session-1/voice/duplex?token=${token}&language=en-NZ&sampleRate=16000`);
    sockets.push(socket);
    await waitForOpen(socket);
    socket.send(JSON.stringify({ type: 'session_start', language: 'en-NZ', sampleRate: 16000 }));

    const listening = await waitForMessage(socket, (payload) => payload.type === 'listening_started');
    expect(listening.source).toBe('integration_mock');
    expect(dependencyMocks.loadOwnedSessionOrThrow).toHaveBeenCalledWith({ sessionId: 'session-1', userId: 'user-1' });
    expect(dependencyMocks.ensureInterviewInProgress).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }));
    expect(dependencyMocks.createDuplexVoiceAgentSession).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({ sessionId: 'session-1', language: 'en-NZ', sampleRate: 16000 }),
      userId: 'user-1',
    }));

    socket.send(JSON.stringify({ type: 'ping', clientTimestamp: 123 }));
    const pong = await waitForMessage(socket, (payload) => payload.type === 'pong');
    expect(pong.source).toBe('integration_mock');

    socket.send(Buffer.from([1, 2, 3, 4]));
    const audioAck = await waitForMessage(socket, (payload) => payload.type === 'audio_received');
    expect(audioAck.bytes).toBe(4);
    expect(jsonMessages.map((item) => item.type)).toEqual(expect.arrayContaining(['session_start', 'ping']));
    expect(binaryChunks).toEqual([4]);

    socket.close();
  });

  it('buffers messages during async session initialization and processes them when ready', async () => {
    let resolveSessionLoading;
    const slowLoadingPromise = new Promise((resolve) => { resolveSessionLoading = resolve; });

    dependencyMocks.loadOwnedSessionOrThrow = vi.fn().mockImplementation(async () => {
      await slowLoadingPromise;
      return {
        id: 'session-1',
        userId: 'user-1',
        status: 'in_progress',
        mode: 'voice',
        transcript: [],
      };
    });

    const socket = new WebSocket(`${baseWsUrl}/api/interview/session-1/voice/duplex?token=${token}&language=en-NZ&sampleRate=16000`);
    sockets.push(socket);
    await waitForOpen(socket);

    // Send messages BEFORE session initialization completes
    socket.send(JSON.stringify({ type: 'session_start', language: 'en-NZ' }));
    socket.send(JSON.stringify({ type: 'ping', clientTimestamp: 999 }));

    // Unblock session loading
    resolveSessionLoading();

    const listening = await waitForMessage(socket, (payload) => payload.type === 'listening_started');
    expect(listening.source).toBe('integration_mock');
    expect(jsonMessages.map((item) => item.type)).toContain('session_start');
    expect(jsonMessages.map((item) => item.type)).toContain('ping');

    socket.close();
  });

  it('immediately routes interrupt control payloads (barge_in / cancel_assistant_audio)', async () => {
    const socket = new WebSocket(`${baseWsUrl}/api/interview/session-1/voice/duplex?token=${token}`);
    sockets.push(socket);
    await waitForOpen(socket);

    socket.send(JSON.stringify({ type: 'session_start' }));
    await waitForMessage(socket, (payload) => payload.type === 'listening_started');

    socket.send(JSON.stringify({ type: 'barge_in', timestamp: Date.now() }));
    const receivedBargeIn = await waitForMessage(socket, () => jsonMessages.some((m) => m.type === 'barge_in'));
    expect(jsonMessages).toContainEqual(expect.objectContaining({ type: 'barge_in' }));

    socket.close();
  });

  it('rejects unauthenticated duplex sockets before loading a session', async () => {
    const socket = new WebSocket(`${baseWsUrl}/api/interview/session-1/voice/duplex`);
    sockets.push(socket);
    const errorPromise = waitForMessage(socket, (payload) => payload.type === 'error');
    await waitForOpen(socket);
    const error = await errorPromise;

    expect(error.code).toBe('UNAUTHORIZED');
    expect(dependencyMocks.loadOwnedSessionOrThrow).not.toHaveBeenCalled();
    socket.close();
  });

  it('handles invalid JSON gracefully without crashing the WebSocket connection', async () => {
    const socket = new WebSocket(`${baseWsUrl}/api/interview/session-1/voice/duplex?token=${token}`);
    sockets.push(socket);
    await waitForOpen(socket);

    socket.send(JSON.stringify({ type: 'session_start' }));
    await waitForMessage(socket, (payload) => payload.type === 'listening_started');

    // Send malformed non-JSON text
    socket.send('NOT_VALID_JSON{{{');

    // Connection remains active and responsive to subsequent ping
    socket.send(JSON.stringify({ type: 'ping', test: 123 }));
    const pong = await waitForMessage(socket, (payload) => payload.type === 'pong');
    expect(pong).toBeDefined();

    socket.close();
  });
});

