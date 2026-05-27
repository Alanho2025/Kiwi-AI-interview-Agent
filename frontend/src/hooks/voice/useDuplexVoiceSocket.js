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
const AUDIO_CHUNK_TRACE_EVERY = 25;

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
  const speechActiveRef = useRef(false);
  const ignoredPreSpeechChunksRef = useRef(0);
  const socketTraceSessionRef = useRef(0);
  const speechTurnTraceRef = useRef(0);
  const ttsChunkReceivedRef = useRef(0);
  const callbacksRef = useRef({
    onAudioChunk,
    onAssistantText,
    onTurnDone,
    onBargeInAck,
    onSpeechDone,
    onTranscriptRejected,
  });

  callbacksRef.current = {
    onAudioChunk,
    onAssistantText,
    onTurnDone,
    onBargeInAck,
    onSpeechDone,
    onTranscriptRejected,
  };

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    console.info('[FRONTEND-WS-TRACE] closeSocket', {
      socketTraceSession: socketTraceSessionRef.current,
      speechTurnTrace: speechTurnTraceRef.current,
      readyState: socket.readyState,
      speechActive: speechActiveRef.current,
      chunksSent: chunksSentRef.current,
      ignoredPreSpeechChunks: ignoredPreSpeechChunksRef.current,
      at: Date.now(),
    });
    socketRef.current = null;
    speechActiveRef.current = false;
    chunksSentRef.current = 0;
    ignoredPreSpeechChunksRef.current = 0;
    try { socket.close(); } catch {}
  }, []);

  const sendJson = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn('[FRONTEND-WS-TRACE] sendJson blocked', {
        type: payload?.type,
        socketTraceSession: socketTraceSessionRef.current,
        readyState: socket?.readyState ?? null,
        at: Date.now(),
      });
      return false;
    }
    console.debug('[FRONTEND-WS-TRACE] outbound_json', {
      socketTraceSession: socketTraceSessionRef.current,
      speechTurnTrace: speechTurnTraceRef.current,
      type: payload?.type,
      payload,
      at: Date.now(),
    });
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const connect = useCallback(({ sessionId, language = DEFAULT_LANGUAGE, sampleRate = DEFAULT_SAMPLE_RATE, voiceName = DEFAULT_VOICE_NAME }) => new Promise((resolve, reject) => {
    if (!sessionId) {
      reject(new Error('Missing session ID for duplex voice socket.'));
      return;
    }
    closeSocket();
    socketTraceSessionRef.current += 1;
    speechTurnTraceRef.current = 0;
    ttsChunkReceivedRef.current = 0;
    console.info('[FRONTEND-WS-TRACE] connect_start', {
      socketTraceSession: socketTraceSessionRef.current,
      sessionId,
      language,
      sampleRate,
      voiceName,
      at: Date.now(),
    });
    setSocketError(null);
    setPartialTranscript('');
    setFinalTranscript(null);
    setLatency({});
    pingSentAtRef.current = null;
    rttSamplesRef.current = [];
    chunksSentRef.current = 0;
    ignoredPreSpeechChunksRef.current = 0;
    speechActiveRef.current = false;
    setSocketState('connecting');
    startedAtRef.current = performance.now();

    const socket = new WebSocket(buildDuplexSocketUrl({ sessionId, language, sampleRate, voiceName }));
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      console.info('[FRONTEND-WS-TRACE] open', {
        socketTraceSession: socketTraceSessionRef.current,
        socketOpenMs: Math.round(performance.now() - startedAtRef.current),
        at: Date.now(),
      });
      setSocketState('open');
      setLatency((current) => ({ ...current, socketOpenMs: Math.round(performance.now() - startedAtRef.current) }));
      socket.send(JSON.stringify({ type: 'session_start', language, sampleRate, voiceName }));
      console.debug('[FRONTEND-WS-TRACE] outbound_json', {
        socketTraceSession: socketTraceSessionRef.current,
        type: 'session_start',
        language,
        sampleRate,
        voiceName,
        at: Date.now(),
      });
      resolve(socket);
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(String(event.data || '{}'));
      console.debug('[FRONTEND-WS-TRACE] inbound_json', {
        socketTraceSession: socketTraceSessionRef.current,
        speechTurnTrace: speechTurnTraceRef.current,
        type: payload.type,
        text: payload.text || payload.displayText || payload.normalizedText || payload.rawText || null,
        confidence: payload.confidence ?? payload.transcription?.confidence ?? null,
        reason: payload.reason || null,
        at: Date.now(),
      });
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
        console.info('[FRONTEND-WS-TRACE] stt_partial', {
          socketTraceSession: socketTraceSessionRef.current,
          speechTurnTrace: speechTurnTraceRef.current,
          text,
          confidence: payload.confidence ?? null,
          at: Date.now(),
        });
        setPartialTranscript(text);
        setLatency((current) => current.firstPartialMs ? current : ({ ...current, firstPartialMs: Math.round(performance.now() - startedAtRef.current) }));
        return;
      }
      if (payload.type === 'stt_final' || payload.type === 'final_transcript') {
        const text = payload.displayText || payload.normalizedText || payload.text || payload.rawText || '';
        console.info('[FRONTEND-WS-TRACE] stt_final', {
          socketTraceSession: socketTraceSessionRef.current,
          speechTurnTrace: speechTurnTraceRef.current,
          text,
          confidence: payload.confidence ?? null,
          provider: payload.provider || null,
          at: Date.now(),
        });
        const finalPayload = { ...payload, displayText: text, normalizedText: text, rawText: text };
        setFinalTranscript(finalPayload);
        setPartialTranscript('');
        setLatency((current) => ({ ...current, finalTranscriptMs: Math.round(performance.now() - startedAtRef.current) }));
        return;
      }
      if (payload.type === 'assistant_text_delta') {
        callbacksRef.current.onAssistantText?.(payload);
        return;
      }
      if (payload.type === 'tts_audio_chunk') {
        ttsChunkReceivedRef.current += 1;
        if (ttsChunkReceivedRef.current === 1 || ttsChunkReceivedRef.current % AUDIO_CHUNK_TRACE_EVERY === 0) {
          console.debug('[FRONTEND-WS-TRACE] tts_audio_chunk', {
            socketTraceSession: socketTraceSessionRef.current,
            speechTurnTrace: speechTurnTraceRef.current,
            receivedTtsChunks: ttsChunkReceivedRef.current,
            index: payload.index,
            at: Date.now(),
          });
        }
        callbacksRef.current.onAudioChunk?.(payload);
        return;
      }
      if (payload.type === 'assistant_speech_done') {
        console.info('[FRONTEND-WS-TRACE] assistant_speech_done', {
          socketTraceSession: socketTraceSessionRef.current,
          speechTurnTrace: speechTurnTraceRef.current,
          receivedTtsChunks: ttsChunkReceivedRef.current,
          at: Date.now(),
        });
        callbacksRef.current.onSpeechDone?.(payload);
        return;
      }
      if (payload.type === 'transcript_rejected') {
        console.warn('[FRONTEND-WS-TRACE] transcript_rejected', {
          socketTraceSession: socketTraceSessionRef.current,
          speechTurnTrace: speechTurnTraceRef.current,
          reason: payload.reason,
          message: payload.message,
          transcription: payload.transcription || null,
          at: Date.now(),
        });
        callbacksRef.current.onTranscriptRejected?.(payload);
        return;
      }
      if (payload.type === 'barge_in_ack') {
        callbacksRef.current.onBargeInAck?.(payload);
        return;
      }
      if (payload.type === 'turn_done') {
        console.info('[FRONTEND-WS-TRACE] turn_done', {
          socketTraceSession: socketTraceSessionRef.current,
          speechTurnTrace: speechTurnTraceRef.current,
          transcription: payload.transcription || null,
          isComplete: payload.isComplete,
          latency: payload.latency || null,
          at: Date.now(),
        });
        callbacksRef.current.onTurnDone?.(payload);
        return;
      }
      if (payload.type === 'error' || payload.type === 'speech_error') {
        console.error('[Voice Error] Received error payload from backend:', payload);
        setSocketError(payload.message || payload.errorDetails || payload.reason || 'Duplex voice failed.');
        setSocketState('error');
      }
    };

    socket.onerror = (event) => {
      console.error('[FRONTEND-WS-TRACE] websocket_error', {
        socketTraceSession: socketTraceSessionRef.current,
        event,
        at: Date.now(),
      });
      setSocketError('Duplex voice socket connection failed.');
      setSocketState('error');
      reject(new Error('Duplex voice socket connection failed.'));
    };

    socket.onclose = () => {
      console.info('[FRONTEND-WS-TRACE] close', {
        socketTraceSession: socketTraceSessionRef.current,
        speechTurnTrace: speechTurnTraceRef.current,
        chunksSent: chunksSentRef.current,
        ignoredPreSpeechChunks: ignoredPreSpeechChunksRef.current,
        at: Date.now(),
      });
      if (socketRef.current === socket) socketRef.current = null;
      speechActiveRef.current = false;
      chunksSentRef.current = 0;
      ignoredPreSpeechChunksRef.current = 0;
      setSocketState((current) => (current === 'error' ? current : 'closed'));
    };
  }), [closeSocket]);

  const sendAudioChunk = useCallback((arrayBuffer) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !arrayBuffer) return;

    if (!speechActiveRef.current) {
      ignoredPreSpeechChunksRef.current += 1;
      if (ignoredPreSpeechChunksRef.current === 1 || ignoredPreSpeechChunksRef.current % AUDIO_CHUNK_TRACE_EVERY === 0) {
        console.log('[FRONTEND-WS-TRACE] Ignoring mic audio before speech_start', {
          socketTraceSession: socketTraceSessionRef.current,
          speechTurnTrace: speechTurnTraceRef.current,
          ignoredPreSpeechChunks: ignoredPreSpeechChunksRef.current,
          bytes: arrayBuffer.byteLength,
          at: Date.now(),
        });
      }
      return;
    }

    if (chunksSentRef.current === 0) {
      console.log(`[FRONTEND-STT-TRACE] Sending FIRST audio chunk (${arrayBuffer.byteLength} bytes) to backend WebSocket.`);
    }
    chunksSentRef.current++;
    if (chunksSentRef.current === 1 || chunksSentRef.current % AUDIO_CHUNK_TRACE_EVERY === 0) {
      console.debug('[FRONTEND-WS-TRACE] outbound_audio_chunk', {
        socketTraceSession: socketTraceSessionRef.current,
        speechTurnTrace: speechTurnTraceRef.current,
        chunkIndex: chunksSentRef.current,
        bytes: arrayBuffer.byteLength,
        at: Date.now(),
      });
    }
    socket.send(arrayBuffer);
  }, []);

  const sendSpeechStart = useCallback(() => {
    if (speechActiveRef.current) {
      console.warn('[FRONTEND-STT-TRACE] Ignoring duplicate speech_start while speech is already active.', {
        socketTraceSession: socketTraceSessionRef.current,
        speechTurnTrace: speechTurnTraceRef.current,
        chunksSent: chunksSentRef.current,
        at: Date.now(),
      });
      return false;
    }
    speechTurnTraceRef.current += 1;
    chunksSentRef.current = 0;
    ignoredPreSpeechChunksRef.current = 0;
    speechActiveRef.current = true;
    const clientTurnId = `voice-turn-${socketTraceSessionRef.current}-${speechTurnTraceRef.current}`;
    console.info('[FRONTEND-WS-TRACE] speech_start', {
      socketTraceSession: socketTraceSessionRef.current,
      speechTurnTrace: speechTurnTraceRef.current,
      clientTurnId,
      at: Date.now(),
    });
    return sendJson({ type: 'speech_start', clientTurnId, clientTimestamp: Date.now() });
  }, [sendJson]);

  const sendSpeechEnd = useCallback((vad = null) => {
    if (!speechActiveRef.current) {
      console.warn('[FRONTEND-STT-TRACE] Ignoring speech_end because no active speech turn exists.', {
        socketTraceSession: socketTraceSessionRef.current,
        speechTurnTrace: speechTurnTraceRef.current,
        chunksSent: chunksSentRef.current,
        vad,
        at: Date.now(),
      });
      return false;
    }
    const clientTurnId = `voice-turn-${socketTraceSessionRef.current}-${speechTurnTraceRef.current}`;
    console.log(`[FRONTEND-STT-TRACE] speech_end sent after ${chunksSentRef.current} audio chunks.`);
    console.info('[FRONTEND-WS-TRACE] speech_end', {
      socketTraceSession: socketTraceSessionRef.current,
      speechTurnTrace: speechTurnTraceRef.current,
      clientTurnId,
      chunksSent: chunksSentRef.current,
      vad,
      at: Date.now(),
    });
    speechActiveRef.current = false;
    return sendJson({ type: 'speech_end', clientTurnId, vad, clientTimestamp: Date.now() });
  }, [sendJson]);

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
