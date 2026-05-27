import { useCallback } from 'react';
import { useDuplexVoiceSocket } from './useDuplexVoiceSocket.js';
import { buildTranscriptFromTurnPayload, buildVoiceStatus } from './voiceSessionHelpers.js';

export function useDuplexSocketController({
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
  stopLatencyAcknowledgement,
  handleFirstAudioChunk,
  logVoiceLatencySummary,
}) {
  const {
    autoLoopActiveRef,
    activeVoiceTurnTraceRef,
    activeBackendLatencyRef,
    speechStartSentRef,
    voiceSessionTraceRef,
  } = refs;

  const applyTurnTranscript = useCallback((payload) => {
    const transcript = buildTranscriptFromTurnPayload(payload);
    if (!transcript) return;

    setPendingTranscript(transcript);
    setEditableTranscript(transcript.displayText);
    setLastAsrConfidence(transcript.confidence);
  }, [setEditableTranscript, setLastAsrConfidence, setPendingTranscript]);

  return useDuplexVoiceSocket({
    onAudioChunk: (chunk) => {
      stopLatencyAcknowledgement();
      handleFirstAudioChunk(chunk);
      activeVoiceTurnTraceRef.current?.mark('tts_audio_chunk_received', { index: chunk.index });
      audioQueue.enqueueAudioChunk(chunk);
    },
    onAssistantText: (payload) => {
      setAssistantTextPreview((current) => `${current}${payload.text || ''}`);
    },
    onSpeechDone: () => {
      console.log('[FRONTEND-TTS-TRACE] Assistant speech stream done.');
      audioQueue.finishAudioStream?.();
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
      setVoiceStatus(buildVoiceStatus(
        'warning',
        'Voice did not catch that clearly',
        payload?.message || 'Please answer again so KiwiCoach can score the right content.'
      ));
    },
    onTurnDone: (payload) => {
      console.log('[FRONTEND-STT-TRACE] Turn done received. Final transcript:', payload?.transcription?.text);
      stopLatencyAcknowledgement();
      activeVoiceTurnTraceRef.current?.mark('auto_submit_response');
      setIsProcessingTurn(false);
      setIsVoiceTakingLong(false);
      setLastTranscriptRejection(null);
      speechStartSentRef.current = false;
      activeBackendLatencyRef.current = payload?.latency || null;
      logVoiceLatencySummary('duplex_turn_done', activeBackendLatencyRef.current);
      if (payload?.session) onVoiceSessionUpdate?.(payload.session);
      applyTurnTranscript(payload);
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
}
