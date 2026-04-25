import { describe, expect, it } from 'vitest';
import { buildVoiceLatencyConsoleSummary } from '../voiceLatencySummary.js';

describe('buildVoiceLatencyConsoleSummary', () => {
  it('formats client and backend latency values into ms strings', () => {
    const summary = buildVoiceLatencyConsoleSummary({
      trace: {
        derived: {
          stopToSubmitMs: 120,
          submitToResponseMs: 980,
          stopToNextAudioMs: 1530,
          audioGapMs: 420,
        },
      },
      backendLatency: {
        totalMs: 1011,
        steps: [
          { step: 'load_latest_question', durationMs: 10 },
          { step: 'save_realtime_user_turn', durationMs: 21 },
          { step: 'adaptive_next_question', durationMs: 700 },
          { step: 'update_session_state', durationMs: 30 },
          { step: 'tts_synthesis', durationMs: 250 },
        ],
      },
    });

    expect(summary).toEqual({
      clientStopToSubmit: '120 ms',
      clientSubmitToResponse: '980 ms',
      clientStopToNextAudio: '1530 ms',
      clientAudioGap: '420 ms',
      backendTotal: '1011 ms',
      backendLoadQuestion: '10 ms',
      backendSaveTurn: '21 ms',
      backendAdaptiveNextQuestion: '700 ms',
      backendUpdateSession: '30 ms',
      backendTts: '250 ms',
    });
  });

  it('returns n/a when latency values are missing', () => {
    expect(buildVoiceLatencyConsoleSummary()).toEqual({
      clientStopToSubmit: 'n/a',
      clientSubmitToResponse: 'n/a',
      clientStopToNextAudio: 'n/a',
      clientAudioGap: 'n/a',
      backendTotal: 'n/a',
      backendLoadQuestion: 'n/a',
      backendSaveTurn: 'n/a',
      backendAdaptiveNextQuestion: 'n/a',
      backendUpdateSession: 'n/a',
      backendTts: 'n/a',
    });
  });
});
