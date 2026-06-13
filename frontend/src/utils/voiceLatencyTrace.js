const getEventKey = (event) => event?.key || event?.name;

const minFinite = (...values) => {
  const nums = values
    .filter((value) => value !== null && value !== undefined)
    .map(Number)
    .filter((value) => Number.isFinite(value));
  return nums.length ? Math.min(...nums) : null;
};

const matchesEvent = (event, name, scope = {}) => {
  if (!event || getEventKey(event) !== name) return false;
  if (scope.turnId && event.turnId !== scope.turnId) return false;
  return true;
};

export function createVoiceLatencyTrace(meta = {}) {
  const start = performance.now();
  const events = [];

  const mark = (name, extra = {}) => {
    const at = performance.now();
    const event = {
      name,
      atMs: Math.round(at - start),
      absoluteMs: Math.round(at),
      traceId: meta.traceId,
      turnId: extra.turnId || meta.turnId || null,
      ...extra,
    };
    events.push(event);
    return event;
  };

  const scopedEvents = (scope = {}) => events.filter((event) => {
    if (scope.turnId && event.turnId !== scope.turnId) return false;
    return true;
  });

  const duration = (from, to, scope = {}) => {
    const visibleEvents = scopedEvents(scope);
    const startEvent = visibleEvents.find((event) => matchesEvent(event, from, scope));
    const endEvent = visibleEvents.find((event) => matchesEvent(event, to, scope));
    if (!startEvent || !endEvent) return null;
    return Math.max(0, endEvent.atMs - startEvent.atMs);
  };

  const toJSON = () => {
    const turnScope = meta.turnId ? { turnId: meta.turnId } : {};
    const speechEndToAiSpeechStartMs = duration('vad_speech_end', 'assistant_audio_play_start', turnScope);
    const acknowledgementToAiSpeechStartMs = duration('latency_acknowledgement_play_start', 'assistant_audio_play_start', turnScope);
    return {
      ...meta,
      totalMs: Math.round(performance.now() - start),
      events: [...events],
      derived: {
        // Product-facing target: user finished speaking to AI voice playback start.
        speechEndToAiSpeechStartMs,
        acknowledgementToAiSpeechStartMs,
        effectiveQuestionGapMs: minFinite(speechEndToAiSpeechStartMs, acknowledgementToAiSpeechStartMs),
        stopToNextAudioMs: speechEndToAiSpeechStartMs,
        vadToPlaybackMs: speechEndToAiSpeechStartMs,

        // Debug-only breakdown.
        stopToSubmitMs: duration('vad_speech_end', 'auto_submit_start', turnScope),
        submitToResponseMs: duration('auto_submit_start', 'auto_submit_response', turnScope),
        submitToFirstAudioChunkMs: duration('auto_submit_start', 'first_audio_chunk_received', turnScope),
        submitToPlaybackStartMs: duration('auto_submit_start', 'assistant_audio_play_start', turnScope),
        sttFinalisationMs: duration('stt_stop_sent', 'final_transcript_received', turnScope),
        firstAudioChunkToPlayMs: duration('first_audio_chunk_received', 'assistant_audio_play_start', turnScope),
        pauseCandidateToConfirmedMs: duration('vad_pause_candidate', 'vad_speech_end', turnScope),
        playbackToMicReadyMs: duration('assistant_audio_play_end', 'mic_ready', turnScope),
        audioPlaybackMs: duration('assistant_audio_play_start', 'assistant_audio_play_end', turnScope),
        audioGapMs: duration('assistant_audio_play_end', 'mic_ready', turnScope),
      },
    };
  };

  return { mark, duration, toJSON };
}
