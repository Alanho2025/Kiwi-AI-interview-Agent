/**
 * File responsibility: Voice interview session hook.
 * Main responsibilities:
 * - Orchestrate duplex voice session state between microphone, WebSocket, and assistant audio playback.
 * - Keep UI-facing voice status, latency acknowledgement, and VAD state aligned.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDuplexVoiceSocket } from './voice/useDuplexVoiceSocket.js';
import { useAssistantAudioQueue } from './voice/useAssistantAudioQueue.js';
import { useRealtimeMicStream } from './voice/useRealtimeMicStream.js';
import { useVoiceActivityDetection } from './voice/useVoiceActivityDetection.js';
import { buildVoiceStatus } from '../utils/voiceStatus.js';
import { createVoiceTurnTrace, logVoiceLatencySummary } from '../utils/voiceLatencyTrace.js';
import { updateVoiceNetworkQuality } from '../utils/voiceRuntimeNetwork.js';

const DEFAULT_VAD_CONFIG = {
  speechThreshold: 0.03,
  silenceThreshold: 0.012,
};
const MIC_ARM_DELAY_MS = 250;
const LATENCY_ACK_DELAY_MS = 3500;
const LATENCY_ACK_COOLDOWN_MS = 12000;
const SLOW_FIRST_AUDIO_MS = 4500;
const BARGE_IN_CONFIRMATION_MS = 320;

const safeNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function useVoiceInterviewSession({
  sessionId,
  isPaused = false,
  isCompleted = false,
  isProcessingTurn = false,
  setIsProcessingTurn = () => {},
  onVoiceSessionUpdate,
} = {}) {
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceStatus, setVoiceStatus] = useState(buildVoiceStatus('idle', 'Voice mode is idle', 'Start when you are ready.'));
  const [isAutoLoopActive, setIsAutoLoopActive] = useState(false);
  const [isVoiceTakingLong, setIsVoiceTakingLong] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState(null);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [assistantTextPreview, setAssistantTextPreview] = useState('');
  const [lastAsrConfidence, setLastAsrConfidence] = useState(null);
  const [lastTranscriptRejection, setLastTranscriptRejection] = useState(null);

  const autoLoopActiveRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);
  const firstAudioChunkSeenRef = useRef(false);
  const latestFirstAudioDelayRef = useRef(null);
  const consecutiveSlowTurnsRef = useRef(0);
  const voiceTurnSequenceRef = useRef(0);
  const activeVoiceTurnStartedAtRef = useRef(null);
  const activeVoiceTurnTraceRef = useRef(null);
  const activeBackendLatencyRef = useRef(null);
  const voiceSessionTraceRef = useRef(createVoiceTurnTrace('voice_session'));
  const vadMetricsRef = useRef(null);
  const pendingBargeInRef = useRef(null);
  const latencyAcknowledgementTimerRef = useRef(null);
  const lastLatencyAcknowledgementAtRef = useRef(0);
  const noSpeechPromptedRef = useRef(false);
  const startListeningRef = useRef(null);

  const clearLatencyAcknowledgementTimer = useCallback(() => {
    if (latencyAcknowledgementTimerRef.current) {
      window.clearTimeout(latencyAcknowledgementTimerRef.current);
      latencyAcknowledgementTimerRef.current = null;
    }
  }, []);

  const stopLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    setIsVoiceTakingLong(false);
  }, [clearLatencyAcknowledgementTimer]);

  const playLatencyAcknowledgement = useCallback(() => {
    setIsVoiceTakingLong(true);
    setVoiceStatus(buildVoiceStatus('info', 'Still working on the next turn', 'KiwiCoach is preparing the next question.'));
    return true;
  }, []);

  const scheduleLatencyAcknowledgement = useCallback(() => {
    clearLatencyAcknowledgementTimer();
    latencyAcknowledgementTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      const recentlyPlayed = now - lastLatencyAcknowledgementAtRef.current < LATENCY_ACK_COOLDOWN_MS;
      if (recentlyPlayed || !autoLoopActiveRef.current || firstAudioChunkSeenRef.current) return;
      const played = playLatencyAcknowledgement({ index: voiceTurnSequenceRef.current });
      if (played) lastLatencyAcknowledgementAtRef.current = now;
    }, LATENCY_ACK_DELAY_MS);
  }, [clearLatencyAcknowledgementTimer, playLatencyAcknowledgement]);

  const clearPendingBargeIn = useCallback(() => {
    pendingBargeInRef.current = null;
  }, []);

  const setReadyState = useCallback(() => {
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus('success', 'Voice mode ready', 'Answer naturally when KiwiCoach asks the next question.'));
  }, []);

  const startVoiceTurnTrace = useCallback((reason = 'voice_turn') => {
    voiceTurnSequenceRef.current += 1;
    firstAudioChunkSeenRef.current = false;
    activeVoiceTurnStartedAtRef.current = safeNow();
    activeVoiceTurnTraceRef.current = createVoiceTurnTrace(reason);
    return { turnId: voiceTurnSequenceRef.current };
  }, []);

  const audioQueue = useAssistantAudioQueue({
    onPlaybackStart: () => {
      console.log('[FRONTEND-TTS-TRACE] Assistant audio playback started.');
      stopLatencyAcknowledgement();
      isAssistantSpeakingRef.current = true;
      activeVoiceTurnTraceRef.current?.mark('assistant_audio_play_start');
      if (activeVoiceTurnTraceRef.current) logVoiceLatencySummary('assistant_playback_start', activeBackendLatencyRef.current);
      setVoiceState('ai_speaking');
      setVoiceStatus(buildVoiceStatus('success', 'KiwiCoach is speaking', 'You can interrupt naturally by speaking.'));
    },
    onPlaybackEnd: () => {
      activeVoiceTurnTraceRef.current?.mark('assistant_audio_play_end');
    },
    onQueueDrained: () => {
      console.log('[FRONTEND-TTS-TRACE] Assistant audio queue drained.');
      isAssistantSpeakingRef.current = false;
      clearPendingBargeIn();
      if (autoLoopActiveRef.current && !isPaused && !isCompleted && !isProcessingTurn) {
        window.setTimeout(() => startListeningRef.current?.(), MIC_ARM_DELAY_MS);
      } else if (!isPaused && !isCompleted) {
        setReadyState();
      }
    },
    onPlaybackError: (message) => {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Audio playback blocked', message));
    },
  });

  const duplexSocket = useDuplexVoiceSocket({
    onAudioChunk: (chunk) => {
      stopLatencyAcknowledgement();
      if (!firstAudioChunkSeenRef.current) {
        console.log('[FRONTEND-TTS-TRACE] Received first TTS audio chunk from backend.');
        firstAudioChunkSeenRef.current = true;
        const firstAudioDelayMs = activeVoiceTurnStartedAtRef.current
          ? Math.round(safeNow() - activeVoiceTurnStartedAtRef.current)
          : null;
        latestFirstAudioDelayRef.current = firstAudioDelayMs;
        consecutiveSlowTurnsRef.current = firstAudioDelayMs > SLOW_FIRST_AUDIO_MS
          ? consecutiveSlowTurnsRef.current + 1
          : 0;
        updateVoiceNetworkQuality({ firstAudioDelayMs, consecutiveSlowTurns: consecutiveSlowTurnsRef.current });
        activeVoiceTurnTraceRef.current?.mark('first_audio_chunk_received', { index: chunk.index });
      }
      activeVoiceTurnTraceRef.current?.mark('tts_audio_chunk_received', { index: chunk.index, isStreaming: chunk.isStreaming });
      audioQueue.enqueueAudioChunk(chunk);
    },
    onAssistantText: (payload) => {
      setAssistantTextPreview((current) => `${current}${payload.text || ''}`);
    },
    onSpeechDone: () => {
      console.log('[FRONTEND-STT-TRACE] Backend finished processing speech (speech_done).');
      audioQueue.finishAudioStream?.();
      setIsProcessingTurn(false);
    },
    onTranscriptRejected: (payload) => {
      console.log('[FRONTEND-STT-TRACE] Transcript rejected by backend (repair prompt).');
      stopLatencyAcknowledgement();
      setIsProcessingTurn(false);
      setIsVoiceTakingLong(false);
      setPendingTranscript(null);
      setEditableTranscript('');
      setLastAsrConfidence(payload?.transcription?.confidence ?? null);
      setLastTranscriptRejection(payload);
      setVoiceState('repair_prompt');
      setVoiceStatus(buildVoiceStatus('warning', 'Voice did not catch that clearly', payload?.message || 'Please answer again so KiwiCoach can score the right content.'));
    },
    onTurnDone: (payload) => {
      console.log('[FRONTEND-STT-TRACE] Turn done received. Final transcript:', payload?.transcription?.text);
      stopLatencyAcknowledgement();
      activeVoiceTurnTraceRef.current?.mark('auto_submit_response');
      setIsProcessingTurn(false);
      setIsVoiceTakingLong(false);
      setLastTranscriptRejection(null);
      activeBackendLatencyRef.current = payload?.latency || null;
      logVoiceLatencySummary('duplex_turn_done', activeBackendLatencyRef.current);
      if (payload?.session) onVoiceSessionUpdate?.(payload.session);
      if (payload?.transcription?.text) {
        const transcript = {
          displayText: payload.transcription.text,
          normalizedText: payload.transcription.text,
          rawText: payload.transcription.text,
          confidence: payload.transcription.confidence ?? null,
          confidenceStatus: payload.transcription.confidence != null ? `${Math.round(payload.transcription.confidence * 100)}%` : 'unknown',
        };
        setPendingTranscript(transcript);
        setEditableTranscript(transcript.displayText);
        setLastAsrConfidence(payload.transcription.confidence ?? null);
      }
      if (payload?.isComplete) {
        autoLoopActiveRef.current = false;
        setIsAutoLoopActive(false);
        setVoiceState('ready');
        setVoiceStatus(buildVoiceStatus('success', 'Interview completed', 'The planned voice interview is complete.'));
      }
    },
    onBargeInAck: () => {
      voiceSessionTraceRef.current?.mark('barge_in_ack');
      setVoiceStatus(buildVoiceStatus('info', 'Interrupted', 'KiwiCoach stopped speaking and is listening to you.'));
    },
  });

  const {
    socketState: duplexSocketState,
    partialTranscript,
    finalTranscript,
    socketError,
    latency: duplexLatency,
    connect: connectDuplexSocket,
    closeSocket: closeDuplexSocket,
    sendAudioChunk,
    sendSpeechStart,
    sendSpeechEnd,
    sendBargeIn,
    speakText,
    sendPing,
    stopSession,
  } = duplexSocket;

  const realtimeMic = useRealtimeMicStream({ onAudioChunk: sendAudioChunk });
  const {
    isStreaming: isMicStreaming,
    levelHistory: micLevelHistory,
    durationMs: micDurationMs,
    mediaStream: micMediaStream,
    startStream,
    stopStream,
    setSendAudio,
  } = realtimeMic;

  const confirmPendingBargeIn = useCallback(() => {
    const pending = pendingBargeInRef.current;
    if (!pending || pending.confirmed || !isAssistantSpeakingRef.current) return false;
    pendingBargeInRef.current = { ...pending, confirmed: true };
    setSendAudio?.(true);
    sendSpeechStart();
    audioQueue.clearQueue();
    sendBargeIn('user_started_speaking');
    setVoiceState('interrupted');
    setVoiceStatus(buildVoiceStatus('info', 'Interrupting KiwiCoach', 'Your voice interrupted the assistant. Keep speaking.'));
    return true;
  }, [audioQueue, sendBargeIn, sendSpeechStart, setSendAudio]);

  const stopListening = useCallback(async (reason = 'speech_end') => {
    console.log(`[FRONTEND-STT-TRACE] Stopping listening. Reason: ${reason}`);
    const { turnId } = startVoiceTurnTrace(reason);
    activeVoiceTurnTraceRef.current?.mark('auto_submit_start', { reason, turnId });
    activeVoiceTurnTraceRef.current?.mark('stt_stop_sent', { reason, turnId });
    vad.stopVad?.();
    console.log('[FRONTEND-STT-TRACE] Sending speech_end to backend.');
    sendSpeechEnd(vadMetricsRef.current || null);
    setSendAudio?.(false);
    setIsProcessingTurn(true);
    setVoiceState('agent_thinking');
    setVoiceStatus(buildVoiceStatus('info', 'Processing your answer', 'KiwiCoach is preparing the next turn. This may take a few seconds.'));
    scheduleLatencyAcknowledgement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleLatencyAcknowledgement, sendSpeechEnd, setSendAudio, startVoiceTurnTrace]);

  const handleVadFrame = useCallback((frame = {}) => {
    const pending = pendingBargeInRef.current;
    if (!pending || pending.confirmed || !isAssistantSpeakingRef.current) return;
    const thresholds = frame.metrics?.thresholds || {};
    const speechThreshold = thresholds.speechThreshold || DEFAULT_VAD_CONFIG.speechThreshold;
    const silenceThreshold = thresholds.silenceThreshold || DEFAULT_VAD_CONFIG.silenceThreshold;
    const rms = Number(frame.rms || 0);
    if (rms <= silenceThreshold) {
      clearPendingBargeIn();
      return;
    }
    if (rms < speechThreshold) return;
    if (frame.at - pending.startedAt >= BARGE_IN_CONFIRMATION_MS) {
      confirmPendingBargeIn();
    }
  }, [clearPendingBargeIn, confirmPendingBargeIn]);

  const handleVadSpeechStart = useCallback((metrics = {}) => {
    console.log('[FRONTEND-STT-TRACE] VAD detected speech start.');
    stopLatencyAcknowledgement();
    setLastTranscriptRejection(null);
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    voiceSessionTraceRef.current?.mark('vad_speech_start', metrics);

    if (isAssistantSpeakingRef.current) {
      pendingBargeInRef.current = {
        startedAt: Number(metrics.speechStartedAt || safeNow()),
        confirmed: false,
      };
    } else {
      console.log('[FRONTEND-STT-TRACE] Arming microphone and sending speech_start.');
      setSendAudio?.(true);
      sendSpeechStart();
      setVoiceState('user_speaking');
      setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Keep answering naturally. KiwiCoach will stop when you pause.'));
    }
  }, [sendSpeechStart, setSendAudio, stopLatencyAcknowledgement]);

  const handleVadSpeechEnd = useCallback(async (metrics = {}) => {
    clearPendingBargeIn();
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    await stopListening('vad_speech_end');
  }, [clearPendingBargeIn, stopListening]);

  const handleNoSpeechTimeout = useCallback(() => {
    if (!autoLoopActiveRef.current || noSpeechPromptedRef.current) return;
    noSpeechPromptedRef.current = true;
    setVoiceStatus(buildVoiceStatus('info', 'Take your time', 'Start answering when you are ready.'));
  }, []);

  const handleMaxAnswerTimeout = useCallback(async (metrics = {}) => {
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics, maxAnswerTimeout: true };
    await stopListening('vad_max_answer_timeout');
  }, [stopListening]);

  const vad = useVoiceActivityDetection({
    mediaStream: micMediaStream,
    isEnabled: isAutoLoopActive,
    isAssistantSpeaking: isAssistantSpeakingRef.current,
    onSpeechStart: handleVadSpeechStart,
    onSpeechEnd: handleVadSpeechEnd,
    onFrame: handleVadFrame,
    onNoSpeechTimeout: handleNoSpeechTimeout,
    onMaxAnswerTimeout: handleMaxAnswerTimeout,
  });

  startListeningRef.current = async () => {
    if (!sessionId || isPaused || isCompleted) return;
    noSpeechPromptedRef.current = false;
    await startStream();
    vad.startVad?.();
    setVoiceState('listening');
    setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Start answering when you are ready.'));
  };

  const startVoiceSession = useCallback(async ({ language = 'en-NZ', voiceName = 'en-NZ-MollyNeural' } = {}) => {
    if (!sessionId) return;
    await audioQueue.unlockAudio();
    await connectDuplexSocket({ sessionId, language, voiceName });
    autoLoopActiveRef.current = true;
    setIsAutoLoopActive(true);
    setReadyState();
  }, [audioQueue, connectDuplexSocket, sessionId, setReadyState]);

  const stopVoiceSession = useCallback(() => {
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    stopLatencyAcknowledgement();
    audioQueue.clearQueue();
    vad.stopVad?.();
    stopStream();
    stopSession();
    closeDuplexSocket();
    setReadyState();
  }, [audioQueue, closeDuplexSocket, setReadyState, stopLatencyAcknowledgement, stopSession, stopStream, vad]);

  return useMemo(() => ({
    voiceState,
    voiceStatus,
    isAutoLoopActive,
    isVoiceTakingLong,
    pendingTranscript,
    editableTranscript,
    assistantTextPreview,
    lastAsrConfidence,
    lastTranscriptRejection,
    duplexSocketState,
    partialTranscript,
    finalTranscript,
    socketError,
    duplexLatency,
    isMicStreaming,
    micLevelHistory,
    micDurationMs,
    latestFirstAudioDelayMs: latestFirstAudioDelayRef.current,
    audioRef: audioQueue.audioRef,
    startVoiceSession,
    stopVoiceSession,
    speakText,
    sendPing,
    setEditableTranscript,
  }), [
    voiceState,
    voiceStatus,
    isAutoLoopActive,
    isVoiceTakingLong,
    pendingTranscript,
    editableTranscript,
    assistantTextPreview,
    lastAsrConfidence,
    lastTranscriptRejection,
    duplexSocketState,
    partialTranscript,
    finalTranscript,
    socketError,
    duplexLatency,
    isMicStreaming,
    micLevelHistory,
    micDurationMs,
    audioQueue.audioRef,
    startVoiceSession,
    stopVoiceSession,
    speakText,
    sendPing,
  ]);
}
