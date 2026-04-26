import { describe, expect, it, vi } from 'vitest';
import { buildVoiceLatencyDerived, createVoiceLatencyTrace } from '../voiceLatencyTrace.js';

describe('createVoiceLatencyTrace', () => {
  it('calculates evidence-ready voice pipeline durations', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const trace = createVoiceLatencyTrace({ sessionId: 's1' });
    trace.mark('vad_speech_start');
    now += 1000;
    trace.mark('pause_candidate_start');
    now += 800;
    trace.mark('pause_confirmed');
    trace.mark('vad_speech_end');
    now += 100;
    trace.mark('stt_stop_sent');
    now += 900;
    trace.mark('final_transcript_received');
    now += 50;
    trace.mark('auto_submit_start');
    now += 2100;
    trace.mark('first_audio_chunk_received');
    now += 200;
    trace.mark('assistant_audio_play_start');
    now += 2000;
    trace.mark('assistant_audio_play_end');
    now += 350;
    trace.mark('mic_ready');
    const json = trace.toJSON();
    expect(json.derived.pauseCandidateToConfirmedMs).toBe(800);
    expect(json.derived.sttFinalisationMs).toBe(900);
    expect(json.derived.submitToFirstAudioChunkMs).toBe(2100);
    expect(json.derived.firstAudioChunkToPlayMs).toBe(200);
    expect(json.derived.vadToPlaybackMs).toBe(3250);
    expect(json.derived.playbackToMicReadyMs).toBe(350);
    expect(json.derived.stopToNextAudioMs).toBe(3250);
    performance.now.mockRestore();
  });

  it('uses ordered event pairs and does not cross-match separate turns', () => {
    const derived = buildVoiceLatencyDerived([
      { name: 'pause_candidate_start', atMs: 100 },
      { name: 'unrelated', atMs: 100000 },
      { name: 'pause_confirmed', atMs: 100850 },
      { name: 'pause_candidate_start', atMs: 200000 },
    ]);

    expect(derived.pauseCandidateToConfirmedMs).toBe(100750);
    expect(derived.submitToPlaybackStartMs).toBeNull();
  });

  it('returns null instead of fake 0 ms when an end event is missing', () => {
    const derived = buildVoiceLatencyDerived([
      { name: 'auto_submit_start', atMs: 100 },
      { name: 'first_audio_chunk_received', atMs: 500 },
    ]);

    expect(derived.submitToFirstAudioChunkMs).toBe(400);
    expect(derived.submitToPlaybackStartMs).toBeNull();
    expect(derived.vadToPlaybackMs).toBeNull();
  });
});
