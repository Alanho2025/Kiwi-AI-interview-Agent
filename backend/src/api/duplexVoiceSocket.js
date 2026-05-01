/**
 * File responsibility: Duplex voice WebSocket helpers.
 * Main responsibilities:
 * - Parse and validate the official duplex voice socket path.
 * - Keep socket JSON sending safe for closed connections.
 * - Keep JSON parsing conservative so malformed client frames do not crash the server.
 */

const OFFICIAL_DUPLEX_PATH = /^\/api\/interview\/([^/]+)\/voice\/duplex$/;
const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function safeJsonParse(payload) {
  try {
    return JSON.parse(String(payload));
  } catch {
    return null;
  }
}

export function sendJson(socket, payload) {
  if (!socket || socket.readyState !== 1 || typeof socket.send !== 'function') {
    return false;
  }

  socket.send(JSON.stringify(payload));
  return true;
}

export function buildDuplexSocketContext(request = {}) {
  const host = request.headers?.host || 'localhost';
  const url = new URL(request.url || '', `http://${host}`);
  const match = url.pathname.match(OFFICIAL_DUPLEX_PATH);

  if (!match) {
    return null;
  }

  return {
    sessionId: decodeURIComponent(match[1]),
    language: url.searchParams.get('language') || DEFAULT_LANGUAGE,
    sampleRate: parsePositiveInteger(url.searchParams.get('sampleRate'), DEFAULT_SAMPLE_RATE),
  };
}
