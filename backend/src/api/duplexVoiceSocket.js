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
  parseJwtAuthToken,
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
  return parseCookieAuth(request) || parseJwtAuthToken(requestUrl.searchParams.get('token') || '');
};

const INTERRUPT_CONTROL_TYPES = new Set(['barge_in', 'cancel_assistant_audio']);

export const isInterruptControlPayload = (payload = {}) =>
  INTERRUPT_CONTROL_TYPES.has(payload?.type);

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

export const createSocketMessageQueue = ({ socket, context, duplexSessionRef, safeSend }) => {
  let queue = Promise.resolve();

  const processPayload = async (payload) => {
    if (!payload) return;
    await duplexSessionRef.current?.handleJsonMessage?.(payload);
  };

  const handleQueueError = (error) => {
    logger.error('Duplex voice socket message failed', { error, sessionId: context.sessionId });
    safeSend({
      type: 'error',
      code: 'DUPLEX_MESSAGE_FAILED',
      message: error?.message || 'Duplex voice message failed.',
    });
  };

  const processMessage = async (message, isBinary) => {
    if (isBinary) {
      await duplexSessionRef.current?.handleBinaryAudio?.(message);
      return;
    }

    const payload = safeJsonParse(String(message));
    await processPayload(payload);
  };

  socket.on('message', (message, isBinary) => {
    if (!isBinary) {
      const payload = safeJsonParse(String(message));
      if (isInterruptControlPayload(payload)) {
        void processPayload(payload).catch(handleQueueError);
        return;
      }
    }

    queue = queue
      .then(() => processMessage(message, isBinary))
      .catch(handleQueueError);
  });

  return {
    drain: () => queue.catch(() => undefined),
  };
};

export function attachDuplexVoiceSocketServer(server, dependencies = {}) {
  const wss = new WebSocketServer({ noServer: true });
  const allowUpgrade = createWebSocketUpgradeLimiter({ windowMs: 60 * 1000, max: 30 });

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
    socket.kiwiSessionId = context.sessionId;
    socket.on('error', (error) => {
      logger.error('Duplex WebSocket connection error', { sessionId: socket.kiwiSessionId, error: error.message, stack: error.stack });
    });

    const duplexSessionRef = { current: null };
    const safeSend = (payload) => sendJson(socket, payload);
    const messageQueue = createSocketMessageQueue({ socket, context, duplexSessionRef, safeSend });

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
      duplexSessionRef.current = createDuplexVoiceAgentSession({
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

    socket.on('close', async () => {
      await messageQueue.drain();
      await duplexSessionRef.current?.close?.();
    });

    socket.on('error', async (error) => {
      logger.error('Duplex voice socket error', { error, sessionId: context.sessionId });
      await messageQueue.drain();
      await duplexSessionRef.current?.close?.();
    });
  });

  return wss;
}
