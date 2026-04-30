import { describe, expect, it } from 'vitest';
import { computeDurationBetweenMarks } from '../../../src/utils/voiceLatencyMetricUtils.js';

describe('client audio playback metric contract', () => {
  it('computes playback duration from same-turn audio start and end markers only', () => {
    const events = [
      { step: 'voice_loop_start', msFromStart: 0, turnId: 't1' },
      { step: 'assistant_audio_play_start', msFromStart: 1000, turnId: 't1' },
      { step: 'assistant_audio_play_end', msFromStart: 2600, turnId: 't1' },
      { step: 'assistant_audio_play_end', msFromStart: 999999, turnId: 'previous-turn' },
    ];

    expect(computeDurationBetweenMarks({
      events,
      startStep: 'assistant_audio_play_start',
      endStep: 'assistant_audio_play_end',
      turnId: 't1',
    })).toBe(1600);
  });

  it('does not compute playback when markers are missing or crossed across turns', () => {
    const events = [
      { step: 'assistant_audio_play_start', msFromStart: 1000, turnId: 't1' },
      { step: 'assistant_audio_play_end', msFromStart: 3000, turnId: 't2' },
    ];

    expect(computeDurationBetweenMarks({
      events,
      startStep: 'assistant_audio_play_start',
      endStep: 'assistant_audio_play_end',
      turnId: 't1',
    })).toBeNull();
  });
});
