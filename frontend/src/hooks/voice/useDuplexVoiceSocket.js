/**
 * File responsibility: Duplex voice WebSocket hook.
 * Main responsibilities:
 * - Connect Voice Mode to the product-level duplex backend socket.
 * - Send microphone PCM chunks and control events.
 * - Receive STT captions, assistant text, TTS chunks, barge-in ACK, and final session updates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildApiWebSocketUrl, getStoredAuthToken } from '../../api/client.js';

const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_VOICE_NAME = 'en-NZ-MollyNeural';

export const buildDuplexSocketUrl = ({
  sessionId,
  language = DEFAULT_LANGUAGE,
  sampleRate = DEFAULT_SAMPLE_RATE,
  voiceName = DEFAULT_VOICE_NAME,
}) => {
  const encodedSessionId = encodeURIComponent(sessionId);
  const baseUrl = buildApiWebSocketUrl(`interview/${encodedSessionId}/voice/duplex`);
  baseUrl.searchParams.set('language', language);
  baseUrl.searchParams.set('sampleRate', String(sampleRate));
  baseUrl.searchParams.set('voiceName', voiceName);
  const token = getStoredAuthToken();
  if (token) {
    baseUrl.searchParams.set('token', token);
  }
  return baseUrl.toString();
};

export function useDuplexVoiceSocket({
  onAudioChunk,
  onAssistantText,
  onTurnDone,
  onBargeInAck,
  onSpeechDone,
  onTranscriptRejected,
} = {}) {
  const socketRef = useRef(null);
  const [socketState, setSocketState] = useState('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState(null);
  const [socketError, setSocketError] = useState(null);
  const [latency, setLatency] = useState({});
  const startedAtRef = useRef(0);
  const pingSentAtRef = useRef(null);
  const rttSamplesRef = useRef([]);
  const chunksSentRef = useRef(0);

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
    pingSentAtRef.current = null;
    rttSamplesRef.current = [];
    chunksSentRef.current = 0;
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
      if (payload.type === 'pong') {
        const sentAt = pingSentAtRef.current;
        if (sentAt == null) return;
        const rttMs = Math.round(performance.now() - sentAt);
        pingSentAtRef.current = null;
        rttSamplesRef.current = [...rttSamplesRef.current.slice(-5), rttMs];
        const samples = rttSamplesRef.current;
        const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        const jitterMs = Math.round(samples.reduce((sum, value) => sum + Math.abs(value - average), 0) / samples.length);
        setLatency((current) => ({ ...current, networkRttMs: rttMs, networkJitterMs: jitterMs }));
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
      if (payload.type === 'transcript_rejected') {
        onTranscriptRejected?.(payload);
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
        console.error('[Voice Error] Received error payload from backend:', payload);
        setSocketError(payload.message || payload.errorDetails || payload.reason || 'Duplex voice failed.');
        setSocketState('error');
      }
    };

    socket.onerror = (event) => {
      console.error('[Voice Error] WebSocket native onerror triggered:', event);
      setSocketError('Duplex voice socket connection failed.');
      setSocketState('error');
      reject(new Error('Duplex voice socket connection failed.'));
    };

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      setSocketState((current) => (current === 'error' ? current : 'closed'));
    };
  }), [closeSocket, onAssistantText, onAudioChunk, onBargeInAck, onSpeechDone, onTranscriptRejected, onTurnDone]);

  const sendAudioChunk = useCallback((arrayBuffer) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !arrayBuffer) return;
    if (chunksSentRef.current === 0) {
      console.log(`[FRONTEND-STT-TRACE] Sending FIRST audio chunk (${arrayBuffer.byteLength} bytes) to backend WebSocket.`);
    }
    chunksSentRef.current++;
    socket.send(arrayBuffer);
  }, []);

  const sendSpeechStart = useCallback(() => sendJson({ type: 'speech_start', clientTimestamp: Date.now() }), [sendJson]);
  const sendSpeechEnd = useCallback((vad = null) => sendJson({ type: 'speech_end', vad, clientTimestamp: Date.now() }), [sendJson]);
  const sendBargeIn = useCallback((reason = 'user_started_speaking') => sendJson({ type: 'barge_in', reason, clientTimestamp: Date.now() }), [sendJson]);
  const speakText = useCallback((text) => sendJson({ type: 'speak_text', text, clientTimestamp: Date.now() }), [sendJson]);
  const sendPing = useCallback(() => {
    pingSentAtRef.current = performance.now();
    return sendJson({ type: 'ping', clientTimestamp: Date.now() });
  }, [sendJson]);
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
    sendPing,
    stopSession,
  }), [socketState, partialTranscript, finalTranscript, socketError, latency, connect, closeSocket, sendAudioChunk, sendSpeechStart, sendSpeechEnd, sendBargeIn, speakText, sendPing, stopSession]);
}
