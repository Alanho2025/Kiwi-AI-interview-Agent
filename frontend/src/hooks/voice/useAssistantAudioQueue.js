/**
 * File responsibility: Assistant audio playback queue.
 * Main responsibilities:
 * - Play streamed TTS chunks in order.
 * - Support immediate cancellation for duplex barge-in.
 * - Keep browser audio object URL cleanup isolated from the voice session hook.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const base64ToAudioUrl = (base64, contentType = 'audio/mpeg') => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const blob = new Blob([bytes], { type: contentType });
  return URL.createObjectURL(blob);
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

export function useAssistantAudioQueue({ onPlaybackStart, onPlaybackEnd, onQueueDrained, onPlaybackError } = {}) {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const callbackRef = useRef({ onPlaybackStart, onPlaybackEnd, onQueueDrained, onPlaybackError });
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
    queueRef.current.push(chunk);
    queueRef.current.sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
    if (!isPlayingRef.current) playNext();
  }, [playNext]);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    isPlayingRef.current = false;
    setIsAssistantSpeaking(false);
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current.removeAttribute('src');
    }
    setAssistantAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
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
      URL.revokeObjectURL(assistantAudioUrl);
      setAssistantAudioUrl('');
      playNext();
    };
    audio.play?.()
      .then(() => {
        setPlaybackError('');
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
    clearQueue,
  }), [assistantAudioUrl, isAssistantSpeaking, playbackError, unlockAudio, enqueueAudioChunk, clearQueue]);
}
