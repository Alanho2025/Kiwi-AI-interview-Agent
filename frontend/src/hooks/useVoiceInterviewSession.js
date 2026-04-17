import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission.js';
import { useDirectWavRecorder } from './useDirectWavRecorder.js';

const DEFAULT_VOICE_NAME = 'en-NZ-MollyNeural';
const DEFAULT_LANGUAGE = 'en-NZ';
const buildVoiceStatus = (type, title, message) => ({ type, title, message });
const READY_STATES = new Set(['ready', 'speaking']);

const formatDurationLabel = (valueMs = 0) => {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getLatestTurnByRole = (transcript = [], role) => {
  const filteredTurns = transcript.filter((message) => message.role === role);
  return filteredTurns[filteredTurns.length - 1] || null;
};

export function useVoiceInterviewSession({ session, onPause, onRepeat, onEnd, isPaused, isCompleted, isSubmitting, onSubmitVoiceReply }) {
  const {
    permissionState,
    isRequesting,
    error: permissionError,
    requestPermission,
    isSupported,
  } = useMicrophonePermission();
  const {
    isRecording,
    recordingError,
    levelHistory,
    recordingDurationMs,
    startRecording,
    stopRecording,
    clearResources,
  } = useDirectWavRecorder();

  const [voiceState, setVoiceState] = useState('idle');
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [transcriptionPreview, setTranscriptionPreview] = useState('');
  const [lastAssistantAudio, setLastAssistantAudio] = useState(null);
  const [assistantAudioUrl, setAssistantAudioUrl] = useState('');
  const [lastAsrConfidence, setLastAsrConfidence] = useState(null);
  const [backupText, setBackupText] = useState('');
  const [isBackupExpanded, setIsBackupExpanded] = useState(false);
  const [manualAudioFile, setManualAudioFile] = useState(null);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const audioRef = useRef(null);
  const lastBrowserSpokenQuestionRef = useRef('');

  const currentQuestion = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'ai'), [session?.transcript]);
  const latestUserTurn = useMemo(() => getLatestTurnByRole(session?.transcript || [], 'user'), [session?.transcript]);

  const setReadyState = useCallback(() => {
    setVoiceState('ready');
    setVoiceStatus(buildVoiceStatus('success', 'Voice ready', 'You can tap the microphone to answer the current question.'));
  }, []);

  const handleRequestPermission = useCallback(async () => {
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
  }, [permissionState, requestPermission, setReadyState]);

  const submitVoiceFile = useCallback(async (audioFile, durationMs = null) => {
    if (!audioFile || !onSubmitVoiceReply || isSubmitting || isCompleted || isPaused) {
      return;
    }

    setIsProcessingTurn(true);
    setVoiceState('transcribing');
    setVoiceStatus(buildVoiceStatus('info', 'Processing your answer', 'Azure Speech is transcribing your voice reply and sending it to the interview engine.'));

    try {
      const result = await onSubmitVoiceReply({
        audioFile,
        language: DEFAULT_LANGUAGE,
        voiceName: DEFAULT_VOICE_NAME,
        durationMs,
      });
      const transcriptionText = String(result?.transcription?.text || '').trim();
      setTranscriptionPreview(transcriptionText);
      setLastAssistantAudio(result?.assistantAudio || null);
      setLastAsrConfidence(result?.transcription?.confidence ?? null);
      setVoiceState(result?.assistantAudio?.base64 ? 'speaking' : 'ready');
      setVoiceStatus(buildVoiceStatus('success', 'Voice turn complete', 'Your spoken reply was transcribed and the next interviewer question is ready.'));
    } catch (error) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice turn failed', error.message || 'Could not process this voice reply.'));
    } finally {
      setIsProcessingTurn(false);
      setManualAudioFile(null);
    }
  }, [onSubmitVoiceReply, isSubmitting, isCompleted, isPaused]);

  const handleToggleRecording = useCallback(async () => {
    if (isCompleted || isPaused || isSubmitting || isProcessingTurn) {
      return;
    }

    if (!isSupported) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Voice unavailable', 'This browser cannot record microphone audio for the voice interview.'));
      return;
    }

    if (isRecording) {
      setVoiceState('transcribing');
      setVoiceStatus(buildVoiceStatus('info', 'Finalising recording', 'Uploading your answer and preparing the next interviewer turn.'));
      const result = await stopRecording();
      if (result?.file) {
        await submitVoiceFile(result.file, result.durationMs);
      } else {
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
      await startRecording();
      setVoiceState('recording');
      setVoiceStatus(buildVoiceStatus('info', 'Listening...', 'Speak naturally. Tap the microphone again when you are done with this answer.'));
    } catch (error) {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Recording failed', error.message || 'Could not start microphone recording.'));
    }
  }, [isCompleted, isPaused, isSubmitting, isProcessingTurn, isSupported, isRecording, stopRecording, submitVoiceFile, requestPermission, startRecording]);

  const handleReplayAssistantAudio = useCallback(() => {
    if (!assistantAudioUrl) return;
    setVoiceState('speaking');
    setVoiceStatus(buildVoiceStatus('info', 'Playing question audio', 'Replaying the latest assistant question.'));
    audioRef.current?.play?.().catch(() => {
      setVoiceState('error');
      setVoiceStatus(buildVoiceStatus('error', 'Playback failed', 'The assistant audio could not be replayed on this device.'));
    });
  }, [assistantAudioUrl]);

  const handleResetShell = useCallback(async () => {
    await clearResources();
    setManualAudioFile(null);
    setTranscriptionPreview('');
    setLastAsrConfidence(null);
    if (permissionState === 'granted') {
      setReadyState();
      return;
    }
    setVoiceState('idle');
    setVoiceStatus(null);
  }, [clearResources, permissionState, setReadyState]);

  const handleAudioFileSelect = useCallback((event) => {
    const nextFile = event.target.files?.[0] || null;
    setManualAudioFile(nextFile);
    if (nextFile) {
      setVoiceStatus(buildVoiceStatus('info', 'Backup WAV ready', `${nextFile.name} can be submitted as a fallback voice turn.`));
    }
  }, []);

  const handleSubmitSelectedAudio = useCallback(async () => {
    if (!manualAudioFile) return;
    await submitVoiceFile(manualAudioFile, null);
  }, [manualAudioFile, submitVoiceFile]);

  useEffect(() => {
    if (permissionState === 'granted' && voiceState === 'idle') {
      setReadyState();
    }
    if (permissionState === 'denied' && READY_STATES.has(voiceState)) {
      setVoiceState('permission_denied');
    }
  }, [permissionState, voiceState, setReadyState]);

  useEffect(() => {
    if (!lastAssistantAudio?.base64 || !lastAssistantAudio?.contentType) {
      return undefined;
    }

    const binary = atob(lastAssistantAudio.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: lastAssistantAudio.contentType });
    const nextUrl = URL.createObjectURL(blob);
    setAssistantAudioUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [lastAssistantAudio]);


  useEffect(() => {
    const questionText = String(currentQuestion?.displayText || currentQuestion?.text || '').trim();
    if (!questionText || assistantAudioUrl || isRecording || isProcessingTurn) {
      return undefined;
    }
    if (!window?.speechSynthesis) {
      return undefined;
    }
    if (lastBrowserSpokenQuestionRef.current === questionText) {
      return undefined;
    }

    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.lang = DEFAULT_LANGUAGE;
    const availableVoices = window.speechSynthesis.getVoices?.() || [];
    const preferredVoice = availableVoices.find((voice) => voice.lang === 'en-NZ') || availableVoices.find((voice) => voice.lang?.startsWith('en-'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    lastBrowserSpokenQuestionRef.current = questionText;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [assistantAudioUrl, currentQuestion, isProcessingTurn, isRecording]);

  useEffect(() => {
    if (!assistantAudioUrl || !audioRef.current) {
      return undefined;
    }

    const audioElement = audioRef.current;
    const handleEnded = () => {
      if (!isProcessingTurn && !isRecording) {
        setVoiceState('ready');
        setVoiceStatus(buildVoiceStatus('success', 'Ready for the next answer', 'You can answer the next question whenever you are ready.'));
      }
    };

    audioElement.onended = handleEnded;
    audioElement.play?.().catch(() => null);

    return () => {
      audioElement.onended = null;
    };
  }, [assistantAudioUrl, isProcessingTurn, isRecording]);

  useEffect(() => {
    if (!recordingError) return;
    setVoiceState('error');
    setVoiceStatus(buildVoiceStatus('error', 'Recording failed', recordingError));
  }, [recordingError]);

  useEffect(() => () => {
    clearResources();
  }, [clearResources]);

  const stateLabel = useMemo(() => {
    switch (voiceState) {
      case 'requesting_permission': return 'Requesting mic access';
      case 'permission_denied': return 'Microphone blocked';
      case 'ready': return 'Ready to listen';
      case 'recording': return 'Listening...';
      case 'transcribing': return 'Processing answer';
      case 'speaking': return 'KiwiCoach speaking';
      case 'error': return 'Voice error';
      default: return 'Idle';
    }
  }, [voiceState]);

  const transcript = session?.transcript || [];
  const liveTranscript = useMemo(() => transcript.slice(-8), [transcript]);
  const canUseVoice = !isPaused && !isCompleted && !isSubmitting && !isProcessingTurn;

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
    isRecording,
    isProcessingTurn,
    canUseVoice,
    levelHistory,
    recordingDurationMs,
    recordingDurationLabel: formatDurationLabel(recordingDurationMs),
    transcriptionPreview,
    assistantAudioUrl,
    audioRef,
    lastAsrConfidence,
    manualAudioFile,
    backupText,
    isBackupExpanded,
    handleRequestPermission,
    handleToggleRecording,
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
