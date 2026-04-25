import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDurationLabel,
  getLatestTurnByRole,
  resolveSessionId,
  useVoiceInterviewSession,
} from '../useVoiceInterviewSession.js';

const {
      permissionMock,
      batchRecorderMock,
      realtimeMicMock,
      speechSocketMock,
    } = vi.hoisted(() => ({
      permissionMock: {
        permissionState: 'granted',
        isRequesting: false,
        error: null,
        requestPermission: vi.fn().mockResolvedValue({ ok: true }),
        isSupported: true,
      },
      batchRecorderMock: {
        isRecording: false,
        recordingError: null,
        levelHistory: [],
        recordingDurationMs: 0,
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        clearResources: vi.fn(),
      },
      realtimeMicMock: {
        isStreaming: false,
        levelHistory: [],
        durationMs: 0,
        startStream: vi.fn(),
        stopStream: vi.fn(),
      },
      speechSocketMock: {
        socketState: 'idle',
        partialTranscript: '',
        finalTranscript: null,
        socketError: null,
        latency: {},
        connect: vi.fn().mockResolvedValue({}),
        closeSocket: vi.fn(),
        sendAudioChunk: vi.fn(),
        sendStop: vi.fn(),
        resetTranscript: vi.fn(),
      },
    }));

    vi.mock('../useMicrophonePermission.js', () => ({
  useMicrophonePermission: () => permissionMock,
}));

vi.mock('../useDirectWavRecorder.js', () => ({
  useDirectWavRecorder: () => batchRecorderMock,
}));

vi.mock('../voice/useRealtimeMicStream.js', () => ({
  useRealtimeMicStream: () => realtimeMicMock,
}));

vi.mock('../voice/useRealtimeSpeechSocket.js', () => ({
  useRealtimeSpeechSocket: () => speechSocketMock,
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
    realtimeMicMock.isStreaming = false;
    speechSocketMock.finalTranscript = null;
    speechSocketMock.partialTranscript = '';
    speechSocketMock.socketError = null;
    permissionMock.permissionState = 'granted';
    permissionMock.isSupported = true;
    permissionMock.requestPermission = vi.fn().mockResolvedValue({ ok: true });
    window.speechSynthesis.cancel = vi.fn();
    window.speechSynthesis.speak = vi.fn((utterance) => {
      utterance.onstart?.();
      utterance.onend?.();
    });
  });

  it('does not allow voice controls when disabled, paused, completed, or submitting', () => {
    const { result: disabled } = renderHook(() => useVoiceInterviewSession({
      enabled: false,
      session: buildSession(),
      isPaused: false,
      isCompleted: false,
      isSubmitting: false,
    }));
    expect(disabled.current.canUseVoice).toBe(false);

    const { result: paused } = renderHook(() => useVoiceInterviewSession({
      enabled: true,
      session: buildSession(),
      isPaused: true,
      isCompleted: false,
      isSubmitting: false,
    }));
    expect(paused.current.canUseVoice).toBe(false);

    const { result: submitting } = renderHook(() => useVoiceInterviewSession({
      enabled: true,
      session: buildSession(),
      isPaused: false,
      isCompleted: false,
      isSubmitting: true,
    }));
    expect(submitting.current.canUseVoice).toBe(false);
  });

  it('starts realtime recording only after permission and socket connection succeed', async () => {
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

    expect(permissionMock.requestPermission).toHaveBeenCalled();
    expect(speechSocketMock.connect).toHaveBeenCalledWith({
      sessionId: 'session-1',
      language: 'en-NZ',
      sampleRate: 16000,
    });
    expect(realtimeMicMock.startStream).toHaveBeenCalled();
  });

  it('sets a safe error state instead of opening realtime voice without sessionId', async () => {
    const { result } = renderHook(() => useVoiceInterviewSession({
      enabled: true,
      session: buildSession({ id: '' }),
      sessionId: '',
      isPaused: false,
      isCompleted: false,
      isSubmitting: false,
    }));

    await act(async () => {
      await result.current.handleToggleRecording();
    });

    expect(speechSocketMock.connect).not.toHaveBeenCalled();
    expect(result.current.voiceState).toBe('error');
    expect(result.current.voiceStatus.title).toBe('Session missing');
  });

  it('submits confirmed realtime transcript through the text interview flow', async () => {
    const onSubmitTextReply = vi.fn().mockResolvedValue({});
    speechSocketMock.finalTranscript = {
      type: 'final_transcript',
      displayText: 'I used STAR method in a project.',
      confidenceStatus: 'high',
      confidence: 0.93,
    };

    const { result } = renderHook(() => useVoiceInterviewSession({
      enabled: true,
      session: buildSession(),
      sessionId: 'session-1',
      isPaused: false,
      isCompleted: false,
      isSubmitting: false,
      onSubmitTextReply,
    }));

    await act(async () => {});

    expect(result.current.editableTranscript).toBe('I used STAR method in a project.');

    await act(async () => {
      await result.current.handleUseRealtimeTranscript();
    });

    expect(onSubmitTextReply).toHaveBeenCalledWith('I used STAR method in a project.');
    expect(result.current.voiceStatus.title).toBe('Transcript submitted');
  });
});
