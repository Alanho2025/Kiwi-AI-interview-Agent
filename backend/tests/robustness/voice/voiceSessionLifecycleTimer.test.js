import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
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

describe('7. voiceSessionLifecycleTimer: Voice session timer expiration & tab close cleanup', () => {
  let server;
  let baseWsUrl;
  let token;
  let dependencyMocks;
  let sockets;
  let sessionClosed;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'lifecycle-timer-secret';
    token = jwt.sign({ id: 'user-timer-1' }, process.env.JWT_SECRET);
    sockets = [];
    sessionClosed = false;

    dependencyMocks = {
      loadOwnedSessionOrThrow: vi.fn().mockResolvedValue({
        id: 'session-timer-1',
        userId: 'user-timer-1',
        status: 'in_progress',
        mode: 'voice',
        transcript: [],
      }),
      ensureInterviewInProgress: vi.fn(),
      createDuplexVoiceAgentSession: vi.fn(({ sendJson }) => ({
        handleJsonMessage: vi.fn(async (payload) => {
          if (payload.type === 'session_start') sendJson({ type: 'listening_started' });
          if (payload.type === 'session_stop') sendJson({ type: 'session_stopped' });
        }),
        close: vi.fn(async () => {
          sessionClosed = true;
        }),
      })),
    };

    server = http.createServer((_req, res) => {
      res.statusCode = 404;
      res.end();
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

  it('triggers session_stopped and invokes session.close() on session_stop signal', async () => {
    const socket = new WebSocket(`${baseWsUrl}/api/interview/session-timer-1/voice/duplex?token=${token}`);
    sockets.push(socket);
    await waitForOpen(socket);

    socket.send(JSON.stringify({ type: 'session_start' }));
    await waitForMessage(socket, (p) => p.type === 'listening_started');

    // Send session stop (e.g. interview timer expired)
    socket.send(JSON.stringify({ type: 'session_stop', reason: 'timer_expired' }));
    const stoppedPayload = await waitForMessage(socket, (p) => p.type === 'session_stopped');
    expect(stoppedPayload.type).toBe('session_stopped');

    socket.close();
    await new Promise((r) => setTimeout(r, 50));

    expect(sessionClosed).toBe(true);
  });
});
