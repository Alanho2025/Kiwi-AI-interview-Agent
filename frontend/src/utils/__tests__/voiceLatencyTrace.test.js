import { describe, expect, it, vi } from 'vitest';
import { createVoiceLatencyTrace } from '../voiceLatencyTrace.js';

describe('createVoiceLatencyTrace', () => {
  it('calculates one voice turn target latency', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const trace = createVoiceLatencyTrace({ sessionId: 's1', turnId: 't1' });

    trace.mark('vad_speech_end', { turnId: 't1' });
    now += 300;
    trace.mark('auto_submit_start', { turnId: 't1' });
    now += 1200;
    trace.mark('auto_submit_response', { turnId: 't1' });
    now += 700;
    trace.mark('assistant_audio_play_start', { turnId: 't1' });

    const json = trace.toJSON();
    expect(json.derived.stopToSubmitMs).toBe(300);
    expect(json.derived.submitToResponseMs).toBe(1200);
    expect(json.derived.speechEndToAiSpeechStartMs).toBe(2200);
    expect(json.derived.stopToNextAudioMs).toBe(2200);
    performance.now.mockRestore();
  });

  it('does not mix timing events from different turns', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const trace = createVoiceLatencyTrace({ sessionId: 's1', turnId: 't2' });

    trace.mark('vad_speech_end', { turnId: 't1' });
    now += 100000;
    trace.mark('assistant_audio_play_start', { turnId: 't1' });
    now += 100;
    trace.mark('vad_speech_end', { turnId: 't2' });
    now += 2500;
    trace.mark('assistant_audio_play_start', { turnId: 't2' });

    expect(trace.toJSON().derived.speechEndToAiSpeechStartMs).toBe(2500);
    performance.now.mockRestore();
  });
});
