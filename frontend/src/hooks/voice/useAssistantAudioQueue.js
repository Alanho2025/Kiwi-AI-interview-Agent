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

export function useAssistantAudioQueue({ onPlaybackStart, onPlaybackEnd, onQueueDrained } = {}) {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const callbackRef = useRef({ onPlaybackStart, onPlaybackEnd, onQueueDrained });
  const [assistantAudioUrl, setAssistantAudioUrl] = useState('');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);

  useEffect(() => {
    callbackRef.current = { onPlaybackStart, onPlaybackEnd, onQueueDrained };
  }, [onPlaybackStart, onPlaybackEnd, onQueueDrained]);

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
      .then(() => callbackRef.current.onPlaybackStart?.())
      .catch(() => {
        isPlayingRef.current = false;
        setIsAssistantSpeaking(false);
        callbackRef.current.onQueueDrained?.();
      });
    return () => { audio.onended = null; };
  }, [assistantAudioUrl, playNext]);

  useEffect(() => () => clearQueue(), [clearQueue]);

  return useMemo(() => ({
    audioRef,
    assistantAudioUrl,
    isAssistantSpeaking,
    enqueueAudioChunk,
    clearQueue,
  }), [assistantAudioUrl, isAssistantSpeaking, enqueueAudioChunk, clearQueue]);
}
