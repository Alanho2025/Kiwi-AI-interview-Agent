/**
 * File responsibility: Realtime speech WebSocket hook.
 * Main responsibilities:
 * - Connect the browser to the backend live STT endpoint.
 * - Send PCM audio chunks as binary frames.
 * - Convert backend transcript events into React state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;

export const buildSocketUrl = ({ sessionId, language = DEFAULT_LANGUAGE, sampleRate = DEFAULT_SAMPLE_RATE }) => {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const encodedSessionId = encodeURIComponent(sessionId);
  const livePath = `${apiBase}/interview/${encodedSessionId}/voice/live`;
  const baseUrl = apiBase.startsWith('http')
    ? new URL(livePath)
    : new URL(livePath, window.location.origin);
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  baseUrl.searchParams.set('language', language);
  baseUrl.searchParams.set('sampleRate', String(sampleRate));
  const token = window.localStorage?.getItem?.('authToken') || window.localStorage?.getItem?.('kiwi_auth_token') || '';
  if (token) baseUrl.searchParams.set('token', token);
  return baseUrl.toString();
};

export function useRealtimeSpeechSocket({ onLatencyEvent } = {}) {
  const socketRef = useRef(null);
  const [socketState, setSocketState] = useState('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState(null);
  const [socketError, setSocketError] = useState(null);
  const [latency, setLatency] = useState({});
  const startedAtRef = useRef(null);
  const lastPartialTranscriptRef = useRef('');
  const lastFinalTranscriptRef = useRef(null);
  const callbacksRef = useRef({ onLatencyEvent });
  callbacksRef.current = { onLatencyEvent };

  const resetTranscript = useCallback(() => {
    setPartialTranscript('');
    setFinalTranscript(null);
    setSocketError(null);
    setLatency({});
    lastPartialTranscriptRef.current = '';
    lastFinalTranscriptRef.current = null;
  }, []);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socketRef.current = null;
    try { socket.close(); } catch {}
  }, []);

  const connect = useCallback(({ sessionId, language = DEFAULT_LANGUAGE, sampleRate = DEFAULT_SAMPLE_RATE }) => new Promise((resolve, reject) => {
    if (!sessionId) {
      reject(new Error('Missing session ID for realtime voice socket.'));
      return;
    }

    closeSocket();
    resetTranscript();
    startedAtRef.current = performance.now();
    setSocketState('connecting');

    const socket = new WebSocket(buildSocketUrl({ sessionId, language, sampleRate }));
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketState('open');
      const socketOpenMs = Math.round(performance.now() - startedAtRef.current);
      setLatency((current) => ({ ...current, socketOpenMs }));
      callbacksRef.current.onLatencyEvent?.('stt_socket_open', { socketOpenMs });
      resolve(socket);
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(String(event.data || '{}'));
      if (payload.type === 'ready') {
        setSocketState('ready');
        callbacksRef.current.onLatencyEvent?.('stt_socket_ready', { payload });
        return;
      }
      if (payload.type === 'partial_transcript') {
        const partialText = payload.text || payload.displayText || payload.normalizedText || payload.rawText || '';
        lastPartialTranscriptRef.current = partialText;
        setPartialTranscript(partialText);
        setLatency((current) => current.firstPartialMs ? current : ({ ...current, firstPartialMs: Math.round(performance.now() - startedAtRef.current) }));
        callbacksRef.current.onLatencyEvent?.('partial_transcript_received', { textLength: String(partialText).length });
        return;
      }
      if (payload.type === 'final_transcript') {
        const textToAppend = payload.displayText || payload.normalizedText || payload.text || payload.rawText || '';
        if (textToAppend) {
          const previousFinal = lastFinalTranscriptRef.current;
          const accumulatedText = previousFinal?.displayText
            ? `${previousFinal.displayText} ${textToAppend}`
            : textToAppend;

          const accumulatedPayload = {
            ...payload,
            displayText: accumulatedText,
            normalizedText: accumulatedText,
            rawText: accumulatedText,
          };

          lastFinalTranscriptRef.current = accumulatedPayload;
          setFinalTranscript(accumulatedPayload);
        }
        setPartialTranscript('');
        const finalTranscriptMs = Math.round(performance.now() - startedAtRef.current);
        setLatency((current) => ({ ...current, finalTranscriptMs }));
        callbacksRef.current.onLatencyEvent?.('final_transcript_received', {
          finalTranscriptMs,
          confidence: payload.confidence ?? null,
          confidenceStatus: payload.confidenceStatus ?? null,
          source: payload.source || 'azure_realtime',
          textLength: String(textToAppend || '').length,
        });
        return;
      }
      if (payload.type === 'speech_error') {
        const message = payload.errorDetails || payload.reason || 'Realtime speech recognition failed.';
        setSocketError(message);
        setSocketState('error');
        return;
      }
      if (payload.type === 'stopped') {
        setSocketState('stopped');
      }
    };

    socket.onerror = () => {
      setSocketError('Realtime voice socket connection failed. Use WAV fallback if needed.');
      setSocketState('error');
      reject(new Error('Realtime voice socket connection failed.'));
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setSocketState((current) => (current === 'error' ? current : 'closed'));
    };
  }), [closeSocket, resetTranscript]);

  const sendAudioChunk = useCallback((arrayBuffer) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !arrayBuffer) return;
    socket.send(arrayBuffer);
  }, []);

  const sendStop = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'stop' }));
  }, []);

  const getBestAvailableTranscript = useCallback(() => {
    const finalTurn = lastFinalTranscriptRef.current;
    if (finalTurn) {
      const displayText = String(finalTurn.displayText || finalTurn.normalizedText || finalTurn.rawText || finalTurn.text || '').trim();
      if (displayText) return { ...finalTurn, displayText, source: 'final' };
    }

    const partialText = String(lastPartialTranscriptRef.current || '').trim();
    if (partialText) {
      return {
        type: 'final_transcript',
        displayText: partialText,
        normalizedText: partialText,
        rawText: partialText,
        confidence: null,
        confidenceStatus: 'partial_fallback',
        source: 'partial_fallback',
        fallback: true,
      };
    }

    return null;
  }, []);

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
    sendStop,
    getBestAvailableTranscript,
    resetTranscript,
  }), [
    socketState,
    partialTranscript,
    finalTranscript,
    socketError,
    latency,
    connect,
    closeSocket,
    sendAudioChunk,
    sendStop,
    getBestAvailableTranscript,
    resetTranscript,
  ]);
}
