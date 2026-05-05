import { describe, expect, it } from 'vitest';
import { buildVoiceLatencyDebugSummary, buildVoiceLatencyTargetSummary } from '../voiceLatencySummary.js';

describe('voice latency summaries', () => {
  it('separates product target latency from debug latency values', () => {
    const trace = {
      traceId: 'trace-1',
      turnId: 'turn-1',
      events: [
        { name: 'final_transcript_received', source: 'stt_final', usedPartialFallback: false },
      ],
      derived: {
        speechEndToAiSpeechStartMs: 1530,
        stopToSubmitMs: 120,
        submitToFirstAudioChunkMs: 980,
        audioGapMs: 420,
      },
    };
    const backendLatency = {
      totalMs: 1011,
      markers: { first_audio_sent: { msFromStart: 880 } },
      steps: [
        { step: 'load_latest_question', durationMs: 10 },
        { step: 'save_realtime_user_turn', durationMs: 21 },
        { step: 'adaptive_next_question', durationMs: 700 },
        { step: 'update_session_state', durationMs: 30 },
        { step: 'tts_synthesis', durationMs: 250 },
      ],
    };

    expect(buildVoiceLatencyTargetSummary({ trace, backendLatency, phase: 'playback' })).toEqual({
      phase: 'playback',
      traceId: 'trace-1',
      turnId: 'turn-1',
      targetSpeechEndToAiSpeechStart: '1530 ms',
      backendFirstAudioSent: '880 ms',
      backendTotal: '1011 ms',
      transcriptSource: 'stt_final',
      usedPartialFallback: 'false',
    });

    expect(buildVoiceLatencyDebugSummary({ trace, backendLatency })).toMatchObject({
      clientSpeechEndToAiSpeechStart: '1530 ms',
      clientStopToSubmit: '120 ms',
      clientSubmitToFirstAudioChunk: '980 ms',
      clientPlaybackToMicReady: '420 ms',
      backendTotal: '1011 ms',
      backendLoadQuestion: '10 ms',
      backendSaveTurn: '21 ms',
      backendAdaptiveNextQuestion: '700 ms',
      backendUpdateSession: '30 ms',
      backendTts: '250 ms',
    });
  });
});
