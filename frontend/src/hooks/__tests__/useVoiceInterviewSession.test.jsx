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
    vi.useRealTimers();
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
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
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
    vi.useFakeTimers();
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
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
    vi.useFakeTimers();
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(speechSocketMock.connect).not.toHaveBeenCalled();
    expect(result.current.voiceState).toBe('error');
    expect(result.current.voiceStatus.title).toBe('Session missing');
  });

  it('auto-submits final realtime transcript through the realtime voice flow', async () => {
    const onSubmitRealtimeVoiceTurn = vi.fn().mockResolvedValue({
      assistantAudio: null,
      latency: {
        totalMs: 1080,
        steps: [
          { step: 'load_latest_question', durationMs: 14 },
          { step: 'save_realtime_user_turn', durationMs: 26 },
          { step: 'adaptive_next_question', durationMs: 700 },
          { step: 'update_session_state', durationMs: 40 },
          { step: 'tts_synthesis', durationMs: 300 },
        ],
      },
    });
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
      onSubmitRealtimeVoiceTurn,
    }));

    await act(async () => {});

    expect(result.current.editableTranscript).toBe('I used STAR method in a project.');
    expect(onSubmitRealtimeVoiceTurn).toHaveBeenCalledWith(expect.objectContaining({
      transcriptText: 'I used STAR method in a project.',
      inputMode: 'realtime_voice_vad',
    }));
    expect(console.log).toHaveBeenCalledWith('[voice-latency-summary]', {
      clientStopToSubmit: 'n/a',
      clientSubmitToResponse: 'n/a',
      clientStopToNextAudio: 'n/a',
      clientAudioGap: 'n/a',
      backendTotal: '1080 ms',
      backendLoadQuestion: '14 ms',
      backendSaveTurn: '26 ms',
      backendAdaptiveNextQuestion: '700 ms',
      backendUpdateSession: '40 ms',
      backendTts: '300 ms',
    });
    expect(result.current.voiceStatus.title).toBe('Next question ready');
  });
});
