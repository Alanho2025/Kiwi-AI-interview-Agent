const isFiniteNumber = (value) => Number.isFinite(Number(value));

const safeDuration = (startEvent, endEvent) => {
  if (!startEvent || !endEvent) return null;
  const value = Number(endEvent.atMs) - Number(startEvent.atMs);
  if (!isFiniteNumber(value) || value < 0) return null;
  return Math.round(value);
};

export const findFirstOrderedEventPair = (events = [], from, to) => {
  if (!Array.isArray(events)) return null;
  const startIndex = events.findIndex((event) => event?.name === from);
  if (startIndex < 0) return null;
  const endIndex = events.findIndex((event, index) => index > startIndex && event?.name === to);
  if (endIndex < 0) return null;
  return [events[startIndex], events[endIndex]];
};

export const findLatestOrderedEventPair = (events = [], from, to) => {
  if (!Array.isArray(events)) return null;
  for (let endIndex = events.length - 1; endIndex >= 0; endIndex -= 1) {
    if (events[endIndex]?.name !== to) continue;
    for (let startIndex = endIndex - 1; startIndex >= 0; startIndex -= 1) {
      if (events[startIndex]?.name === from) return [events[startIndex], events[endIndex]];
    }
  }
  return null;
};

const durationFirstPair = (events, from, to) => safeDuration(...(findFirstOrderedEventPair(events, from, to) || []));
const durationLatestPair = (events, from, to) => safeDuration(...(findLatestOrderedEventPair(events, from, to) || []));

export function buildVoiceLatencyDerived(events = []) {
  const duration = (from, to, { latest = false } = {}) => (
    latest ? durationLatestPair(events, from, to) : durationFirstPair(events, from, to)
  );

  return {
    micArmMs: duration('mic_arm_start', 'mic_ready'),
    speechDurationMs: duration('vad_speech_start', 'vad_speech_end'),
    pauseCandidateToConfirmedMs: duration('pause_candidate_start', 'pause_confirmed'),
    vadToStopSentMs: duration('vad_speech_end', 'stt_stop_sent'),
    sttFinalisationMs: duration('stt_stop_sent', 'final_transcript_received'),
    finalTranscriptToSubmitMs: duration('final_transcript_received', 'auto_submit_start'),
    submitToFirstSseEventMs: duration('auto_submit_start', 'sse_first_event_received'),
    submitToFirstAudioChunkMs: duration('auto_submit_start', 'first_audio_chunk_received'),
    submitToPlaybackStartMs: duration('auto_submit_start', 'assistant_audio_play_start'),
    firstAudioChunkToPlayMs: duration('first_audio_chunk_received', 'assistant_audio_play_start'),
    vadToPlaybackMs: duration('vad_speech_end', 'assistant_audio_play_start'),
    audioPlaybackMs: duration('assistant_audio_play_start', 'assistant_audio_play_end', { latest: true }),
    playbackToMicReadyMs: duration('assistant_audio_play_end', 'mic_ready', { latest: true }),

    // Backward-compatible aliases used by older tests and console output.
    stopToSubmitMs: duration('vad_speech_end', 'auto_submit_start'),
    submitToResponseMs: duration('auto_submit_start', 'auto_submit_response'),
    stopToNextAudioMs: duration('vad_speech_end', 'assistant_audio_play_start'),
    audioGapMs: duration('assistant_audio_play_end', 'mic_ready', { latest: true }),
  };
}

export function createVoiceLatencyTrace(meta = {}) {
  const start = performance.now();
  const events = [];
  const traceId = meta.traceId || `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAtIso = meta.startedAtIso || new Date().toISOString();

  const mark = (name, extra = {}) => {
    const at = performance.now();
    const event = {
      name,
      atMs: Math.round(at - start),
      absoluteMs: Math.round(at),
      ...extra,
    };
    events.push(event);
    return event;
  };

  const duration = (from, to, options = {}) => (
    options.latest ? durationLatestPair(events, from, to) : durationFirstPair(events, from, to)
  );

  const toJSON = () => ({
    ...meta,
    traceId,
    startedAtIso,
    totalMs: Math.round(performance.now() - start),
    events: [...events],
    derived: buildVoiceLatencyDerived(events),
  });

  return { mark, duration, toJSON, traceId, startedAtIso };
}
