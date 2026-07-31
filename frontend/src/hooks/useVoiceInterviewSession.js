import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission.js';
import { useRealtimeMicStream } from './voice/useRealtimeMicStream.js';
import { useSessionAudioRecorder } from './voice/useSessionAudioRecorder.js';
import { useVoiceSessionRefs } from './voice/useVoiceSessionRefs.js';
import { useVoiceLatencyController } from './voice/useVoiceLatencyController.js';
import { useAssistantPlaybackController } from './voice/useAssistantPlaybackController.js';
import { useDuplexSocketController } from './voice/useDuplexSocketController.js';
import { useVoiceVadTurnController } from './voice/useVoiceVadTurnController.js';
import { useVoiceSessionLifecycleController } from './voice/useVoiceSessionLifecycleController.js';
import {
  DUPLEX_CONNECTED_STATES,
  NETWORK_PING_INTERVAL_MS,
  RECORDING_VOICE_STATES,
  SLOW_PROCESSING_WARNING_MS,
} from './voice/voiceSessionConstants.js';
import {
  buildVoiceStatus,
  formatDurationLabel,
  getLatestTurnByRole,
  getVoiceStateLabel,
  resolveSessionId,
} from './voice/voiceSessionHelpers.js';

export { formatDurationLabel, getLatestTurnByRole, resolveSessionId } from './voice/voiceSessionHelpers.js';

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
  onVoiceSessionUpdate,
  onStartInterview,
}) {
  const {
    permissionState,
    isRequesting,
    error: permissionError,
    requestPermission,
    isSupported,
  } = useMicrophonePermission();

  const [voiceState, setVoiceState] = useState('idle');
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [transcriptionPreview, setTranscriptionPreview] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState(null);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [lastAsrConfidence, setLastAsrConfidence] = useState(null);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [isVoiceTakingLong, setIsVoiceTakingLong] = useState(false);
  const [isAutoLoopActive, setIsAutoLoopActive] = useState(false);
  const [assistantTextPreview, setAssistantTextPreview] = useState('');
  const [recordingStatus, setRecordingStatus] = useState({ state: 'idle', error: null });
  const [lastTranscriptRejection, setLastTranscriptRejection] = useState(null);
  const [voiceNetworkQuality, setVoiceNetworkQuality] = useState(null);

  const refs = useVoiceSessionRefs();
  const {
    latestSocketLatencyRef,
    completedCleanupDoneRef,
    cleanupRef,
    pendingBargeInRef,
    activeVoiceTurnTraceRef,
    speechStartSentRef,
  } = refs;

  const activeSessionId = resolveSessionId(session, sessionId);
  const sessionAudioRecorder = useSessionAudioRecorder({ sessionId: enabled ? activeSessionId : null });
  const resumeRecordingUpload = sessionAudioRecorder.resumeUpload;
  const setRecordingVoicePriorityState = sessionAudioRecorder.setVoicePriorityState;

  useEffect(() => {
    setRecordingStatus(sessionAudioRecorder.recordingStatus);
  }, [sessionAudioRecorder.recordingStatus]);

  useEffect(() => {
    setRecordingVoicePriorityState(voiceState);
    void resumeRecordingUpload();
  }, [resumeRecordingUpload, setRecordingVoicePriorityState, voiceState]);

  const currentQuestion = useMemo(
    () => getLatestTurnByRole(session?.transcript || [], 'ai'),
    [session?.transcript]
  );
  const latestUserTurn = useMemo(
    () => getLatestTurnByRole(session?.transcript || [], 'user'),
    [session?.transcript]
  );

  const setReadyState = useCallback(() => {
    if (!enabled) return;
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus(
      'success',
      'Voice ready',
      'Duplex Voice Agent is ready. KiwiCoach can listen, speak, and handle interruption.'
    ));
  }, [enabled]);

  const latency = useVoiceLatencyController({
    activeSessionId,
    refs,
    setVoiceNetworkQuality,
  });

  useEffect(() => {
    latency.updateVoiceNetworkQuality();
  }, [latency]);

  const clearPendingBargeInForPlayback = useCallback(() => {
    pendingBargeInRef.current = null;
  }, [pendingBargeInRef]);

  const audioQueue = useAssistantPlaybackController({
    refs,
    isPaused,
    isCompleted,
    isProcessingTurn,
    setReadyState,
    setVoiceState,
    setVoiceStatus,
    clearPendingBargeIn: clearPendingBargeInForPlayback,
    stopLatencyAcknowledgement: latency.stopLatencyAcknowledgement,
    logVoiceLatencySummary: latency.logVoiceLatencySummary,
  });

  const duplexSocket = useDuplexSocketController({
    refs,
    audioQueue,
    onVoiceSessionUpdate,
    setAssistantTextPreview,
    setEditableTranscript,
    setIsAutoLoopActive,
    setIsProcessingTurn,
    setIsVoiceTakingLong,
    setLastAsrConfidence,
    setLastTranscriptRejection,
    setPendingTranscript,
    setVoiceState,
    setVoiceStatus,
    stopLatencyAcknowledgement: latency.stopLatencyAcknowledgement,
    handleFirstAudioChunk: latency.handleFirstAudioChunk,
    logVoiceLatencySummary: latency.logVoiceLatencySummary,
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
    sendVoiceLatencyTrace,
    sendPing,
    stopSession,
  } = duplexSocket;
  refs.voiceLatencyTraceSenderRef.current = sendVoiceLatencyTrace;

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



  const vadTurn = useVoiceVadTurnController({
    refs,
    enabled,
    micMediaStream,
    audioQueue,
    sendBargeIn,
    sendSpeechEnd,
    sendSpeechStart,
    setSendAudio,
    setIsProcessingTurn,
    setLastTranscriptRejection,
    setVoiceState,
    setVoiceStatus,
    startVoiceTurnTrace: latency.startVoiceTurnTrace,
    scheduleLatencyAcknowledgement: latency.scheduleLatencyAcknowledgement,
    stopLatencyAcknowledgement: latency.stopLatencyAcknowledgement,
  });

  const { vad, clearPendingBargeIn, clearPendingSpeechEnd } = vadTurn;

  const lifecycle = useVoiceSessionLifecycleController({
    enabled,
    session,
    activeSessionId,
    isPaused,
    isCompleted,
    isSupported,
    isAutoLoopActive,
    isMicStreaming,
    isProcessingTurn,
    refs,
    audioQueue,
    latency,
    vad,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    connectDuplexSocket,
    closeDuplexSocket,
    duplexSocketState,
    speakText,
    stopSession,
    micMediaStream,
    requestPermission,
    sessionAudioRecorder,
    setAssistantTextPreview,
    setEditableTranscript,
    setIsAutoLoopActive,
    setIsVoiceTakingLong,
    setLastAsrConfidence,
    setLastTranscriptRejection,
    setPendingTranscript,
    setReadyState,
    setSendAudio,
    setTranscriptionPreview,
    setVoiceState,
    setVoiceStatus,
    startStream,
    stopStream,
    onStartInterview,
  });

  useEffect(() => {
    if (!enabled || !isCompleted || completedCleanupDoneRef.current) return;
    if (!isAutoLoopActive && !isMicStreaming && !sessionAudioRecorder.isRecordingSessionAudio) return;

    completedCleanupDoneRef.current = true;
    sessionAudioRecorder.setVoicePriorityState('interview_ended');
    lifecycle.finalizeLocalRecording('session_completed')
      .then(() => lifecycle.stopVoiceSession('session_completed'))
      .catch((error) => {
        setRecordingStatus({
          state: 'failed',
          error: error.message || 'Could not finalise the MP3 recording.',
        });
      });
  }, [
    completedCleanupDoneRef,
    enabled,
    isAutoLoopActive,
    isCompleted,
    isMicStreaming,
    lifecycle,
    sessionAudioRecorder,
  ]);

  useEffect(() => {
    if (!isCompleted) completedCleanupDoneRef.current = false;
  }, [completedCleanupDoneRef, isCompleted]);

  useEffect(() => {
    if (isPaused && isAutoLoopActive) lifecycle.handleResetShell();
  }, [isAutoLoopActive, isPaused, lifecycle]);

  useEffect(() => {
    if (permissionState === 'granted' && voiceState === 'idle') setReadyState();
  }, [permissionState, setReadyState, voiceState]);

  useEffect(() => {
    if (duplexSocketState !== 'listening' || !speechStartSentRef.current) return;
    console.log('[FRONTEND-STT-TRACE] Backend listening_started received. Enabling microphone audio stream.');
    activeVoiceTurnTraceRef.current?.mark('backend_listening_started');
    setSendAudio(true);
  }, [activeVoiceTurnTraceRef, duplexSocketState, setSendAudio, speechStartSentRef]);



  useEffect(() => {
    if (partialTranscript) setTranscriptionPreview(partialTranscript);
  }, [partialTranscript]);

  useEffect(() => {
    if (!finalTranscript?.displayText) return;
    console.log('[FRONTEND-STT-TRACE] Final transcript segment received:', finalTranscript.displayText);
    activeVoiceTurnTraceRef.current?.mark('final_transcript_received', {
      source: finalTranscript.type || 'duplex_socket',
      confidence: finalTranscript.confidence ?? null,
    });
    setTranscriptionPreview(finalTranscript.displayText);
    setPendingTranscript(finalTranscript);
    setEditableTranscript(finalTranscript.displayText);
    setLastAsrConfidence(finalTranscript.confidence ?? null);
  }, [activeVoiceTurnTraceRef, finalTranscript]);

  useEffect(() => {
    if (!socketError) return;
    latency.stopLatencyAcknowledgement();
    setSendAudio(false);
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Duplex voice failed', socketError));
  }, [latency, setSendAudio, socketError]);

  useEffect(() => {
    latestSocketLatencyRef.current = duplexLatency || {};
    latency.updateVoiceNetworkQuality();
  }, [duplexLatency, latestSocketLatencyRef, latency]);

  useEffect(() => {
    if (!isAutoLoopActive || !DUPLEX_CONNECTED_STATES.includes(duplexSocketState)) return undefined;
    sendPing?.();
    const timer = window.setInterval(() => sendPing?.(), NETWORK_PING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [duplexSocketState, isAutoLoopActive, sendPing]);

  useEffect(() => {
    if (!isProcessingTurn || voiceState !== 'agent_thinking') {
      setIsVoiceTakingLong(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsVoiceTakingLong(true);
    }, SLOW_PROCESSING_WARNING_MS);

    return () => window.clearTimeout(timer);
  }, [isProcessingTurn, voiceState]);

  useEffect(() => {
    cleanupRef.current = () => {
      latency.stopLatencyAcknowledgement();
      audioQueue.clearQueue();
      clearPendingBargeIn();
      clearPendingSpeechEnd();
      speechStartSentRef.current = false;
      setSendAudio(false);
      vad.stopVad?.();
      sessionAudioRecorder.resetRecording();
      stopStream();
      closeDuplexSocket();
    };
  }, [
    audioQueue,
    clearPendingBargeIn,
    clearPendingSpeechEnd,
    cleanupRef,
    closeDuplexSocket,
    latency,
    sessionAudioRecorder,
    setSendAudio,
    speechStartSentRef,
    stopStream,
    vad,
  ]);

  // Only cleanup on component unmount, not on dependency changes
  // This keeps the WebSocket connection alive during the voice session
  // as required by VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md
  useEffect(() => {
    return () => {
      // Execute cleanup only on unmount
      cleanupRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps array = only run on mount/unmount

  const stateLabel = useMemo(() => getVoiceStateLabel(voiceState), [voiceState]);
  const liveTranscript = useMemo(() => (session?.transcript || []).slice(-8), [session?.transcript]);
  const isRecording = isMicStreaming || RECORDING_VOICE_STATES.includes(voiceState);
  const canUseVoice = enabled && !isPaused && !isCompleted && (!isSubmitting || isAutoLoopActive) && (!isProcessingTurn || isAutoLoopActive);

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
    voiceMode: 'duplex',
    realtimeStatus: duplexSocketState,
    realtimeLatency: duplexLatency,
    vadState: vad.vadState,
    vadMetrics: vad.vadMetrics,
    isAutoLoopActive,
    pendingTranscript,
    editableTranscript,
    setEditableTranscript,
    isRecording,
    isProcessingTurn,
    isVoiceTakingLong,
    voiceNetworkQuality,
    canUseVoice,
    recordingStatus,
    lastTranscriptRejection,
    levelHistory: micLevelHistory,
    recordingDurationMs: micDurationMs,
    recordingDurationLabel: formatDurationLabel(micDurationMs),
    transcriptionPreview: transcriptionPreview || assistantTextPreview,
    assistantAudioUrl: audioQueue.assistantAudioUrl,
    playbackError: audioQueue.playbackError,
    audioRef: audioQueue.audioRef,
    lastAsrConfidence,
    manualAudioFile: null,
    backupText: '',
    isBackupExpanded: false,
    handleRequestPermission: lifecycle.handleRequestPermission,
    handleToggleRecording: lifecycle.handleToggleRecording,
    handleRecordAgain: () => setReadyState(),
    handleReplayAssistantAudio: lifecycle.handleReplayAssistantAudio,
    handleResetShell: lifecycle.handleResetShell,
    handleRetryVoice: lifecycle.handleRetryVoice,
    finalizeLocalRecording: lifecycle.finalizeLocalRecording,
    stopVoiceSession: lifecycle.stopVoiceSession,
    handleAudioFileSelect: () => { },
    handleSubmitSelectedAudio: () => { },
    setBackupText: () => { },
    setIsBackupExpanded: () => { },
    onPause,
    onRepeat,
    onEnd,
  };
}
