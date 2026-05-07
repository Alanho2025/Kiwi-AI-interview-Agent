const GOOD_RTT_MS = 220;
const WARNING_RTT_MS = 450;
const GOOD_FIRST_AUDIO_MS = 2500;
const WARNING_FIRST_AUDIO_MS = 4500;
const WARNING_JITTER_MS = 140;

export const VOICE_NETWORK_STATUS = {
  GOOD: 'good',
  WARNING: 'warning',
  POOR: 'poor',
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const assessVoiceNetworkQuality = ({
  rttMs = null,
  jitterMs = null,
  socketOpenMs = null,
  firstAudioDelayMs = null,
  consecutiveSlowTurns = 0,
} = {}) => {
  const rtt = toFiniteNumber(rttMs);
  const jitter = toFiniteNumber(jitterMs);
  const socketOpen = toFiniteNumber(socketOpenMs);
  const firstAudio = toFiniteNumber(firstAudioDelayMs);
  const slowTurns = Math.max(0, Number(consecutiveSlowTurns) || 0);

  if (
    slowTurns >= 2 ||
    (rtt != null && rtt > WARNING_RTT_MS) ||
    (jitter != null && jitter > WARNING_JITTER_MS) ||
    (firstAudio != null && firstAudio > WARNING_FIRST_AUDIO_MS) ||
    (socketOpen != null && socketOpen > 2500)
  ) {
    return {
      status: VOICE_NETWORK_STATUS.POOR,
      title: 'Connection is slowing voice responses',
      message: 'KiwiCoach may take longer to reply. Keep answers concise, or switch to text for this question if the delay continues.',
      rttMs: rtt,
      jitterMs: jitter,
      firstAudioDelayMs: firstAudio,
      consecutiveSlowTurns: slowTurns,
    };
  }

  if (
    slowTurns === 1 ||
    (rtt != null && rtt > GOOD_RTT_MS) ||
    (firstAudio != null && firstAudio > GOOD_FIRST_AUDIO_MS) ||
    (socketOpen != null && socketOpen > 1200)
  ) {
    return {
      status: VOICE_NETWORK_STATUS.WARNING,
      title: 'Voice connection is a little slow',
      message: 'The interview can continue, but replies may have a short delay.',
      rttMs: rtt,
      jitterMs: jitter,
      firstAudioDelayMs: firstAudio,
      consecutiveSlowTurns: slowTurns,
    };
  }

  return {
    status: VOICE_NETWORK_STATUS.GOOD,
    title: 'Voice connection steady',
    message: 'Realtime voice responses are within the expected range.',
    rttMs: rtt,
    jitterMs: jitter,
    firstAudioDelayMs: firstAudio,
    consecutiveSlowTurns: slowTurns,
  };
};
