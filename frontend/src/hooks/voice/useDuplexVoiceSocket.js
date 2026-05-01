/**
 * File responsibility: Duplex voice WebSocket hook.
 * Main responsibilities:
 * - Connect Voice Mode to the product-level duplex backend socket.
 * - Send microphone PCM chunks and control events.
 * - Receive STT captions, assistant text, TTS chunks, barge-in ACK, and final session updates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_VOICE_NAME = 'en-NZ-MollyNeural';

export const buildDuplexSocketUrl = ({
  sessionId,
  language = DEFAULT_LANGUAGE,
  sampleRate = DEFAULT_SAMPLE_RATE,
  voiceName = DEFAULT_VOICE_NAME,
}) => {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const encodedSessionId = encodeURIComponent(sessionId);
  const duplexPath = `${apiBase}/interview/${encodedSessionId}/voice/duplex`;
  const baseUrl = apiBase.startsWith('http')
    ? new URL(duplexPath)
    : new URL(duplexPath, window.location.origin);
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  baseUrl.searchParams.set('language', language);
  baseUrl.searchParams.set('sampleRate', String(sampleRate));
  baseUrl.searchParams.set('voiceName', voiceName);
  const token = window.localStorage?.getItem?.('authToken') || window.localStorage?.getItem?.('kiwi_auth_token') || '';
  if (token) baseUrl.searchParams.set('token', token);
  return baseUrl.toString();
};

export function useDuplexVoiceSocket({
  onAudioChunk,
  onAssistantText,
  onTurnDone,
  onBargeInAck,
  onSpeechDone,
} = {}) {
  const socketRef = useRef(null);
  const [socketState, setSocketState] = useState('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState(null);
  const [socketError, setSocketError] = useState(null);
  const [latency, setLatency] = useState({});
  const startedAtRef = useRef(0);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socketRef.current = null;
    try { socket.close(); } catch {}
  }, []);

  const sendJson = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const connect = useCallback(({ sessionId, language = DEFAULT_LANGUAGE, sampleRate = DEFAULT_SAMPLE_RATE, voiceName = DEFAULT_VOICE_NAME }) => new Promise((resolve, reject) => {
    if (!sessionId) {
      reject(new Error('Missing session ID for duplex voice socket.'));
      return;
    }
    closeSocket();
    setSocketError(null);
    setPartialTranscript('');
    setFinalTranscript(null);
    setLatency({});
    setSocketState('connecting');
    startedAtRef.current = performance.now();

    const socket = new WebSocket(buildDuplexSocketUrl({ sessionId, language, sampleRate, voiceName }));
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketState('open');
      setLatency((current) => ({ ...current, socketOpenMs: Math.round(performance.now() - startedAtRef.current) }));
      socket.send(JSON.stringify({ type: 'session_start', language, sampleRate, voiceName }));
      resolve(socket);
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(String(event.data || '{}'));
      if (payload.type === 'session_ready') {
        setSocketState('ready');
        return;
      }
      if (payload.type === 'listening_started') {
        setSocketState('listening');
        return;
      }
      if (payload.type === 'stt_partial' || payload.type === 'partial_transcript') {
        const text = payload.text || payload.displayText || payload.normalizedText || payload.rawText || '';
        setPartialTranscript(text);
        setLatency((current) => current.firstPartialMs ? current : ({ ...current, firstPartialMs: Math.round(performance.now() - startedAtRef.current) }));
        return;
      }
      if (payload.type === 'stt_final' || payload.type === 'final_transcript') {
        const text = payload.displayText || payload.normalizedText || payload.text || payload.rawText || '';
        const finalPayload = { ...payload, displayText: text, normalizedText: text, rawText: text };
        setFinalTranscript(finalPayload);
        setPartialTranscript('');
        setLatency((current) => ({ ...current, finalTranscriptMs: Math.round(performance.now() - startedAtRef.current) }));
        return;
      }
      if (payload.type === 'assistant_text_delta') {
        onAssistantText?.(payload);
        return;
      }
      if (payload.type === 'tts_audio_chunk') {
        onAudioChunk?.(payload);
        return;
      }
      if (payload.type === 'assistant_speech_done') {
        onSpeechDone?.(payload);
        return;
      }
      if (payload.type === 'barge_in_ack') {
        onBargeInAck?.(payload);
        return;
      }
      if (payload.type === 'turn_done') {
        onTurnDone?.(payload);
        return;
      }
      if (payload.type === 'error' || payload.type === 'speech_error') {
        setSocketError(payload.message || payload.errorDetails || payload.reason || 'Duplex voice failed.');
        setSocketState('error');
      }
    };

    socket.onerror = () => {
      setSocketError('Duplex voice socket connection failed.');
      setSocketState('error');
      reject(new Error('Duplex voice socket connection failed.'));
    };

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      setSocketState((current) => (current === 'error' ? current : 'closed'));
    };
  }), [closeSocket, onAssistantText, onAudioChunk, onBargeInAck, onSpeechDone, onTurnDone]);

  const sendAudioChunk = useCallback((arrayBuffer) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !arrayBuffer) return;
    socket.send(arrayBuffer);
  }, []);

  const sendSpeechStart = useCallback(() => sendJson({ type: 'speech_start', clientTimestamp: Date.now() }), [sendJson]);
  const sendSpeechEnd = useCallback((vad = null) => sendJson({ type: 'speech_end', vad, clientTimestamp: Date.now() }), [sendJson]);
  const sendBargeIn = useCallback((reason = 'user_started_speaking') => sendJson({ type: 'barge_in', reason, clientTimestamp: Date.now() }), [sendJson]);
  const speakText = useCallback((text) => sendJson({ type: 'speak_text', text, clientTimestamp: Date.now() }), [sendJson]);
  const stopSession = useCallback(() => sendJson({ type: 'session_stop', clientTimestamp: Date.now() }), [sendJson]);

  useEffect(() => () => closeSocket(), [closeSocket]);

  return useMemo(() => ({
    socketState,
    partialTranscript,
    finalTranscript,
    socketError,
    latency,
    connect,
    closeSocket,
    sendAudioChunk,
    sendSpeechStart,
    sendSpeechEnd,
    sendBargeIn,
    speakText,
    stopSession,
  }), [socketState, partialTranscript, finalTranscript, socketError, latency, connect, closeSocket, sendAudioChunk, sendSpeechStart, sendSpeechEnd, sendBargeIn, speakText, stopSession]);
}
