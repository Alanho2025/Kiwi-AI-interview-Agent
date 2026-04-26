import { describe, expect, it } from 'vitest';
import { buildRealtimeVoiceLatencySummary } from '../../../src/utils/realtimeVoiceLatencySummary.js';

describe('buildRealtimeVoiceLatencySummary', () => {
  it('formats known latency steps and first-audio markers into ms strings', () => {
    const summary = buildRealtimeVoiceLatencySummary({
      totalMs: 1102,
      steps: [
        { step: 'backend_request_received', msFromStart: 0 },
        { step: 'load_latest_question', durationMs: 12 },
        { step: 'save_realtime_user_turn', durationMs: 25 },
        { step: 'adaptive_next_question', durationMs: 702 },
        { step: 'first_sentence_ready', msFromStart: 760 },
        { step: 'stream_sentence_tts_0', durationMs: 220 },
        { step: 'first_audio_sent', msFromStart: 980 },
        { step: 'update_session_state', durationMs: 36 },
        { step: 'tts_synthesis', durationMs: 301 },
      ],
    });

    expect(summary).toEqual({
      total: '1102 ms',
      backendRequestReceived: '0 ms',
      loadLatestQuestion: '12 ms',
      saveRealtimeUserTurn: '25 ms',
      adaptiveNextQuestion: '702 ms',
      firstSentenceReady: '760 ms',
      firstAudioSent: '980 ms',
      firstSentenceTts: '220 ms',
      updateSessionState: '36 ms',
      ttsSynthesis: '301 ms',
      generateCompletionReport: 'n/a',
    });
  });
});
