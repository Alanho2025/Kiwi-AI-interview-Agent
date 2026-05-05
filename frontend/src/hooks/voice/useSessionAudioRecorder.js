/**
 * File responsibility: Browser-side session audio recorder.
 * Main responsibilities:
 * - Record candidate microphone segments during voice answers.
 * - Keep raw browser recording details hidden from UI components.
 * - Return one combined Blob that the backend can convert to MP3.
 */

import { useCallback, useRef, useState } from 'react';

const resolveRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported?.('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported?.('audio/mp4')) return 'audio/mp4';
  return '';
};

export function useSessionAudioRecorder() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const segmentsRef = useRef([]);
  const mimeTypeRef = useRef('audio/webm');
  const [isRecordingSessionAudio, setIsRecordingSessionAudio] = useState(false);

  const startRecording = useCallback((stream) => {
    if (!stream || recorderRef.current || typeof MediaRecorder === 'undefined') return false;

    const mimeType = resolveRecorderMimeType();
    chunksRef.current = [];
    mimeTypeRef.current = mimeType || 'audio/webm';

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunksRef.current.push(event.data);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecordingSessionAudio(true);
    return true;
  }, []);

  const stopCurrentSegment = useCallback(() => new Promise((resolve) => {
    const recorder = recorderRef.current;

    if (!recorder) {
      resolve(null);
      return;
    }

    recorder.onstop = () => {
      const blob = chunksRef.current.length
        ? new Blob(chunksRef.current, { type: recorder.mimeType || mimeTypeRef.current })
        : null;
      if (blob) segmentsRef.current.push(blob);
      recorderRef.current = null;
      chunksRef.current = [];
      setIsRecordingSessionAudio(false);
      resolve(blob);
    };

    try {
      recorder.stop();
    } catch {
      recorderRef.current = null;
      chunksRef.current = [];
      setIsRecordingSessionAudio(false);
      resolve(null);
    }
  }), []);

  const getCombinedRecording = useCallback(async () => {
    await stopCurrentSegment();
    if (!segmentsRef.current.length) return null;

    const combinedBlob = new Blob(segmentsRef.current, { type: mimeTypeRef.current || 'audio/webm' });
    segmentsRef.current = [];
    return combinedBlob;
  }, [stopCurrentSegment]);

  const resetRecording = useCallback(async () => {
    await stopCurrentSegment();
    segmentsRef.current = [];
  }, [stopCurrentSegment]);

  return {
    isRecordingSessionAudio,
    startRecording,
    stopCurrentSegment,
    getCombinedRecording,
    resetRecording,
  };
}
