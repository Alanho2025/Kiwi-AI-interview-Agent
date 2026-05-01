import { describe, expect, it, vi } from 'vitest';

import { buildDuplexSocketContext, sendJson, safeJsonParse } from '../../../src/api/duplexVoiceSocket.js';
import { AGENT_TOOL_NAMES } from '../../../src/constants/agentToolNames.js';
import { createBargeInController } from '../../../src/services/voice/bargeInController.js';
import { buildConfidenceGate } from '../../../src/services/voice/speechConfidenceGate.js';
import { normalizeTranscript } from '../../../src/services/voice/transcriptNormalizer.js';

describe('duplex voice robustness', () => {
  it('only accepts the official duplex voice path and rejects unrelated paths', () => {
    expect(buildDuplexSocketContext({
      url: '/api/interview/session-1/voice/duplex?language=en-NZ&sampleRate=16000',
      headers: { host: 'localhost:3000' },
    })).toEqual(expect.objectContaining({ sessionId: 'session-1', language: 'en-NZ', sampleRate: 16000 }));

    expect(buildDuplexSocketContext({
      url: '/api/interview/session-1/voice/live',
      headers: { host: 'localhost:3000' },
    })).toBeNull();
  });

  it('does not send JSON to closed sockets and ignores malformed socket messages', () => {
    expect(safeJsonParse('{bad')).toBeNull();
    const closedSocket = { readyState: 3, send: vi.fn() };
    sendJson(closedSocket, { type: 'session_ready' });
    expect(closedSocket.send).not.toHaveBeenCalled();
  });

  it('cancels active assistant speech on barge-in and emits a formal tool trace', () => {
    const sent = [];
    const controller = createBargeInController({ sendJson: (payload) => sent.push(payload), sessionId: 's1' });
    const token = controller.startAssistantSpeech();

    expect(controller.isTokenActive(token)).toBe(true);
    const ack = controller.handleBargeIn('user_started_speaking');

    expect(ack).toEqual(expect.objectContaining({
      type: 'barge_in_ack',
      tool: AGENT_TOOL_NAMES.HANDLE_VOICE_BARGE_IN,
      interrupted: true,
      speechToken: token,
    }));
    expect(controller.isTokenActive(token)).toBe(false);
    expect(sent[0]).toEqual(ack);
  });

  it('treats low or missing STT confidence conservatively', () => {
    expect(buildConfidenceGate(null)).toEqual({ status: 'unknown', shouldConfirm: true, shouldRecordAgain: false });
    expect(buildConfidenceGate(0.2)).toEqual({ status: 'low', shouldConfirm: true, shouldRecordAgain: true });
  });

  it('normalizes common STT technical misrecognitions without rewriting the answer meaning', () => {
    const result = normalizeTranscript('I used react query with post gray sql and r a g.');

    expect(result.normalizedText).toBe('I used React Query with PostgreSQL and RAG.');
    expect(result.changed).toBe(true);
    expect(result.corrections.length).toBeGreaterThanOrEqual(3);
  });
});
