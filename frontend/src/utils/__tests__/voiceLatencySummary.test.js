import { describe, expect, it } from 'vitest';
import { buildVoiceLatencyConsoleSummary } from '../voiceLatencySummary.js';

describe('buildVoiceLatencyConsoleSummary', () => {
  it('formats client and backend latency values into ms strings', () => {
    const summary = buildVoiceLatencyConsoleSummary({
      phase: 'playback-start',
      trace: {
        traceId: 'voice-1',
        events: [
          { name: 'vad_config', pauseCandidateMs: 1800, pauseConfirmMs: 800, silenceToStopMs: 2600 },
          { name: 'final_transcript_received', source: 'azure_realtime', usedPartialFallback: false },
        ],
        derived: {
          vadToPlaybackMs: 1530,
          submitToFirstAudioChunkMs: 1180,
          submitToPlaybackStartMs: 1530,
          sttFinalisationMs: 640,
          firstAudioChunkToPlayMs: 210,
          pauseCandidateToConfirmedMs: 800,
          playbackToMicReadyMs: 420,
          audioPlaybackMs: 2200,
        },
      },
      backendLatency: {
        totalMs: 1011,
        steps: [
          { step: 'load_latest_question', durationMs: 10 },
          { step: 'save_realtime_user_turn', durationMs: 21 },
          { step: 'adaptive_next_question', durationMs: 700 },
          { step: 'first_sentence_ready', msFromStart: 760 },
          { step: 'stream_sentence_tts_0', durationMs: 170 },
          { step: 'first_audio_sent', msFromStart: 930 },
          { step: 'update_session_state', durationMs: 30 },
          { step: 'tts_synthesis', durationMs: 250 },
        ],
      },
    });

    expect(summary).toEqual({
      phase: 'playback-start',
      traceId: 'voice-1',
      vadPauseCandidateMs: '1800 ms',
      vadPauseConfirmMs: '800 ms',
      vadSilenceToStopMs: '2600 ms',
      clientTranscriptSource: 'azure_realtime',
      clientUsedPartialFallback: 'false',
      clientVadToPlayback: '1530 ms',
      clientSubmitToFirstAudioChunk: '1180 ms',
      clientSubmitToPlaybackStart: '1530 ms',
      clientSttFinalisation: '640 ms',
      clientFirstAudioChunkToPlay: '210 ms',
      clientPauseCandidateToConfirmed: '800 ms',
      clientPlaybackToMicReady: '420 ms',
      clientAudioPlayback: '2200 ms',
      backendTotal: '1011 ms',
      backendLoadQuestion: '10 ms',
      backendSaveTurn: '21 ms',
      backendAdaptiveNextQuestion: '700 ms',
      backendUpdateSession: '30 ms',
      backendTts: '250 ms',
      backendFirstSentenceReady: '760 ms',
      backendFirstAudioSent: '930 ms',
      backendFirstSentenceTts: '170 ms',
    });
  });

  it('returns n/a when latency values are missing', () => {
    expect(buildVoiceLatencyConsoleSummary()).toEqual({
      phase: 'turn',
      traceId: 'n/a',
      vadPauseCandidateMs: 'n/a',
      vadPauseConfirmMs: 'n/a',
      vadSilenceToStopMs: 'n/a',
      clientTranscriptSource: 'n/a',
      clientUsedPartialFallback: 'false',
      clientVadToPlayback: 'n/a',
      clientSubmitToFirstAudioChunk: 'n/a',
      clientSubmitToPlaybackStart: 'n/a',
      clientSttFinalisation: 'n/a',
      clientFirstAudioChunkToPlay: 'n/a',
      clientPauseCandidateToConfirmed: 'n/a',
      clientPlaybackToMicReady: 'n/a',
      clientAudioPlayback: 'n/a',
      backendTotal: 'n/a',
      backendLoadQuestion: 'n/a',
      backendSaveTurn: 'n/a',
      backendAdaptiveNextQuestion: 'n/a',
      backendUpdateSession: 'n/a',
      backendTts: 'n/a',
      backendFirstSentenceReady: 'n/a',
      backendFirstAudioSent: 'n/a',
      backendFirstSentenceTts: 'n/a',
    });
  });
});
