/**
 * File responsibility: Duplex voice WebSocket endpoint.
 * Main responsibilities:
 * - Expose the product-level voice agent transport.
 * - Authenticate the socket and load the owned interview session.
 * - Delegate STT, agent planning, TTS, and barge-in orchestration to services.
 */

import { WebSocketServer } from 'ws';
import { logger } from '../utils/logger.js';
import {
  createWebSocketUpgradeLimiter,
  isAllowedWebSocketOrigin,
  parseCookieAuth,
  rejectUpgrade,
} from './webSocketSecurity.js';
export { parseCookies } from './webSocketSecurity.js';

const DUPLEX_VOICE_PATH_PATTERN = /^\/api\/interview\/([^/]+)\/voice\/duplex$/;
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

export const buildDuplexSocketContext = (request) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const match = requestUrl.pathname.match(DUPLEX_VOICE_PATH_PATTERN);
  if (!match) return null;
  const language = requestUrl.searchParams.get('language') || DEFAULT_LANGUAGE;
  const sampleRate = Number(requestUrl.searchParams.get('sampleRate') || DEFAULT_SAMPLE_RATE);
  const voiceName = requestUrl.searchParams.get('voiceName') || undefined;
  return {
    sessionId: match[1],
    language,
    voiceName,
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : DEFAULT_SAMPLE_RATE,
    auth: parseAuthToken(requestUrl, request),
  };
};

export async function loadDuplexVoiceDependencies() {
  const [voiceAgentModule, interviewSessionModule] = await Promise.all([
    import('../services/voice/duplexVoiceAgentService.js'),
    import('../services/interview/interviewSessionService.js'),
  ]);

  return {
    createDuplexVoiceAgentSession: voiceAgentModule.createDuplexVoiceAgentSession,
    loadOwnedSessionOrThrow: interviewSessionModule.loadOwnedSessionOrThrow,
    ensureInterviewInProgress: interviewSessionModule.ensureInterviewInProgress,
  };
}

export function attachDuplexVoiceSocketServer(server, dependencies = {}) {
  const wss = new WebSocketServer({ noServer: true });
  const allowUpgrade = createWebSocketUpgradeLimiter({ windowMs: 60 * 1000, max: 30 });

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.warn('Duplex voice socket dead, terminating', { sessionId: ws.kiwiSessionId });
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  server.on('upgrade', (request, socket, head) => {
    const context = buildDuplexSocketContext(request);
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
    socket.isAlive = true;
    socket.kiwiSessionId = context.sessionId;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    let duplexSession = null;
    const safeSend = (payload) => sendJson(socket, payload);

    try {
      const userId = context.auth?.id;
      if (!userId) {
        safeSend({ type: 'error', code: 'UNAUTHORIZED', message: 'Authentication required for duplex voice.' });
        socket.close(1008, 'unauthorized');
        return;
      }

      const {
        createDuplexVoiceAgentSession,
        loadOwnedSessionOrThrow,
        ensureInterviewInProgress,
      } = dependencies.loadDuplexVoiceDependencies
        ? await dependencies.loadDuplexVoiceDependencies()
        : await loadDuplexVoiceDependencies();

      const session = await loadOwnedSessionOrThrow({ sessionId: context.sessionId, userId });
      ensureInterviewInProgress(session);
      duplexSession = createDuplexVoiceAgentSession({
        socket,
        context,
        session,
        userId,
        logger,
        sendJson: safeSend,
      });
    } catch (error) {
      logger.error('Failed to start duplex voice socket', { error, sessionId: context.sessionId });
      safeSend({ type: 'error', code: 'DUPLEX_START_FAILED', message: error?.message || 'Could not start duplex voice.' });
      socket.close(1011, 'duplex-start-failed');
      return;
    }

    socket.on('message', async (message, isBinary) => {
      try {
        if (isBinary) {
          await duplexSession?.handleBinaryAudio?.(message);
          return;
        }
        const payload = safeJsonParse(String(message));
        if (!payload) return;
        await duplexSession?.handleJsonMessage?.(payload);
      } catch (error) {
        logger.error('Duplex voice socket message failed', { error, sessionId: context.sessionId });
        safeSend({ type: 'error', code: 'DUPLEX_MESSAGE_FAILED', message: error?.message || 'Duplex voice message failed.' });
      }
    });

    socket.on('close', async () => {
      await duplexSession?.close?.();
    });

    socket.on('error', async (error) => {
      logger.error('Duplex voice socket error', { error, sessionId: context.sessionId });
      await duplexSession?.close?.();
    });
  });

  return wss;
}
