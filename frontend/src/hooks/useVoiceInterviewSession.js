import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission.js';
import { useDirectWavRecorder } from './useDirectWavRecorder.js';
import { useRealtimeMicStream } from './voice/useRealtimeMicStream.js';
import { useRealtimeSpeechSocket } from './voice/useRealtimeSpeechSocket.js';
import { useVoiceActivityDetection } from './voice/useVoiceActivityDetection.js';
import { createVoiceLatencyTrace } from '../utils/voiceLatencyTrace.js';
import { buildVoiceLatencyConsoleSummary } from '../utils/voiceLatencySummary.js';

const DEFAULT_VOICE_NAME = 'en-NZ-MollyNeural';
const DEFAULT_LANGUAGE = 'en-NZ';
const READY_STATES = new Set(['ready', 'speaking', 'ai_speaking', 'listening']);
const FINAL_TRANSCRIPT_TIMEOUT_MS = 1200;
const MIC_ARM_DELAY_MS = 350;
const VAD_WARMUP_IGNORE_MS = 500;
const MIN_TRANSCRIPT_CHARS = 2;

const buildVoiceStatus = (type, title, message) => ({ type, title, message });

export const formatDurationLabel = (valueMs = 0) => {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const getLatestTurnByRole = (transcript = [], role) => {
  const filteredTurns = transcript.filter((message) => message.role === role);
  return filteredTurns[filteredTurns.length - 1] || null;
};

export const resolveSessionId = (session, explicitSessionId) => explicitSessionId || session?.id || session?._id || session?.sessionId || '';

const speakWithBrowserVoice = ({ text, onStart, onEnd, onError }) => {
  const questionText = String(text || '').trim();
  if (!questionText || typeof window === 'undefined' || !window.speechSynthesis) return false;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.lang = DEFAULT_LANGUAGE;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferredVoice = voices.find((voice) => voice.lang === 'en-NZ') || voices.find((voice) => voice.lang?.startsWith('en-'));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onError?.();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    onError?.();
    return false;
  }
};

export function useVoiceInterviewSession({
  enabled = true,
  session,
  sessionId,
  onPause,
  onRepeat,
  onEnd,
  isPaused,
  isCompleted,
  isSubmitting,
  onSubmitVoiceReply,
  onSubmitRealtimeVoiceTurn,
  onSubmitTextReply,
}) {
  const {
    permissionState,
    isRequesting,
    error: permissionError,
    requestPermission,
    isSupported,
  } = useMicrophonePermission();

  const {
    isRecording: isBatchRecording,
    recordingError,
    levelHistory: batchLevelHistory,
    recordingDurationMs,
    startRecording,
    stopRecording,
    clearResources,
  } = useDirectWavRecorder();

  const speechSocket = useRealtimeSpeechSocket();
  const realtimeMic = useRealtimeMicStream({ onAudioChunk: speechSocket.sendAudioChunk });
  const {
    socketState,
    partialTranscript,
    finalTranscript,
    socketError,
    latency,
    connect: connectSpeechSocket,
    closeSocket,
    sendStop,
    getBestAvailableTranscript,
    resetTranscript,
  } = speechSocket;
  const {
    isStreaming: isRealtimeStreaming,
    levelHistory: realtimeLevelHistory,
    durationMs: realtimeDurationMs,
    mediaStream: realtimeMediaStream,
    startStream,
    stopStream,
  } = realtimeMic;

  const [voiceState, setVoiceState] = useState('idle');
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [voiceMode, setVoiceMode] = useState('realtime');
  const [transcriptionPreview, setTranscriptionPreview] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState(null);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [lastAssistantAudio, setLastAssistantAudio] = useState(null);
  const [assistantAudioUrl, setAssistantAudioUrl] = useState('');
  const [lastAsrConfidence, setLastAsrConfidence] = useState(null);
  const [backupText, setBackupText] = useState('');
  const [isBackupExpanded, setIsBackupExpanded] = useState(false);
  const [manualAudioFile, setManualAudioFile] = useState(null);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [isAutoLoopActive, setIsAutoLoopActive] = useState(false);

  const audioRef = useRef(null);
  const lastSpokenQuestionRef = useRef('');
  const hasSpokenGreetingRef = useRef(false);
  const finalTranscriptTimerRef = useRef(null);
  const realtimeTurnSubmittedRef = useRef(false);
  const realtimeStopAtRef = useRef(null);
  const autoLoopActiveRef = useRef(false);
  const autoStopInFlightRef = useRef(false);
  const vadMetricsRef = useRef(null);
  const voiceTraceRef = useRef(null);
  const noSpeechPromptedRef = useRef(false);
  const startAutoListeningRef = useRef(null);
  const stopRealtimeRecordingRef = useRef(null);

  const activeSessionId = resolveSessionId(session, sessionId);
  const currentQuestion = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'ai'), [session?.transcript]);
  const latestUserTurn = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'user'), [session?.transcript]);

  const setReadyState = useCallback(() => {
    if (!enabled) return;
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus('success', 'Voice ready', voiceMode === 'realtime'
      ? 'Auto VAD is ready. Start once, then KiwiCoach will listen and stop automatically.'
      : 'Batch voice fallback is ready. Tap the microphone to record your answer.'));
  }, [enabled, voiceMode]);

  const clearFinalTranscriptTimer = useCallback(() => {
    if (!finalTranscriptTimerRef.current) return;
    window.clearTimeout(finalTranscriptTimerRef.current);
    finalTranscriptTimerRef.current = null;
  }, []);

  const requestRepeatByVoice = useCallback(() => {
    setVoiceState('ai_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'Please answer again', 'KiwiCoach did not catch a clear answer and will ask you to repeat.'));
    speakWithBrowserVoice({
      text: "Sorry, I didn't catch that clearly. Could you answer again briefly?",
      onStart: () => voiceTraceRef.current?.mark('clarification_audio_start'),
      onEnd: () => {
        voiceTraceRef.current?.mark('clarification_audio_end');
        if (autoLoopActiveRef.current && !isPaused && !isCompleted) {
          window.setTimeout(() => startAutoListeningRef.current?.(), MIC_ARM_DELAY_MS);
        }
      },
      onError: () => startAutoListeningRef.current?.(),
    });
  }, [isPaused, isCompleted]);

  const handleVadSpeechStart = useCallback((metrics = {}) => {
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    voiceTraceRef.current?.mark('vad_speech_start', metrics);
    setVoiceState('user_speaking');
    setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Keep answering naturally. KiwiCoach will stop when you finish speaking.'));
  }, []);

  const handleVadSpeechEnd = useCallback(async (metrics = {}) => {
    if (autoStopInFlightRef.current || realtimeTurnSubmittedRef.current) return;
    autoStopInFlightRef.current = true;
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics };
    voiceTraceRef.current?.mark('vad_speech_end', metrics);
    setVoiceState('detecting_silence');
    setVoiceStatus(buildVoiceStatus('info', 'Answer captured', 'KiwiCoach detected a pause and is finalising your spoken answer.'));
    await stopRealtimeRecordingRef.current?.('vad_speech_end');
  }, []);

  const handleNoSpeechTimeout = useCallback(() => {
    if (!autoLoopActiveRef.current || noSpeechPromptedRef.current) return;
    noSpeechPromptedRef.current = true;
    voiceTraceRef.current?.mark('vad_no_speech_timeout');
    setVoiceStatus(buildVoiceStatus('info', 'Take your time', 'You can start answering when you are ready.'));
    speakWithBrowserVoice({
      text: 'Take your time. You can start when you are ready.',
      onStart: () => setVoiceState('ai_speaking'),
      onEnd: () => {
        if (autoLoopActiveRef.current && !isPaused && !isCompleted) {
          window.setTimeout(() => startAutoListeningRef.current?.(), MIC_ARM_DELAY_MS);
        }
      },
      onError: () => startAutoListeningRef.current?.(),
    });
  }, [isPaused, isCompleted]);

  const handleMaxAnswerTimeout = useCallback(async (metrics = {}) => {
    if (autoStopInFlightRef.current || realtimeTurnSubmittedRef.current) return;
    autoStopInFlightRef.current = true;
    vadMetricsRef.current = { ...(vadMetricsRef.current || {}), ...metrics, maxAnswerTimeout: true };
    voiceTraceRef.current?.mark('vad_max_answer_timeout', metrics);
    await stopRealtimeRecordingRef.current?.('vad_max_answer_timeout');
  }, []);

  const vad = useVoiceActivityDetection({
    stream: realtimeMediaStream,
    enabled,
    onSpeechStart: handleVadSpeechStart,
    onSpeechEnd: handleVadSpeechEnd,
    onNoSpeechTimeout: handleNoSpeechTimeout,
    onMaxAnswerTimeout: handleMaxAnswerTimeout,
  });
  const { startVad, stopVad, vadState, vadMetrics } = vad;

  const speakCurrentQuestion = useCallback(({ isReplay = false } = {}) => {
    if (!enabled || isRealtimeStreaming || isBatchRecording || isProcessingTurn) return false;
    const questionText = String(currentQuestion?.displayText || currentQuestion?.text || '').trim();
    if (!questionText) return false;

    return speakWithBrowserVoice({
      text: questionText,
      onStart: () => {
        setVoiceState('ai_speaking');
        stopVad?.();
        setVoiceStatus(buildVoiceStatus('info', isReplay ? 'Replaying question audio' : 'KiwiCoach is speaking', isReplay ? 'Replaying the current interview question.' : 'Listen to the question. The microphone will open automatically after KiwiCoach finishes.'));
        voiceTraceRef.current?.mark(isReplay ? 'assistant_replay_start' : 'assistant_browser_audio_start');
        if (!isReplay) hasSpokenGreetingRef.current = true;
      },
      onEnd: () => {
        voiceTraceRef.current?.mark(isReplay ? 'assistant_replay_end' : 'assistant_browser_audio_end');
        if (autoLoopActiveRef.current && !isProcessingTurn && !isBatchRecording && !isPaused && !isCompleted) {
          window.setTimeout(() => startAutoListeningRef.current?.(), MIC_ARM_DELAY_MS);
          return;
        }
        if (!isProcessingTurn && !isRealtimeStreaming && !isBatchRecording) setReadyState();
      },
      onError: () => {
        if (autoLoopActiveRef.current) {
          startAutoListeningRef.current?.();
          return;
        }
        setVoiceState('ready');
        setVoiceStatus(buildVoiceStatus('info', 'Question audio unavailable', 'Your browser blocked automatic question audio. Use Repeat Question to try again.'));
      },
    });
  }, [enabled, currentQuestion, isRealtimeStreaming, isBatchRecording, isProcessingTurn, isPaused, isCompleted, setReadyState, stopVad]);

  const handleRequestPermission = useCallback(async () => {
    if (!enabled) return;
    setVoiceState('requesting_permission');
    setVoiceStatus(buildVoiceStatus('info', 'Requesting microphone access', 'Allow microphone access so the interview can listen to your answer.'));
    const result = await requestPermission();
    if (result.ok) {
      setReadyState();
      return;
    }
    if (permissionState === 'unsupported') {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice not supported', 'This browser does not support microphone access for the voice interview flow.'));
      return;
    }
    setVoiceState('permission_denied');
    setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', result.error || 'Microphone access is required for direct voice conversation.'));
  }, [enabled, permissionState, requestPermission, setReadyState]);

  const autoSubmitRealtimeTranscript = useCallback(async (turn, reason = 'final') => {
    const answerText = String(turn?.displayText || turn?.normalizedText || turn?.rawText || '').trim();
    if (!enabled || !answerText || answerText.length < MIN_TRANSCRIPT_CHARS || !onSubmitRealtimeVoiceTurn || isSubmitting || isCompleted || isPaused) return;
    if (realtimeTurnSubmittedRef.current) return;

    realtimeTurnSubmittedRef.current = true;
    clearFinalTranscriptTimer();
    setIsProcessingTurn(true);
    setVoiceState('auto_submitting_answer');
    setVoiceStatus(buildVoiceStatus('info', 'Preparing next question', 'KiwiCoach is using your answer to decide the next spoken question.'));

    voiceTraceRef.current?.mark('auto_submit_start', { reason });
    const submitStartedAt = performance.now();
    try {
      const result = await onSubmitRealtimeVoiceTurn({
        transcriptText: answerText,
        language: DEFAULT_LANGUAGE,
        voiceName: DEFAULT_VOICE_NAME,
        asrConfidence: turn?.confidence ?? null,
        asrSource: turn?.source === 'partial_fallback' ? 'azure_realtime_partial_fallback' : 'azure_realtime',
        inputMode: 'realtime_voice_vad',
        vad: {
          ...(vadMetricsRef.current || {}),
          usedPartialFallback: Boolean(turn?.usedPartialFallback || turn?.fallback),
          finaliseReason: reason,
        },
      });

      const submitMs = Math.round(performance.now() - submitStartedAt);
      voiceTraceRef.current?.mark('auto_submit_response', { submitMs });
      console.info('[voice-latency]', {
        event: 'realtime_voice_turn_completed',
        reason,
        submitMs,
        stopToSubmitStartMs: realtimeStopAtRef.current ? Math.round(submitStartedAt - realtimeStopAtRef.current) : null,
        backendLatency: result?.latency || null,
        trace: voiceTraceRef.current?.toJSON?.() || null,
      });
      console.log('[voice-latency-summary]', buildVoiceLatencyConsoleSummary({
        trace: voiceTraceRef.current?.toJSON?.() || null,
        backendLatency: result?.latency || null,
      }));

      setPendingTranscript({ ...turn, displayText: answerText });
      setEditableTranscript(answerText);
      setTranscriptionPreview(answerText);
      setLastAsrConfidence(turn?.confidence ?? null);
      setLastAssistantAudio(result?.assistantAudio || null);
      autoStopInFlightRef.current = false;
      setVoiceState(result?.assistantAudio?.base64 ? 'ai_speaking' : 'ready');
      setVoiceStatus(buildVoiceStatus('success', 'Next question ready', result?.assistantAudio?.base64
        ? 'KiwiCoach is speaking the next adaptive question.'
        : 'The next adaptive question is ready. Use replay if your browser blocks audio.'));
    } catch (error) {
      realtimeTurnSubmittedRef.current = false;
      autoStopInFlightRef.current = false;
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Realtime voice turn failed', error.message || 'Could not prepare the next spoken question.'));
    } finally {
      setIsProcessingTurn(false);
    }
  }, [enabled, onSubmitRealtimeVoiceTurn, isSubmitting, isCompleted, isPaused, clearFinalTranscriptTimer]);

  const startFinalTranscriptDeadline = useCallback(() => {
    clearFinalTranscriptTimer();
    finalTranscriptTimerRef.current = window.setTimeout(() => {
      const fallbackTurn = getBestAvailableTranscript?.();
      if (fallbackTurn?.displayText) {
        autoSubmitRealtimeTranscript(fallbackTurn, 'timeout_fallback');
        return;
      }

      realtimeTurnSubmittedRef.current = false;
      autoStopInFlightRef.current = false;
      if (autoLoopActiveRef.current) {
        requestRepeatByVoice();
        return;
      }
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Could not hear the answer clearly', 'Please record your answer again.'));
    }, FINAL_TRANSCRIPT_TIMEOUT_MS);
  }, [autoSubmitRealtimeTranscript, clearFinalTranscriptTimer, getBestAvailableTranscript, requestRepeatByVoice]);

  const submitVoiceFile = useCallback(async (audioFile, durationMs = null) => {
    if (!enabled || !audioFile || !onSubmitVoiceReply || isSubmitting || isCompleted || isPaused) return;

    setIsProcessingTurn(true);
    setVoiceState('transcribing');
    setVoiceStatus(buildVoiceStatus('info', 'Processing your answer', 'Azure Speech is transcribing your voice reply and sending it to the interview engine.'));

    try {
      const result = await onSubmitVoiceReply({ audioFile, language: DEFAULT_LANGUAGE, voiceName: DEFAULT_VOICE_NAME, durationMs });
      const transcriptionText = String(result?.transcription?.text || '').trim();
      setTranscriptionPreview(transcriptionText);
      setLastAssistantAudio(result?.assistantAudio || null);
      setLastAsrConfidence(result?.transcription?.confidence ?? null);
      setVoiceState(result?.assistantAudio?.base64 ? 'ai_speaking' : 'ready');
      setVoiceStatus(buildVoiceStatus('success', 'Voice turn complete', 'Your spoken reply was transcribed and the next interviewer question is ready.'));
    } catch (error) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice turn failed', error.message || 'Could not process this voice reply.'));
    } finally {
      setIsProcessingTurn(false);
      setManualAudioFile(null);
    }
  }, [enabled, onSubmitVoiceReply, isSubmitting, isCompleted, isPaused]);

  const startRealtimeRecording = useCallback(async ({ autoLoop = false } = {}) => {
    if (!enabled) return;
    if (!activeSessionId) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Session missing', 'Could not start real-time voice because the session ID is missing.'));
      return;
    }

    const permissionResult = await requestPermission();
    if (!permissionResult.ok) {
      setVoiceState('permission_denied');
      setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', permissionResult.error || 'Allow microphone access to begin the real-time voice interview.'));
      return;
    }

    if (!autoLoop) window?.speechSynthesis?.cancel?.();
    clearFinalTranscriptTimer();
    realtimeTurnSubmittedRef.current = false;
    autoStopInFlightRef.current = false;
    realtimeStopAtRef.current = null;
    vadMetricsRef.current = null;
    setPendingTranscript(null);
    setEditableTranscript('');
    setTranscriptionPreview('');
    setLastAsrConfidence(null);
    setVoiceState(autoLoop ? 'arming_mic' : 'recording');
    setVoiceStatus(buildVoiceStatus('info', autoLoop ? 'Opening microphone' : 'Listening with real-time captions', autoLoop ? 'KiwiCoach is ready to hear your answer.' : 'Speak naturally. Captions will update while you answer. Tap again when you are done.'));

    try {
      voiceTraceRef.current?.mark('mic_arm_start');
      await connectSpeechSocket({ sessionId: activeSessionId, language: DEFAULT_LANGUAGE, sampleRate: 16000 });
      const stream = await startStream();
      if (autoLoop) {
        noSpeechPromptedRef.current = false;
        await startVad({ stream, ignoreFirstMs: VAD_WARMUP_IGNORE_MS });
        voiceTraceRef.current?.mark('mic_ready');
        setVoiceState('listening');
        setVoiceStatus(buildVoiceStatus('info', 'Listening', 'Answer naturally. KiwiCoach will stop recording when you pause.'));
      }
    } catch (error) {
      await stopStream();
      closeSocket();
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Real-time voice failed', error.message || 'Could not start real-time speech recognition. Use Batch mode if needed.'));
    }
  }, [enabled, activeSessionId, requestPermission, connectSpeechSocket, startStream, stopStream, closeSocket, clearFinalTranscriptTimer, startVad]);

  useEffect(() => {
    startAutoListeningRef.current = () => startRealtimeRecording({ autoLoop: true });
  }, [startRealtimeRecording]);

  const stopRealtimeRecording = useCallback(async (reason = 'manual_stop') => {
    realtimeStopAtRef.current = performance.now();
    voiceTraceRef.current?.mark('stt_stop_sent', { reason });
    stopVad?.();
    setVoiceState('finalising_transcript');
    setVoiceStatus(buildVoiceStatus('info', 'Finalising live transcript', 'Waiting briefly for Azure Speech final text before auto-submit.'));
    await stopStream();
    sendStop();
    startFinalTranscriptDeadline();
  }, [stopStream, sendStop, startFinalTranscriptDeadline, stopVad]);

  useEffect(() => {
    stopRealtimeRecordingRef.current = stopRealtimeRecording;
  }, [stopRealtimeRecording]);

  const stopAutoLoop = useCallback(async () => {
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    stopVad?.();
    clearFinalTranscriptTimer();
    window?.speechSynthesis?.cancel?.();
    await stopStream();
    closeSocket();
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus('info', 'Voice interview paused', 'Press Start Voice Interview to continue.'));
  }, [clearFinalTranscriptTimer, closeSocket, stopStream, stopVad]);

  const handleToggleRecording = useCallback(async () => {
    if (!enabled || isCompleted || isPaused) return;
    if ((isSubmitting || isProcessingTurn) && !isAutoLoopActive) return;

    if (!isSupported) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice unavailable', 'This browser cannot record microphone audio for the voice interview.'));
      return;
    }

    if (voiceMode === 'realtime') {
      if (isAutoLoopActive || isRealtimeStreaming) {
        await stopAutoLoop();
        return;
      }

      autoLoopActiveRef.current = true;
      setIsAutoLoopActive(true);
      voiceTraceRef.current = createVoiceLatencyTrace({ sessionId: activeSessionId, mode: 'realtime_voice_vad' });
      voiceTraceRef.current.mark('voice_loop_start');
      setVoiceState('starting');
      setVoiceStatus(buildVoiceStatus('info', 'Starting voice interview', 'KiwiCoach will speak, then the microphone will open automatically.'));
      const spoke = speakCurrentQuestion({ isReplay: false });
      if (!spoke) await startRealtimeRecording({ autoLoop: true });
      return;
    }

    if (isBatchRecording) {
      setVoiceState('transcribing');
      setVoiceStatus(buildVoiceStatus('info', 'Finalising recording', 'Uploading your answer and preparing the next interviewer turn.'));
      const result = await stopRecording();
      if (result?.file) await submitVoiceFile(result.file, result.durationMs);
      else {
        setVoiceState('error');
        setVoiceStatus(buildVoiceStatus('error', 'Recording missing', 'No microphone audio was captured for this turn.'));
      }
      return;
    }

    const permissionResult = await requestPermission();
    if (!permissionResult.ok) {
      setVoiceState('permission_denied');
      setVoiceStatus(buildVoiceStatus('error', 'Microphone blocked', permissionResult.error || 'Allow microphone access to begin the direct voice interview.'));
      return;
    }

    try {
      window?.speechSynthesis?.cancel?.();
      await startRecording();
      setVoiceState('recording');
      setVoiceStatus(buildVoiceStatus('info', 'Listening...', 'Speak naturally. Tap the microphone again when you are done with this answer.'));
    } catch (error) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Recording failed', error.message || 'Could not start microphone recording.'));
    }
  }, [enabled, isCompleted, isPaused, isSubmitting, isProcessingTurn, isAutoLoopActive, isSupported, voiceMode, isRealtimeStreaming, stopAutoLoop, activeSessionId, speakCurrentQuestion, startRealtimeRecording, isBatchRecording, stopRecording, submitVoiceFile, requestPermission, startRecording]);

  const handleUseRealtimeTranscript = useCallback(async () => {
    const answerText = String(editableTranscript || pendingTranscript?.displayText || '').trim();
    if (!enabled || !answerText || !onSubmitTextReply || isSubmitting || isCompleted || isPaused) return;

    setIsProcessingTurn(true);
    setVoiceState('transcribing');
    setVoiceStatus(buildVoiceStatus('info', 'Submitting confirmed transcript', 'Sending the calibrated transcript to the existing DeepSeek interview flow.'));
    try {
      await onSubmitTextReply(answerText);
      setPendingTranscript(null);
      setEditableTranscript('');
      setTranscriptionPreview(answerText);
      setVoiceState('ready');
      setVoiceStatus(buildVoiceStatus('success', 'Transcript submitted', 'The next interviewer question is ready.'));
    } catch (error) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Transcript submit failed', error.message || 'Could not submit the confirmed transcript.'));
    } finally {
      setIsProcessingTurn(false);
    }
  }, [enabled, editableTranscript, pendingTranscript, onSubmitTextReply, isSubmitting, isCompleted, isPaused]);

  const handleRecordAgain = useCallback(() => {
    setPendingTranscript(null);
    setEditableTranscript('');
    setTranscriptionPreview('');
    setLastAsrConfidence(null);
    resetTranscript();
    setReadyState();
  }, [resetTranscript, setReadyState]);

  const handleReplayAssistantAudio = useCallback(() => {
    if (!enabled) return false;
    if (assistantAudioUrl && audioRef.current) {
      setVoiceState('ai_speaking');
      stopVad?.();
      setVoiceStatus(buildVoiceStatus('info', 'Playing question audio', 'Replaying the latest assistant question.'));
      audioRef.current.currentTime = 0;
      audioRef.current.play?.().catch(() => speakCurrentQuestion({ isReplay: true }));
      return true;
    }
    return speakCurrentQuestion({ isReplay: true });
  }, [enabled, assistantAudioUrl, speakCurrentQuestion, stopVad]);

  const handleResetShell = useCallback(async () => {
    window?.speechSynthesis?.cancel?.();
    await clearResources();
    await stopStream();
    stopVad?.();
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    closeSocket();
    clearFinalTranscriptTimer();
    setManualAudioFile(null);
    setTranscriptionPreview('');
    setPendingTranscript(null);
    setEditableTranscript('');
    setLastAsrConfidence(null);
    if (permissionState === 'granted') {
      setReadyState();
      return;
    }
    setVoiceState('idle');
    setVoiceStatus(null);
  }, [clearResources, stopStream, closeSocket, clearFinalTranscriptTimer, permissionState, setReadyState, stopVad]);

  const handleAudioFileSelect = useCallback((event) => {
    const nextFile = event.target.files?.[0] || null;
    setManualAudioFile(nextFile);
    if (nextFile) setVoiceStatus(buildVoiceStatus('info', 'Backup WAV ready', `${nextFile.name} can be submitted as a fallback voice turn.`));
  }, []);

  const handleSubmitSelectedAudio = useCallback(async () => {
    if (!manualAudioFile) return;
    await submitVoiceFile(manualAudioFile, null);
  }, [manualAudioFile, submitVoiceFile]);

  useEffect(() => {
    if (enabled) return undefined;
    window?.speechSynthesis?.cancel?.();
    closeSocket();
    stopVad?.();
    autoLoopActiveRef.current = false;
    setIsAutoLoopActive(false);
    clearFinalTranscriptTimer();
    stopStream();
    hasSpokenGreetingRef.current = false;
    return undefined;
  }, [enabled, closeSocket, stopStream, clearFinalTranscriptTimer, stopVad]);

  useEffect(() => {
    if (permissionState === 'granted' && voiceState === 'idle') setReadyState();
    if (permissionState === 'denied' && READY_STATES.has(voiceState)) setVoiceState('permission_denied');
  }, [permissionState, voiceState, setReadyState]);

  useEffect(() => {
    if (!partialTranscript) return;
    setTranscriptionPreview(partialTranscript);
  }, [partialTranscript]);

  useEffect(() => {
    if (!finalTranscript) return;
    const finalTurn = finalTranscript;
    const displayText = String(finalTurn.displayText || finalTurn.normalizedText || finalTurn.rawText || finalTurn.text || '').trim();
    if (!displayText) return;
    autoSubmitRealtimeTranscript({ ...finalTurn, displayText, source: 'final' }, 'final');
  }, [finalTranscript, autoSubmitRealtimeTranscript]);

  useEffect(() => {
    if (!socketError) return;
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Real-time caption failed', socketError));
  }, [socketError]);

  useEffect(() => {
    if (!lastAssistantAudio?.base64 || !lastAssistantAudio?.contentType) return undefined;
    const binary = atob(lastAssistantAudio.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: lastAssistantAudio.contentType });
    const nextUrl = URL.createObjectURL(blob);
    setAssistantAudioUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [lastAssistantAudio]);

  useEffect(() => {
    if (!assistantAudioUrl || !audioRef.current) return undefined;
    const audioElement = audioRef.current;
    const playStartedAt = performance.now();
    const handleEnded = () => {
      voiceTraceRef.current?.mark('assistant_audio_play_end');
      if (autoLoopActiveRef.current && !isProcessingTurn && !isBatchRecording && !isPaused && !isCompleted) {
        window.setTimeout(() => startAutoListeningRef.current?.(), MIC_ARM_DELAY_MS);
        return;
      }
      if (!isProcessingTurn && !isRealtimeStreaming && !isBatchRecording) setReadyState();
    };
    audioElement.onended = handleEnded;
    audioElement.currentTime = 0;
    audioElement.play?.()
      .then(() => {
        voiceTraceRef.current?.mark('assistant_audio_play_start');
        console.info('[voice-latency]', {
          event: 'assistant_audio_play_started',
          audioPlayStartMs: Math.round(performance.now() - playStartedAt),
        });
      })
      .catch(() => speakCurrentQuestion({ isReplay: false }));
    return () => { audioElement.onended = null; };
  }, [assistantAudioUrl, isProcessingTurn, isRealtimeStreaming, isBatchRecording, isPaused, isCompleted, setReadyState, speakCurrentQuestion]);

  useEffect(() => {
    if (!enabled || isAutoLoopActive) return undefined;
    const questionText = String(currentQuestion?.displayText || currentQuestion?.text || '').trim();
    if (!questionText || assistantAudioUrl || isRealtimeStreaming || isBatchRecording || isProcessingTurn) return undefined;
    if (lastSpokenQuestionRef.current === questionText && hasSpokenGreetingRef.current) return undefined;

    lastSpokenQuestionRef.current = questionText;
    const timerId = window.setTimeout(() => speakCurrentQuestion({ isReplay: false }), 250);
    return () => window.clearTimeout(timerId);
  }, [enabled, isAutoLoopActive, assistantAudioUrl, currentQuestion, isProcessingTurn, isRealtimeStreaming, isBatchRecording, speakCurrentQuestion]);

  useEffect(() => {
    if (!recordingError) return;
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Recording failed', recordingError));
  }, [recordingError]);

  useEffect(() => () => {
    window?.speechSynthesis?.cancel?.();
    clearResources();
    stopStream();
    stopVad?.();
    closeSocket();
    clearFinalTranscriptTimer();
  }, [clearResources, stopStream, closeSocket, clearFinalTranscriptTimer, stopVad]);

  useEffect(() => {
    if (!enabled) return;
    hasSpokenGreetingRef.current = false;
    lastSpokenQuestionRef.current = '';
  }, [enabled, activeSessionId]);

  const stateLabel = useMemo(() => {
    switch (voiceState) {
      case 'requesting_permission': return 'Requesting mic access';
      case 'permission_denied': return 'Microphone blocked';
      case 'ready': return voiceMode === 'realtime' ? 'Auto voice ready' : 'Batch fallback ready';
      case 'recording': return voiceMode === 'realtime' ? 'Streaming speech...' : 'Listening...';
      case 'starting': return 'Starting voice loop';
      case 'ai_speaking': return 'KiwiCoach speaking';
      case 'arming_mic': return 'Opening microphone';
      case 'listening': return 'Listening';
      case 'user_speaking': return 'Answering';
      case 'detecting_silence': return 'Detecting pause';
      case 'auto_submitting_answer': return 'Submitting answer';
      case 'transcribing': return 'Processing answer';
      case 'finalising_transcript': return 'Finalising speech';
      case 'generating_next_question': return 'Preparing next question';
      case 'speaking': return 'KiwiCoach speaking';
      case 'error': return 'Voice error';
      default: return 'Idle';
    }
  }, [voiceState, voiceMode]);

  const transcript = session?.transcript || [];
  const liveTranscript = useMemo(() => transcript.slice(-8), [transcript]);
  const isRecording = voiceMode === 'realtime'
    ? (isRealtimeStreaming || ['listening', 'user_speaking', 'detecting_silence'].includes(voiceState))
    : isBatchRecording;
  const canUseVoice = enabled && !isPaused && !isCompleted && (!isSubmitting || isAutoLoopActive) && (!isProcessingTurn || isAutoLoopActive);
  const activeLevelHistory = voiceMode === 'realtime' ? realtimeLevelHistory : batchLevelHistory;
  const activeDurationMs = voiceMode === 'realtime' ? realtimeDurationMs : recordingDurationMs;

  return {
    currentQuestion,
    latestUserTurn,
    liveTranscript,
    permissionState,
    permissionError,
    isRequesting,
    isSupported,
    stateLabel,
    voiceState,
    voiceStatus,
    voiceMode,
    setVoiceMode,
    realtimeStatus: socketState,
    realtimeLatency: latency,
    vadState,
    vadMetrics,
    isAutoLoopActive,
    pendingTranscript,
    editableTranscript,
    setEditableTranscript,
    isRecording,
    isProcessingTurn,
    canUseVoice,
    levelHistory: activeLevelHistory,
    recordingDurationMs: activeDurationMs,
    recordingDurationLabel: formatDurationLabel(activeDurationMs),
    transcriptionPreview,
    assistantAudioUrl,
    audioRef,
    lastAsrConfidence,
    manualAudioFile,
    backupText,
    isBackupExpanded,
    handleRequestPermission,
    handleToggleRecording,
    handleUseRealtimeTranscript,
    handleRecordAgain,
    handleReplayAssistantAudio,
    handleResetShell,
    handleAudioFileSelect,
    handleSubmitSelectedAudio,
    setBackupText,
    setIsBackupExpanded,
    onPause,
    onRepeat,
    onEnd,
  };
}
