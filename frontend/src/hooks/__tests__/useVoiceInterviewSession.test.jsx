import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDurationLabel,
  getLatestTurnByRole,
  resolveSessionId,
  useVoiceInterviewSession,
} from '../useVoiceInterviewSession.js';

const { permissionMock, realtimeMicMock, duplexSocketMock, audioQueueMock } = vi.hoisted(() => ({
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
    audioRef: { current: null },
    assistantAudioUrl: '',
    isAssistantSpeaking: false,
    enqueueAudioChunk: vi.fn(),
    clearQueue: vi.fn(),
  },
}));

vi.mock('../useMicrophonePermission.js', () => ({
  useMicrophonePermission: () => permissionMock,
}));

vi.mock('../voice/useRealtimeMicStream.js', () => ({
  useRealtimeMicStream: () => realtimeMicMock,
}));

vi.mock('../voice/useVoiceActivityDetection.js', () => ({
  useVoiceActivityDetection: () => ({
    startVad: vi.fn().mockResolvedValue(true),
    stopVad: vi.fn(),
    vadState: 'idle',
    vadMetrics: null,
  }),
}));

vi.mock('../voice/useDuplexVoiceSocket.js', () => ({
  useDuplexVoiceSocket: () => duplexSocketMock,
}));

vi.mock('../voice/useAssistantAudioQueue.js', () => ({
  useAssistantAudioQueue: () => audioQueueMock,
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
    duplexSocketMock.socketState = 'idle';
    duplexSocketMock.finalTranscript = null;
    duplexSocketMock.partialTranscript = '';
    duplexSocketMock.socketError = null;
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
    expect(duplexSocketMock.speakText).toHaveBeenCalledWith('Why this role?');
    expect(result.current.voiceMode).toBe('duplex');
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
});
