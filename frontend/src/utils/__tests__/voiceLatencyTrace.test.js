import { describe, expect, it, vi } from 'vitest';
import { createVoiceLatencyTrace } from '../voiceLatencyTrace.js';

describe('createVoiceLatencyTrace', () => {
  it('calculates key voice durations', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const trace = createVoiceLatencyTrace({ sessionId: 's1' });
    trace.mark('vad_speech_end');
    now += 300;
    trace.mark('auto_submit_start');
    now += 1200;
    trace.mark('auto_submit_response');
    now += 700;
    trace.mark('assistant_audio_play_start');
    const json = trace.toJSON();
    expect(json.derived.stopToSubmitMs).toBe(300);
    expect(json.derived.submitToResponseMs).toBe(1200);
    expect(json.derived.stopToNextAudioMs).toBe(2200);
    performance.now.mockRestore();
  });
});
