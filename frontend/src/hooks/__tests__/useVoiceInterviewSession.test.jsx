import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDurationLabel,
  getLatestTurnByRole,
  resolveSessionId,
  useVoiceInterviewSession,
} from '../useVoiceInterviewSession.js';

const { permissionMock, realtimeMicMock, duplexSocketMock, audioQueueMock, vadMock } = vi.hoisted(() => ({
  permissionMock: {
    permissionState: 'granted',
    isRequesting: false,
    error: null,
    requestPermission: vi.fn().mockResolvedValue({ ok: true }),
    isSupported: true,
  },
  realtimeMicMock: {
    isStreaming: false,
    levelHistory: [],
    durationMs: 0,
    mediaStream: null,
    startStream: vi.fn().mockResolvedValue({}),
    stopStream: vi.fn().mockResolvedValue(undefined),
    setSendAudio: vi.fn(),
  },
  duplexSocketMock: {
    socketState: 'idle',
    partialTranscript: '',
    finalTranscript: null,
    socketError: null,
    latency: {},
    connect: vi.fn().mockResolvedValue({}),
    closeSocket: vi.fn(),
    sendAudioChunk: vi.fn(),
    sendSpeechStart: vi.fn(),
    sendSpeechEnd: vi.fn(),
    sendBargeIn: vi.fn(),
    speakText: vi.fn(),
    sendPing: vi.fn(),
    stopSession: vi.fn(),
  },
  audioQueueMock: {
    config: null,
    audioRef: { current: null },
    assistantAudioUrl: '',
    isAssistantSpeaking: false,
    unlockAudio: vi.fn().mockResolvedValue({ ok: true }),
    enqueueAudioChunk: vi.fn(),
    clearQueue: vi.fn(),
  },
  vadMock: {
    config: null,
    startVad: vi.fn().mockResolvedValue(true),
    stopVad: vi.fn(),
  },
}));

vi.mock('../useMicrophonePermission.js', () => ({
  useMicrophonePermission: () => permissionMock,
}));

vi.mock('../voice/useRealtimeMicStream.js', () => ({
  useRealtimeMicStream: () => realtimeMicMock,
}));

vi.mock('../voice/useVoiceActivityDetection.js', () => ({
  useVoiceActivityDetection: (config) => {
    vadMock.config = config;
    return {
      startVad: vadMock.startVad,
      stopVad: vadMock.stopVad,
      vadState: 'idle',
      vadMetrics: null,
    };
  },
}));

vi.mock('../voice/useDuplexVoiceSocket.js', () => ({
  useDuplexVoiceSocket: () => duplexSocketMock,
}));

vi.mock('../voice/useAssistantAudioQueue.js', () => ({
  useAssistantAudioQueue: (config) => {
    audioQueueMock.config = config;
    return audioQueueMock;
  },
}));

const buildSession = (overrides = {}) => ({
  id: 'session-1',
  status: 'in_progress',
  transcript: [
    { role: 'ai', text: 'Tell me about yourself.' },
    { role: 'user', text: 'I am Alan.' },
    { role: 'ai', text: 'Why this role?' },
  ],
  ...overrides,
});

describe('voice interview session helpers', () => {
  it('formats recording duration and resolves session identifiers safely', () => {
    expect(formatDurationLabel(0)).toBe('00:00');
    expect(formatDurationLabel(61000)).toBe('01:01');
    expect(resolveSessionId({ _id: 'mongo-id' }, '')).toBe('mongo-id');
    expect(resolveSessionId({ id: 'session-id' }, 'explicit-id')).toBe('explicit-id');
  });

  it('gets the latest transcript turn by role', () => {
    expect(getLatestTurnByRole(buildSession().transcript, 'ai').text).toBe('Why this role?');
    expect(getLatestTurnByRole(buildSession().transcript, 'system')).toBeNull();
  });
});

describe('useVoiceInterviewSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.permissionState = 'granted';
    permissionMock.isSupported = true;
    permissionMock.requestPermission = vi.fn().mockResolvedValue({ ok: true });
    realtimeMicMock.isStreaming = false;
    realtimeMicMock.mediaStream = null;
    realtimeMicMock.setSendAudio = vi.fn();
    realtimeMicMock.startStream = vi.fn().mockResolvedValue({});
    realtimeMicMock.stopStream = vi.fn().mockResolvedValue(undefined);
    duplexSocketMock.socketState = 'idle';
    duplexSocketMock.finalTranscript = null;
    duplexSocketMock.partialTranscript = '';
    duplexSocketMock.socketError = null;
    audioQueueMock.config = null;
    audioQueueMock.unlockAudio = vi.fn().mockResolvedValue({ ok: true });
    vadMock.config = null;
    vadMock.startVad = vi.fn().mockResolvedValue(true);
    vadMock.stopVad = vi.fn();
  });

  it('does not allow voice controls when disabled, paused, completed, or submitting', () => {
    const { result: disabled } = renderHook(() => useVoiceInterviewSession({ enabled: false, session: buildSession(), isPaused: false, isCompleted: false, isSubmitting: false }));
    expect(disabled.current.canUseVoice).toBe(false);

    const { result: paused } = renderHook(() => useVoiceInterviewSession({ enabled: true, session: buildSession(), isPaused: true, isCompleted: false, isSubmitting: false }));
    expect(paused.current.canUseVoice).toBe(false);

    const { result: submitting } = renderHook(() => useVoiceInterviewSession({ enabled: true, session: buildSession(), isPaused: false, isCompleted: false, isSubmitting: true }));
    expect(submitting.current.canUseVoice).toBe(false);
  });

  it('starts the duplex socket and sends the current question through voice mode', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useVoiceInterviewSession({
        enabled: true,
        session: buildSession(),
        sessionId: 'session-1',
        isPaused: false,
        isCompleted: false,
        isSubmitting: false,
      }));

      await act(async () => {
        await result.current.handleToggleRecording();
      });

      expect(duplexSocketMock.connect).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-1' }));
      expect(duplexSocketMock.speakText).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });

      expect(duplexSocketMock.speakText).toHaveBeenCalledWith('Why this role?');
      expect(result.current.voiceMode).toBe('duplex');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not expose batch upload handlers as active features', () => {
    const { result } = renderHook(() => useVoiceInterviewSession({
      enabled: true,
      session: buildSession(),
      sessionId: 'session-1',
      isPaused: false,
      isCompleted: false,
      isSubmitting: false,
    }));

    expect(result.current.manualAudioFile).toBeNull();
    expect(result.current.voiceMode).toBe('duplex');
  });

  it('confirms sustained speech before sending barge-in while assistant is speaking', async () => {
    renderHook(() => useVoiceInterviewSession({
      enabled: true,
      session: buildSession(),
      sessionId: 'session-1',
      isPaused: false,
      isCompleted: false,
      isSubmitting: false,
    }));

    await act(async () => {
      audioQueueMock.config.onPlaybackStart();
      vadMock.config.onSpeechStart({ speechStartedAt: 1000 });
    });

    expect(audioQueueMock.clearQueue).not.toHaveBeenCalled();
    expect(duplexSocketMock.sendSpeechStart).not.toHaveBeenCalled();
    expect(duplexSocketMock.sendBargeIn).not.toHaveBeenCalled();

    await act(async () => {
      vadMock.config.onVadFrame({
        rms: 0.04,
        at: 1200,
        metrics: { thresholds: { speechThreshold: 0.018, silenceThreshold: 0.012 } },
      });
    });

    expect(duplexSocketMock.sendBargeIn).not.toHaveBeenCalled();

    await act(async () => {
      vadMock.config.onVadFrame({
        rms: 0.04,
        at: 1400,
        metrics: { thresholds: { speechThreshold: 0.018, silenceThreshold: 0.012 } },
      });
    });

    expect(audioQueueMock.clearQueue).toHaveBeenCalledTimes(1);
    expect(realtimeMicMock.setSendAudio).toHaveBeenCalledWith(true);
    expect(duplexSocketMock.sendSpeechStart).toHaveBeenCalledTimes(1);
    expect(duplexSocketMock.sendBargeIn).toHaveBeenCalledWith('user_started_speaking');
  });

  it('does not restart VAD immediately while a submitted voice turn is processing', async () => {
    renderHook(() => useVoiceInterviewSession({
      enabled: true,
      session: buildSession(),
      sessionId: 'session-1',
      isPaused: false,
      isCompleted: false,
      isSubmitting: false,
    }));

    await act(async () => {
      await vadMock.config.onSpeechEnd({ speechDurationMs: 2500, silenceDurationMs: 2000 });
    });

    expect(duplexSocketMock.sendSpeechEnd).toHaveBeenCalledWith(expect.objectContaining({ speechDurationMs: 2500 }));
    expect(vadMock.startVad).not.toHaveBeenCalled();
  });
});
