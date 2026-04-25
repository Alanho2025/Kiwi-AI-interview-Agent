import { describe, expect, it } from 'vitest';
import { buildRealtimeVoiceLatencySummary } from '../../../src/utils/realtimeVoiceLatencySummary.js';

describe('buildRealtimeVoiceLatencySummary', () => {
  it('formats known latency steps into ms strings', () => {
    const summary = buildRealtimeVoiceLatencySummary({
      totalMs: 1102,
      steps: [
        { step: 'load_latest_question', durationMs: 12 },
        { step: 'save_realtime_user_turn', durationMs: 25 },
        { step: 'adaptive_next_question', durationMs: 702 },
        { step: 'update_session_state', durationMs: 36 },
        { step: 'tts_synthesis', durationMs: 301 },
      ],
    });

    expect(summary).toEqual({
      total: '1102 ms',
      loadLatestQuestion: '12 ms',
      saveRealtimeUserTurn: '25 ms',
      adaptiveNextQuestion: '702 ms',
      updateSessionState: '36 ms',
      ttsSynthesis: '301 ms',
      generateCompletionReport: 'n/a',
    });
  });
});
