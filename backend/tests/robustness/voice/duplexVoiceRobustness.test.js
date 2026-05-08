import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

import { buildDuplexSocketContext, parseCookies, sendJson, safeJsonParse } from '../../../src/api/duplexVoiceSocket.js';
import { AGENT_TOOL_NAMES } from '../../../src/constants/agentToolNames.js';
import { createBargeInController } from '../../../src/services/voice/bargeInController.js';
import { buildConfidenceGate, validateRealtimeVoiceTranscript } from '../../../src/services/voice/speechConfidenceGate.js';
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



  it('accepts the existing HTTP-only auth_token cookie during WebSocket upgrade', () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);

    const context = buildDuplexSocketContext({
      url: '/api/interview/session-1/voice/duplex?language=en-NZ&sampleRate=16000',
      headers: {
        host: 'localhost:3000',
        cookie: `other=value; auth_token=${encodeURIComponent(token)}`,
      },
    });

    expect(parseCookies(`auth_token=${encodeURIComponent(token)}`).auth_token).toBe(token);
    expect(context.auth).toEqual(expect.objectContaining({ id: 'user-123' }));
  });

  it('rejects query-string JWTs during WebSocket upgrade context building', () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);

    const context = buildDuplexSocketContext({
      url: `/api/interview/session-1/voice/duplex?token=${encodeURIComponent(token)}`,
      headers: { host: 'localhost:3000' },
    });

    expect(context.auth).toBeNull();
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



  it('blocks unsafe final transcripts before the duplex turn advances', () => {
    expect(validateRealtimeVoiceTranscript({ transcriptText: '', asrConfidence: 0.9 }).ok).toBe(false);
    expect(validateRealtimeVoiceTranscript({ transcriptText: 'yes', asrConfidence: 0.9 })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'TOO_SHORT_TRANSCRIPT',
    }));
    expect(validateRealtimeVoiceTranscript({ transcriptText: 'I used React', asrConfidence: 0.2, vad: { speechDurationMs: 4000 } })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
    }));
    expect(validateRealtimeVoiceTranscript({
      transcriptText: 'I used React Query with PostgreSQL and checked the result through integration tests.',
      asrConfidence: 0.2,
      vad: { speechDurationMs: 9000 },
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
    }));
    expect(validateRealtimeVoiceTranscript({
      transcriptText: 'I used React Query with PostgreSQL and checked the result through integration tests.',
      asrConfidence: 0.62,
      vad: { speechDurationMs: 9000 },
    }).ok).toBe(true);
  });

  it('normalizes common STT technical misrecognitions without rewriting the answer meaning', () => {
    const result = normalizeTranscript('I used react query with post gray sql and r a g.');

    expect(result.normalizedText).toBe('I used React Query with PostgreSQL and RAG.');
    expect(result.changed).toBe(true);
    expect(result.corrections.length).toBeGreaterThanOrEqual(3);
  });
});
