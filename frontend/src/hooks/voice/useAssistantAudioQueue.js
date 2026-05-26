/**
 * File responsibility: Assistant audio playback queue.
 * Main responsibilities:
 * - Play full-buffer TTS chunks in order.
 * - Play true streaming TTS chunks through MediaSource when supported.
 * - Support immediate cancellation for duplex barge-in.
 * - Keep browser audio object URL cleanup isolated from the voice session hook.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const base64ToAudioUrl = (base64, contentType = 'audio/mpeg') => {
  const blob = new Blob([base64ToBytes(base64)], { type: contentType });
  return URL.createObjectURL(blob);
};

const normalizeMimeType = (contentType = 'audio/mpeg') => String(contentType || 'audio/mpeg').split(';')[0].trim() || 'audio/mpeg';

const canUseMediaSource = (contentType = 'audio/mpeg') => {
  if (typeof window === 'undefined' || typeof MediaSource === 'undefined') return false;
  const mimeType = normalizeMimeType(contentType);
  try {
    return MediaSource.isTypeSupported?.(mimeType) || mimeType === 'audio/mpeg';
  } catch {
    return false;
  }
};

const buildSilentWavDataUrl = () => {
  const sampleRate = 8000;
  const samples = 80;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true);

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
};

const getPlaybackErrorMessage = (error) => {
  const name = String(error?.name || '').trim();
  if (name === 'NotAllowedError') {
    return 'Audio playback was blocked by the browser. Tap Start Voice again, or allow audio playback for this site.';
  }
  return error?.message || 'Assistant audio playback failed.';
};

const buildEmptyStreamState = () => ({
  mediaSource: null,
  sourceBuffer: null,
  url: '',
  pending: [],
  done: false,
  started: false,
  contentType: '',
});

export function useAssistantAudioQueue({ onPlaybackStart, onPlaybackEnd, onQueueDrained, onPlaybackError } = {}) {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const callbackRef = useRef({ onPlaybackStart, onPlaybackEnd, onQueueDrained, onPlaybackError });
  const streamRef = useRef(buildEmptyStreamState());
  const [assistantAudioUrl, setAssistantAudioUrl] = useState('');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [playbackError, setPlaybackError] = useState('');

  useEffect(() => {
    callbackRef.current = { onPlaybackStart, onPlaybackEnd, onQueueDrained, onPlaybackError };
  }, [onPlaybackStart, onPlaybackEnd, onQueueDrained, onPlaybackError]);

  const unlockAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return { ok: false, error: 'Audio output is not ready yet.' };

    const originalMuted = audio.muted;
    try {
      audio.muted = true;
      audio.src = buildSilentWavDataUrl();
      audio.load?.();
      await audio.play?.();
      audio.pause?.();
      audio.removeAttribute('src');
      audio.load?.();
      setPlaybackError('');
      return { ok: true };
    } catch (error) {
      const message = getPlaybackErrorMessage(error);
      setPlaybackError(message);
      callbackRef.current.onPlaybackError?.(message);
      return { ok: false, error: message };
    } finally {
      audio.muted = originalMuted;
    }
  }, []);

  const maybeEndStream = useCallback(() => {
    const state = streamRef.current;
    if (!state.mediaSource || !state.done || state.pending.length || state.sourceBuffer?.updating) return;
    if (state.mediaSource.readyState !== 'open') return;
    try {
      state.mediaSource.endOfStream();
    } catch {}
  }, []);

  const appendPendingStreamBuffers = useCallback(() => {
    const state = streamRef.current;
    const sourceBuffer = state.sourceBuffer;
    if (!sourceBuffer || sourceBuffer.updating || !state.pending.length) {
      maybeEndStream();
      return;
    }
    const next = state.pending.shift();
    try {
      sourceBuffer.appendBuffer(next);
    } catch (error) {
      const message = getPlaybackErrorMessage(error);
      setPlaybackError(message);
      callbackRef.current.onPlaybackError?.(message);
    }
  }, [maybeEndStream]);

  const ensureStreamPlayback = useCallback((contentType = 'audio/mpeg') => {
    if (streamRef.current.mediaSource) return true;
    if (!canUseMediaSource(contentType)) return false;

    const audio = audioRef.current;
    if (!audio) return false;

    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    const mimeType = normalizeMimeType(contentType);

    streamRef.current = {
      mediaSource,
      sourceBuffer: null,
      url,
      pending: [],
      done: false,
      started: false,
      contentType: mimeType,
    };

    mediaSource.addEventListener('sourceopen', () => {
      const state = streamRef.current;
      if (state.mediaSource !== mediaSource) return;
      try {
        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        sourceBuffer.mode = 'sequence';
        sourceBuffer.addEventListener('updateend', appendPendingStreamBuffers);
        state.sourceBuffer = sourceBuffer;
        appendPendingStreamBuffers();
      } catch (error) {
        const message = getPlaybackErrorMessage(error);
        setPlaybackError(message);
        callbackRef.current.onPlaybackError?.(message);
      }
    }, { once: true });

    isPlayingRef.current = true;
    setIsAssistantSpeaking(true);
    setAssistantAudioUrl(url);
    return true;
  }, [appendPendingStreamBuffers]);

  const playNext = useCallback(() => {
    if (!queueRef.current.length) {
      isPlayingRef.current = false;
      setIsAssistantSpeaking(false);
      callbackRef.current.onQueueDrained?.();
      return;
    }
    const nextChunk = queueRef.current.shift();
    const nextUrl = base64ToAudioUrl(nextChunk.base64, nextChunk.contentType);
    isPlayingRef.current = true;
    setIsAssistantSpeaking(true);
    setAssistantAudioUrl(nextUrl);
  }, []);

  const enqueueAudioChunk = useCallback((chunk) => {
    if (!chunk?.base64) return;

    if (chunk.isStreaming && ensureStreamPlayback(chunk.contentType)) {
      streamRef.current.pending.push(base64ToBytes(chunk.base64));
      appendPendingStreamBuffers();
      return;
    }

    queueRef.current.push(chunk);
    queueRef.current.sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
    if (!isPlayingRef.current) playNext();
  }, [appendPendingStreamBuffers, ensureStreamPlayback, playNext]);

  const finishAudioStream = useCallback(() => {
    const state = streamRef.current;
    if (!state.mediaSource) return;
    state.done = true;
    maybeEndStream();
  }, [maybeEndStream]);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    isPlayingRef.current = false;
    setIsAssistantSpeaking(false);

    const streamUrl = streamRef.current.url;
    try {
      if (streamRef.current.mediaSource?.readyState === 'open') streamRef.current.mediaSource.endOfStream();
    } catch {}
    streamRef.current = buildEmptyStreamState();

    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current.removeAttribute('src');
    }
    setAssistantAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      if (streamUrl && streamUrl !== current) URL.revokeObjectURL(streamUrl);
      return '';
    });
  }, []);

  useEffect(() => {
    if (!assistantAudioUrl || !audioRef.current) return undefined;
    const audio = audioRef.current;
    audio.src = assistantAudioUrl;
    audio.currentTime = 0;
    audio.onended = () => {
      callbackRef.current.onPlaybackEnd?.();
      const streamUrl = streamRef.current.url;
      if (assistantAudioUrl === streamUrl) {
        URL.revokeObjectURL(streamUrl);
        streamRef.current = buildEmptyStreamState();
        isPlayingRef.current = false;
        setIsAssistantSpeaking(false);
        setAssistantAudioUrl('');
        callbackRef.current.onQueueDrained?.();
        return;
      }
      URL.revokeObjectURL(assistantAudioUrl);
      setAssistantAudioUrl('');
      playNext();
    };
    audio.play?.()
      .then(() => {
        setPlaybackError('');
        const state = streamRef.current;
        if (assistantAudioUrl === state.url) {
          if (state.started) return;
          state.started = true;
        }
        callbackRef.current.onPlaybackStart?.();
      })
      .catch((error) => {
        const message = getPlaybackErrorMessage(error);
        isPlayingRef.current = false;
        setIsAssistantSpeaking(false);
        setPlaybackError(message);
        callbackRef.current.onPlaybackError?.(message);
        callbackRef.current.onQueueDrained?.();
      });
    return () => { audio.onended = null; };
  }, [assistantAudioUrl, playNext]);

  useEffect(() => () => clearQueue(), [clearQueue]);

  return useMemo(() => ({
    audioRef,
    assistantAudioUrl,
    isAssistantSpeaking,
    playbackError,
    unlockAudio,
    enqueueAudioChunk,
    finishAudioStream,
    clearQueue,
  }), [assistantAudioUrl, isAssistantSpeaking, playbackError, unlockAudio, enqueueAudioChunk, finishAudioStream, clearQueue]);
}