export function createVoiceLatencyTrace(meta = {}) {
  const start = performance.now();
  const events = [];

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

  const duration = (from, to) => {
    const startEvent = events.find((event) => event.name === from);
    const endEvent = [...events].reverse().find((event) => event.name === to);
    if (!startEvent || !endEvent) return null;
    return Math.max(0, endEvent.atMs - startEvent.atMs);
  };

  const toJSON = () => ({
    ...meta,
    totalMs: Math.round(performance.now() - start),
    events: [...events],
    derived: {
      stopToSubmitMs: duration('vad_speech_end', 'auto_submit_start'),
      submitToResponseMs: duration('auto_submit_start', 'auto_submit_response'),
      stopToNextAudioMs: duration('vad_speech_end', 'assistant_audio_play_start'),
      vadToPlaybackMs: duration('vad_speech_end', 'assistant_audio_play_start'),
      submitToFirstAudioChunkMs: duration('auto_submit_start', 'first_audio_chunk_received'),
      submitToPlaybackStartMs: duration('auto_submit_start', 'assistant_audio_play_start'),
      sttFinalisationMs: duration('stt_stop_sent', 'final_transcript_received'),
      firstAudioChunkToPlayMs: duration('first_audio_chunk_received', 'assistant_audio_play_start'),
      pauseCandidateToConfirmedMs: duration('vad_pause_candidate', 'vad_speech_end'),
      playbackToMicReadyMs: duration('assistant_audio_play_end', 'mic_ready'),
      audioPlaybackMs: duration('assistant_audio_play_start', 'assistant_audio_play_end'),
      audioGapMs: duration('assistant_audio_play_end', 'mic_ready'),
    },
  });

  return { mark, duration, toJSON };
}
