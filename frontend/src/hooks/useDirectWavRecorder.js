import { useCallback, useRef, useState } from 'react';

export function useDirectWavRecorder() {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const [levelHistory, setLevelHistory] = useState([]);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const clearResources = useCallback(async () => {
    clearTimer();
    mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop();
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setRecordingError(null);
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.start(250);
    startedAtRef.current = performance.now();
    setRecordingDurationMs(0);
    setLevelHistory([]);
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      setRecordingDurationMs(Math.round(performance.now() - startedAtRef.current));
      setLevelHistory((history) => [...history.slice(-41), 0.2 + Math.random() * 0.6]);
    }, 150);
  }, []);

  const stopRecording = useCallback(() => new Promise((resolve) => {
    const recorder = mediaRecorderRef.current;
    const durationMs = Math.round(performance.now() - startedAtRef.current);
    clearTimer();
    if (!recorder) {
      setIsRecording(false);
      resolve({ file: null, durationMs });
      return;
    }
    recorder.onstop = () => {
      const contentType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: contentType });
      const file = new File([blob], `voice-answer-${Date.now()}.webm`, { type: contentType });
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      streamRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      resolve({ file, durationMs });
    };
    try {
      if (recorder.state !== 'inactive') recorder.stop();
      else recorder.onstop();
    } catch (error) {
      setRecordingError(error?.message || 'Could not stop recording.');
      setIsRecording(false);
      resolve({ file: null, durationMs });
    }
  }), []);

  return {
    isRecording,
    recordingError,
    levelHistory,
    recordingDurationMs,
    startRecording,
    stopRecording,
    clearResources,
  };
}
