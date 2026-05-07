import { describe, expect, it } from 'vitest';
import { assessVoiceNetworkQuality, VOICE_NETWORK_STATUS } from '../voiceRuntimeNetwork.js';

describe('assessVoiceNetworkQuality', () => {
  it('keeps normal realtime voice metrics in the good range', () => {
    expect(assessVoiceNetworkQuality({ rttMs: 80, firstAudioDelayMs: 1200 }).status).toBe(VOICE_NETWORK_STATUS.GOOD);
  });

  it('warns when the first assistant audio is slow', () => {
    const result = assessVoiceNetworkQuality({ firstAudioDelayMs: 3200 });
    expect(result.status).toBe(VOICE_NETWORK_STATUS.WARNING);
    expect(result.message).toMatch(/short delay/i);
  });

  it('marks repeated slow turns as poor', () => {
    const result = assessVoiceNetworkQuality({ consecutiveSlowTurns: 2, rttMs: 120 });
    expect(result.status).toBe(VOICE_NETWORK_STATUS.POOR);
    expect(result.message).toMatch(/switch to text/i);
  });
});
