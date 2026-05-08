/**
 * File responsibility: Real-time voice WebSocket endpoint.
 * Main responsibilities:
 * - Own the WebSocket transport layer for live STT.
 * - Keep Azure Speech session logic inside services/voice.
 * - Return partial/final transcript events without submitting to the interview engine.
 */

import { WebSocketServer } from 'ws';
import { createRealtimeSpeechSession } from '../services/voice/realtimeSpeechSessionService.js';
import { logger } from '../utils/logger.js';
import {
  createWebSocketUpgradeLimiter,
  isAllowedWebSocketOrigin,
  parseCookieAuth,
  rejectUpgrade,
} from './webSocketSecurity.js';

const LIVE_VOICE_PATH_PATTERN = /^\/api\/interview\/([^/]+)\/voice\/live$/;
const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;

export const safeJsonParse = (value) => {
  try { return JSON.parse(value); } catch { return null; }
};

export const sendJson = (socket, payload) => {
  if (socket.readyState !== 1) return;
  socket.send(JSON.stringify(payload));
};

const parseAuthToken = (requestUrl, request = {}) => {
  if (requestUrl.searchParams.has('token')) return null;
  return parseCookieAuth(request);
};

export const buildSocketContext = (request) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const match = requestUrl.pathname.match(LIVE_VOICE_PATH_PATTERN);
  if (!match) return null;
  const language = requestUrl.searchParams.get('language') || DEFAULT_LANGUAGE;
  const sampleRate = Number(requestUrl.searchParams.get('sampleRate') || DEFAULT_SAMPLE_RATE);
  return {
    sessionId: match[1],
    language,
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : DEFAULT_SAMPLE_RATE,
    auth: parseAuthToken(requestUrl, request),
  };
};

export function attachRealtimeVoiceSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });
  const allowUpgrade = createWebSocketUpgradeLimiter({ windowMs: 60 * 1000, max: 30 });

  server.on('upgrade', (request, socket, head) => {
    const context = buildSocketContext(request);
    if (!context) return;
    if (!allowUpgrade(request)) {
      rejectUpgrade(socket, 429, 'Too Many Requests');
      return;
    }
    if (!isAllowedWebSocketOrigin(request)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, context);
    });
  });

  wss.on('connection', async (socket, request, context) => {
    socket.kiwiSessionId = context.sessionId;

    let speechSession = null;
    let started = false;

    const safeSend = (payload) => sendJson(socket, payload);

    try {
      if (!context.auth?.id) {
        safeSend({ type: 'speech_error', errorDetails: 'Authentication required for realtime voice.' });
        socket.close(1008, 'unauthorized');
        return;
      }

      speechSession = createRealtimeSpeechSession({
        language: context.language,
        sampleRate: context.sampleRate,
        onPartialTranscript: safeSend,
        onFinalTranscript: safeSend,
        onError: safeSend,
        onSessionStarted: safeSend,
        onSessionStopped: safeSend,
      });
      await speechSession.start();
      started = true;
      safeSend({
        type: 'ready',
        sessionId: context.sessionId,
        language: context.language,
        sampleRate: context.sampleRate,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to start realtime voice socket', { error, sessionId: context.sessionId });
      safeSend({ type: 'speech_error', errorDetails: error.message || 'Could not start real-time speech recognition.' });
      socket.close(1011, 'speech-start-failed');
      return;
    }

    socket.on('message', async (message, isBinary) => {
      if (!started || !speechSession) return;
      if (isBinary) {
        speechSession.writeAudio(Buffer.from(message));
        return;
      }

      const payload = safeJsonParse(String(message));
      if (!payload) return;
      if (payload.type === 'stop') {
        await speechSession.stop();
        safeSend({ type: 'stopped', timestamp: new Date().toISOString() });
        return;
      }
      if (payload.type === 'ping') {
        safeSend({ type: 'pong', timestamp: new Date().toISOString() });
      }
    });

    socket.on('close', async () => {
      if (!speechSession) return;
      await speechSession.stop();
    });

    socket.on('error', async (error) => {
      logger.error('Realtime voice socket error', { error, sessionId: context.sessionId });
      if (speechSession) await speechSession.stop();
    });
  });

  return wss;
}
