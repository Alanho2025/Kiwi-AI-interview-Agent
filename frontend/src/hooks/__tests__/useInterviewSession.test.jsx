import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInterviewSession } from '../useInterviewSession.js';
import * as interviewApi from '../../api/interviewApi.js';
import * as exportApi from '../../api/exportApi.js';
import * as sessionApi from '../../api/sessionApi.js';

vi.mock('../../api/interviewApi.js');
vi.mock('../../api/exportApi.js');
vi.mock('../../api/sessionApi.js');

const mockSessionId = 'test-session-123';

const buildMockSession = (overrides = {}) => ({
  id: mockSessionId,
  _id: mockSessionId,
  status: 'ready',
  mode: 'text',
  transcript: [],
  interviewPlan: {
    questionPool: [
      { question: 'Tell me about yourself', category: 'intro' },
      { question: 'Why this role?', category: 'motivation' },
    ],
  },
  currentQuestionIndex: 1,
  elapsedSeconds: 0,
  lastResumedAt: null,
  ...overrides,
});

const renderLoadedHook = async ({ session = buildMockSession(), navigate = vi.fn() } = {}) => {
  vi.mocked(sessionApi.getSession).mockResolvedValue({ session });

  const hook = renderHook(() =>
    useInterviewSession({ sessionId: mockSessionId, navigate })
  );

  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });

  return { ...hook, navigate };
};

describe('useInterviewSession', () => {
  let mockNavigate;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    vi.mocked(interviewApi.warmAdaptiveInterviewSession).mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization and Loading', () => {
    it('loads session on mount', async () => {
      const mockSession = buildMockSession();
      const { result } = await renderLoadedHook({ session: mockSession, navigate: mockNavigate });

      expect(sessionApi.getSession).toHaveBeenCalledWith(mockSessionId);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });

    it('navigates to analysis page on load failure', async () => {
      vi.mocked(sessionApi.getSession).mockRejectedValue(new Error('Session not found'));

      const { result } = renderHook(() =>
        useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pageStatus?.type).toBe('error');
      expect(mockNavigate).toHaveBeenCalledWith('/analysis');
    });

    it('warms adaptive only for in-progress voice sessions', async () => {
      await renderLoadedHook({
        session: buildMockSession({
          mode: 'voice',
          status: 'in_progress',
          lastResumedAt: new Date().toISOString(),
        }),
        navigate: mockNavigate,
      });

      await waitFor(() => {
        expect(interviewApi.warmAdaptiveInterviewSession).toHaveBeenCalledWith(mockSessionId);
      });

      vi.clearAllMocks();

      await renderLoadedHook({
        session: buildMockSession({ mode: 'text', status: 'ready' }),
        navigate: mockNavigate,
      });

      expect(interviewApi.warmAdaptiveInterviewSession).not.toHaveBeenCalled();
    });
  });

  describe('Start Interview', () => {
    it('starts a ready interview', async () => {
      const startedSession = buildMockSession({
        status: 'in_progress',
        lastResumedAt: new Date().toISOString(),
      });
      vi.mocked(interviewApi.startInterview).mockResolvedValue({ session: startedSession });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'ready' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleStartInterview();
      });

      expect(interviewApi.startInterview).toHaveBeenCalledWith(mockSessionId);
      expect(result.current.session).toEqual(startedSession);
      expect(result.current.isSubmitting).toBe(false);
    });

    it('shows error on start failure', async () => {
      vi.mocked(interviewApi.startInterview).mockRejectedValue(new Error('Failed to start'));
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'ready' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleStartInterview();
      });

      expect(result.current.pageStatus?.type).toBe('error');
      expect(result.current.pageStatus?.message).toContain('Failed to start');
    });

    it('does not start an already completed interview', async () => {
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'completed' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleStartInterview();
      });

      expect(interviewApi.startInterview).not.toHaveBeenCalled();
    });
  });

  describe('Submit Answer', () => {
    it('submits answer in an in-progress interview', async () => {
      const updatedSession = buildMockSession({
        status: 'in_progress',
        transcript: [{ role: 'user', text: 'My answer' }],
      });
      vi.mocked(interviewApi.replyInterview).mockResolvedValue({ session: updatedSession });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleReply('My answer');
      });

      expect(interviewApi.replyInterview).toHaveBeenCalledWith(mockSessionId, 'My answer');
      expect(result.current.session).toEqual(updatedSession);
      expect(result.current.isSubmitting).toBe(false);
    });

    it('auto-starts ready interview before submitting answer', async () => {
      const startedSession = buildMockSession({ status: 'in_progress' });
      const repliedSession = buildMockSession({
        status: 'in_progress',
        transcript: [{ role: 'user', text: 'Ready answer' }],
      });
      vi.mocked(interviewApi.startInterview).mockResolvedValue({ session: startedSession });
      vi.mocked(interviewApi.replyInterview).mockResolvedValue({ session: repliedSession });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'ready' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleReply('Ready answer');
      });

      expect(interviewApi.startInterview).toHaveBeenCalledWith(mockSessionId);
      expect(interviewApi.replyInterview).toHaveBeenCalledWith(mockSessionId, 'Ready answer');
      expect(result.current.session).toEqual(repliedSession);
    });

    it('ignores empty answers', async () => {
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleReply('   ');
      });

      expect(interviewApi.replyInterview).not.toHaveBeenCalled();
    });

    it('restores previous session state on submit failure', async () => {
      const previousSession = buildMockSession({
        status: 'in_progress',
        transcript: [{ role: 'ai', text: 'Question' }],
      });
      vi.mocked(interviewApi.replyInterview).mockRejectedValue(new Error('Submit failed'));

      const { result } = await renderLoadedHook({ session: previousSession, navigate: mockNavigate });

      await act(async () => {
        await result.current.handleReply('Answer');
      });

      expect(result.current.session).toEqual(previousSession);
      expect(result.current.pageStatus?.type).toBe('error');
      expect(result.current.pageStatus?.message).toContain('Submit failed');
    });

    it('shows completion status when interview completes', async () => {
      vi.mocked(interviewApi.replyInterview).mockResolvedValue({
        session: buildMockSession({ status: 'completed' }),
      });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleReply('Final answer');
      });

      expect(result.current.pageStatus?.type).toBe('success');
      expect(result.current.pageStatus?.title).toContain('Interview completed');
    });
  });

  describe('Pause and Resume', () => {
    it('pauses an in-progress interview', async () => {
      const pausedSession = buildMockSession({ status: 'paused', elapsedSeconds: 10, lastResumedAt: null });
      vi.mocked(interviewApi.pauseInterview).mockResolvedValue({ session: pausedSession });

      const { result } = await renderLoadedHook({
        session: buildMockSession({
          status: 'in_progress',
          lastResumedAt: new Date().toISOString(),
        }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handlePauseToggle();
      });

      expect(interviewApi.pauseInterview).toHaveBeenCalledWith(mockSessionId);
      expect(result.current.session).toEqual(pausedSession);
    });

    it('resumes a paused interview', async () => {
      const resumedSession = buildMockSession({
        status: 'in_progress',
        elapsedSeconds: 10,
        lastResumedAt: new Date().toISOString(),
      });
      vi.mocked(interviewApi.resumeInterview).mockResolvedValue({ session: resumedSession });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'paused', elapsedSeconds: 10, lastResumedAt: null }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handlePauseToggle();
      });

      expect(interviewApi.resumeInterview).toHaveBeenCalledWith(mockSessionId);
      expect(result.current.session).toEqual(resumedSession);
    });

    it('does not pause or resume a completed interview', async () => {
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'completed' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handlePauseToggle();
      });

      expect(interviewApi.pauseInterview).not.toHaveBeenCalled();
      expect(interviewApi.resumeInterview).not.toHaveBeenCalled();
    });
  });

  describe('Repeat Question', () => {
    it('repeats last question', async () => {
      vi.mocked(interviewApi.repeatQuestion).mockResolvedValue({ question: 'Tell me about yourself' });
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleRepeat();
      });

      expect(interviewApi.repeatQuestion).toHaveBeenCalledWith(mockSessionId);
      expect(result.current.session.transcript.at(-1).text).toBe('Tell me about yourself');
    });

    it('does not repeat question in completed state', async () => {
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'completed' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleRepeat();
      });

      expect(interviewApi.repeatQuestion).not.toHaveBeenCalled();
    });
  });

  describe('End Interview', () => {
    it('shows confirm end dialog for text mode', async () => {
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress', mode: 'text' }),
        navigate: mockNavigate,
      });

      act(() => {
        result.current.handleEnd();
      });

      expect(result.current.pageStatus?.type).toBe('confirm-end');
      expect(result.current.pageStatus?.message).toContain('save your transcript');
    });

    it('shows voice-specific confirm end message', async () => {
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress', mode: 'voice' }),
        navigate: mockNavigate,
      });

      act(() => {
        result.current.handleEnd();
      });

      expect(result.current.pageStatus?.type).toBe('confirm-end');
      expect(result.current.pageStatus?.message).toContain('stop the voice session');
    });

    it('confirms end interview successfully', async () => {
      const endedSession = buildMockSession({ status: 'completed', completedBecause: 'manual_end' });
      vi.mocked(interviewApi.endInterview).mockResolvedValue({ session: endedSession, reportStatus: true });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleConfirmEnd();
      });

      expect(interviewApi.endInterview).toHaveBeenCalledWith(mockSessionId);
      expect(result.current.session).toEqual(endedSession);
      expect(result.current.endSessionProgress.step).toBe('completed');
      expect(result.current.pageStatus?.type).toBe('success');
    });

    it('shows error when end interview fails', async () => {
      vi.mocked(interviewApi.endInterview).mockRejectedValue(new Error('Failed to end'));
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress' }),
        navigate: mockNavigate,
      });

      await act(async () => {
        await result.current.handleConfirmEnd();
      });

      expect(result.current.endSessionProgress.step).toBe('failed');
      expect(result.current.pageStatus?.type).toBe('error');
      expect(result.current.pageStatus?.message).toContain('Failed to end');
    });
  });

  describe('Export Transcript', () => {
    it('exports transcript using a real anchor element', async () => {
      const anchor = document.createElement('a');
      const mockClick = vi.spyOn(anchor, 'click').mockImplementation(() => {});
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
        if (tagName === 'a') return anchor;
        return originalCreateElement(tagName, options);
      });
      const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      vi.mocked(exportApi.exportTranscript).mockResolvedValue({
        transcriptText: 'AI: Tell me about yourself\nUser: I am a developer',
      });
      const { result } = await renderLoadedHook({ navigate: mockNavigate });

      await act(async () => {
        await result.current.handleExport();
      });

      expect(exportApi.exportTranscript).toHaveBeenCalledWith(mockSessionId);
      expect(createObjectUrlSpy).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock');

      createElementSpy.mockRestore();
      createObjectUrlSpy.mockRestore();
      revokeObjectUrlSpy.mockRestore();
      mockClick.mockRestore();
    });

    it('shows error when export fails', async () => {
      vi.mocked(exportApi.exportTranscript).mockRejectedValue(new Error('Export failed'));
      const { result } = await renderLoadedHook({ navigate: mockNavigate });

      await act(async () => {
        await result.current.handleExport();
      });

      expect(result.current.pageStatus?.type).toBe('error');
      expect(result.current.pageStatus?.message).toContain('Export failed');
    });
  });

  describe('Voice session updates and state helpers', () => {
    it('handles voice session update', async () => {
      const updatedSession = buildMockSession({
        status: 'in_progress',
        mode: 'voice',
        transcript: [
          { role: 'ai', text: 'Question 1' },
          { role: 'user', text: 'Answer 1' },
        ],
      });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress', mode: 'voice' }),
        navigate: mockNavigate,
      });

      act(() => {
        result.current.handleVoiceSessionUpdate(updatedSession);
      });

      expect(result.current.session).toEqual(updatedSession);
    });

    it('shows completion status when voice session completes', async () => {
      const completedSession = buildMockSession({
        status: 'completed',
        mode: 'voice',
        completedBecause: 'time_limit_reached',
      });

      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress', mode: 'voice' }),
        navigate: mockNavigate,
      });

      act(() => {
        result.current.handleVoiceSessionUpdate(completedSession);
      });

      expect(result.current.pageStatus?.type).toBe('success');
      expect(result.current.pageStatus?.title).toContain('time limit');
    });

    it('dismisses status messages', async () => {
      const { result } = await renderLoadedHook({ navigate: mockNavigate });

      act(() => {
        result.current.setPageStatus({ type: 'info', title: 'Test', message: 'Test message' });
      });
      expect(result.current.pageStatus).not.toBeNull();

      act(() => {
        result.current.dismissStatus();
      });
      expect(result.current.pageStatus).toBeNull();
    });

    it('provides viewModel values', async () => {
      const { result } = await renderLoadedHook({
        session: buildMockSession({ status: 'in_progress', currentQuestionIndex: 1 }),
        navigate: mockNavigate,
      });

      expect(result.current.viewModel).toBeDefined();
      expect(result.current.viewModel.currentPlanItem).toBeDefined();
      expect(result.current.viewModel.statusLabel).toBe('Live');
      expect(result.current.viewModel.elapsedSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});
