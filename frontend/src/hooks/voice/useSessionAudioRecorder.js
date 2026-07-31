/** Browser-side chunked session recording with IndexedDB durability. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { recordingUploadRegistry } from '../../runtime/recording/recordingUploadRegistry.js';
import { RECORDING_CHUNK_INTERVAL_MS } from '../../runtime/recording/recordingConstants.js';

const resolveRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported?.('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported?.('audio/mp4')) return 'audio/mp4';
  return '';
};

export function useSessionAudioRecorder({ sessionId, uploadRegistry = recordingUploadRegistry } = {}) {
  const recorderRef = useRef(null);
  const sequenceRef = useRef(0);
  const totalBytesRef = useRef(0);
  const pendingWritesRef = useRef(Promise.resolve());
  const stopPromiseRef = useRef(null);
  const finalizationPromiseRef = useRef(null);
  const [isRecordingSessionAudio, setIsRecordingSessionAudio] = useState(false);
  const [recordingTopology, setRecordingTopology] = useState('mic_only');
  const [recordingStatus, setRecordingStatus] = useState({ state: 'idle', error: null });
  const manager = useMemo(
    () => (sessionId ? uploadRegistry.getOrCreate(sessionId) : null),
    [sessionId, uploadRegistry],
  );

  useEffect(() => manager?.subscribe((status) => setRecordingStatus({ ...status, error: status.error || null })), [manager]);

  const enqueueBlob = useCallback((blob, mimeType) => {
    if (!manager || !blob?.size) return;
    const sequence = sequenceRef.current;
    sequenceRef.current += 1;
    totalBytesRef.current += blob.size;
    pendingWritesRef.current = pendingWritesRef.current.then(() => manager.enqueueChunk({ sequence, blob, mimeType }));
  }, [manager]);

  const startRecording = useCallback((stream, { topology = 'mixed' } = {}) => {
    if (!stream || recorderRef.current || typeof MediaRecorder === 'undefined' || !manager) return false;
    setRecordingTopology(topology || 'mic_only');
    const mimeType = resolveRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorder.ondataavailable = (event) => enqueueBlob(event.data, recorder.mimeType || mimeType || 'audio/webm');
    recorder.start(RECORDING_CHUNK_INTERVAL_MS);
    recorderRef.current = recorder;
    setIsRecordingSessionAudio(true);
    void manager.start();
    return true;
  }, [enqueueBlob, manager]);

  const stopCurrentSegment = useCallback(() => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const recorder = recorderRef.current;
    if (!recorder) return pendingWritesRef.current;
    stopPromiseRef.current = new Promise((resolve) => {
      recorder.onstop = () => {
        recorderRef.current = null;
        setIsRecordingSessionAudio(false);
        pendingWritesRef.current.finally(resolve);
      };
      try {
        if (recorder.state !== 'inactive') recorder.stop();
        else recorder.onstop();
      } catch {
        recorderRef.current = null;
        setIsRecordingSessionAudio(false);
        pendingWritesRef.current.finally(resolve);
      }
    }).finally(() => { stopPromiseRef.current = null; });
    return stopPromiseRef.current;
  }, []);

  const finalizeLocalRecording = useCallback(() => {
    if (finalizationPromiseRef.current) return finalizationPromiseRef.current;
    finalizationPromiseRef.current = stopCurrentSegment().then(async () => {
      await pendingWritesRef.current;
      if (!manager || sequenceRef.current === 0) return { state: 'missing' };
      return manager.finalizeLocalCapture({
        totalChunks: sequenceRef.current,
        totalBytes: totalBytesRef.current,
      });
    });
    return finalizationPromiseRef.current;
  }, [manager, stopCurrentSegment]);

  const resetRecording = useCallback(async () => {
    await stopCurrentSegment();
  }, [stopCurrentSegment]);

  const setVoicePriorityState = useCallback((state) => {
    if (sessionId) uploadRegistry.setVoicePriorityState(sessionId, state);
  }, [sessionId, uploadRegistry]);

  const resumeUpload = useCallback(() => manager?.start(), [manager]);

  return {
    isRecordingSessionAudio,
    recordingStatus,
    recordingTopology,
    startRecording,
    stopCurrentSegment,
    finalizeLocalRecording,
    resetRecording,
    resumeUpload,
    setVoicePriorityState,
  };
}
