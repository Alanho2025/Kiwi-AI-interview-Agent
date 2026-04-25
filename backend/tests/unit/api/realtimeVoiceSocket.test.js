import { describe, expect, it, vi } from 'vitest';
import { buildSocketContext, safeJsonParse, sendJson } from '../../../src/api/realtimeVoiceSocket.js';

describe('realtime voice socket helpers', () => {
  it('parses safe JSON and ignores malformed JSON', () => {
    expect(safeJsonParse('{"type":"stop"}')).toEqual({ type: 'stop' });
    expect(safeJsonParse('{bad')).toBeNull();
  });

  it('sends JSON only when the socket is open', () => {
    const openSocket = { readyState: 1, send: vi.fn() };
    const closedSocket = { readyState: 3, send: vi.fn() };

    sendJson(openSocket, { type: 'ready' });
    sendJson(closedSocket, { type: 'ready' });

    expect(openSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ready' }));
    expect(closedSocket.send).not.toHaveBeenCalled();
  });

  it('builds socket context from a valid live voice URL', () => {
    const context = buildSocketContext({
      url: '/api/interview/session-1/voice/live?language=en-NZ&sampleRate=16000',
      headers: { host: 'localhost:3000' },
    });

    expect(context).toEqual(expect.objectContaining({
      sessionId: 'session-1',
      language: 'en-NZ',
      sampleRate: 16000,
    }));
  });

  it('ignores unrelated upgrade paths', () => {
    expect(buildSocketContext({
      url: '/api/health',
      headers: { host: 'localhost:3000' },
    })).toBeNull();
  });
});
