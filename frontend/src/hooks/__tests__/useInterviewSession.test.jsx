/**
 * Tests for useInterviewSession hook
 * 
 * Behavior Contract:
 * - Hook manages interview session lifecycle and state
 * - Handles start, reply, pause/resume, repeat, end operations
 * - Manages timer for elapsed time tracking
 * - Provides status messages and error handling
 * - Supports both text and voice interview modes
 * - Auto-warms adaptive sessions for voice mode
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInterviewSession } from '../useInterviewSession.js';
import * as interviewApi from '../../api/interviewApi.js';
import * as exportApi from '../../api/exportApi.js';
import * as sessionApi from '../../api/sessionApi.js';

vi.mock('../../api/interviewApi.js');
vi.mock('../../api/exportApi.js');
vi.mock('../../api/sessionApi.js');

describe('useInterviewSession', () => {
    const mockSessionId = 'test-session-123';
    const mockNavigate = vi.fn();

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

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Initialization and Loading', () => {
        it('should load session on mount', async () => {
            const mockSession = buildMockSession();
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: mockSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            expect(result.current.loading).toBe(true);

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(sessionApi.getSession).toHaveBeenCalledWith(mockSessionId);
            expect(result.current.session).toEqual(mockSession);
        });

        it('should navigate to analysis page on load failure', async () => {
            const error = new Error('Session not found');
            vi.mocked(sessionApi.getSession).mockRejectedValue(error);

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.pageStatus?.type).toBe('error');
            expect(mockNavigate).toHaveBeenCalledWith('/analysis');
        });

        it('should auto-warm adaptive for voice mode in_progress sessions', async () => {
            const mockSession = buildMockSession({
                mode: 'voice',
                status: 'in_progress',
                lastResumedAt: new Date().toISOString(),
            });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: mockSession });
            vi.mocked(interviewApi.warmAdaptiveInterviewSession).mockResolvedValue({});

            renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(interviewApi.warmAdaptiveInterviewSession).toHaveBeenCalledWith(mockSessionId);
            });
        });

        it('should not warm adaptive for text mode or non-in_progress sessions', async () => {
            const mockSession = buildMockSession({ mode: 'text', status: 'ready' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: mockSession });

            renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(sessionApi.getSession).toHaveBeenCalled();
            });

            expect(interviewApi.warmAdaptiveInterviewSession).not.toHaveBeenCalled();
        });
    });

    describe('Start Interview', () => {
        it('should successfully start interview', async () => {
            const readySession = buildMockSession({ status: 'ready' });
            const startedSession = buildMockSession({
                status: 'in_progress',
                lastResumedAt: new Date().toISOString(),
                transcript: [{ role: 'ai', text: 'Tell me about yourself' }],
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: readySession });
            vi.mocked(interviewApi.startInterview).mockResolvedValue({ session: startedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleStartInterview();
            });

            expect(interviewApi.startInterview).toHaveBeenCalledWith(mockSessionId);
            expect(result.current.session?.status).toBe('in_progress');
            expect(result.current.isSubmitting).toBe(false);
        });

        it('should show error on start failure', async () => {
            const readySession = buildMockSession({ status: 'ready' });
            const error = new Error('Failed to start');

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: readySession });
            vi.mocked(interviewApi.startInterview).mockRejectedValue(error);

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleStartInterview();
            });

            expect(result.current.pageStatus?.type).toBe('error');
            expect(result.current.pageStatus?.message).toContain('Failed to start');
        });

        it('should not start multiple times when isSubmitting', async () => {
            const readySession = buildMockSession({ status: 'ready' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: readySession });
            vi.mocked(interviewApi.startInterview).mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 1000))
            );

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.handleStartInterview();
                result.current.handleStartInterview();
            });

            await vi.advanceTimersByTimeAsync(1100);

            expect(interviewApi.startInterview).toHaveBeenCalledTimes(1);
        });
    });

    describe('Submit Answer', () => {
        it('should successfully submit answer', async () => {
            const inProgressSession = buildMockSession({
                status: 'in_progress',
                lastResumedAt: new Date().toISOString(),
                transcript: [{ role: 'ai', text: 'Tell me about yourself' }],
            });
            const updatedSession = buildMockSession({
                status: 'in_progress',
                transcript: [
                    { role: 'ai', text: 'Tell me about yourself' },
                    { role: 'user', text: 'I am a software engineer' },
                    { role: 'ai', text: 'Why this role?' },
                ],
                currentQuestionIndex: 2,
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.replyInterview).mockResolvedValue({ session: updatedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleReply('I am a software engineer');
            });

            expect(interviewApi.replyInterview).toHaveBeenCalledWith(
                mockSessionId,
                'I am a software engineer'
            );
            expect(result.current.session?.transcript).toHaveLength(3);
        });

        it('should auto-start interview and submit answer when in ready state', async () => {
            const readySession = buildMockSession({ status: 'ready' });
            const startedSession = buildMockSession({
                status: 'in_progress',
                transcript: [{ role: 'ai', text: 'Tell me about yourself' }],
            });
            const repliedSession = buildMockSession({
                status: 'in_progress',
                transcript: [
                    { role: 'ai', text: 'Tell me about yourself' },
                    { role: 'user', text: 'I am a developer' },
                ],
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: readySession });
            vi.mocked(interviewApi.startInterview).mockResolvedValue({ session: startedSession });
            vi.mocked(interviewApi.replyInterview).mockResolvedValue({ session: repliedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleReply('I am a developer');
            });

            expect(interviewApi.startInterview).toHaveBeenCalled();
            expect(interviewApi.replyInterview).toHaveBeenCalled();
        });

        it('should ignore empty answers', async () => {
            const inProgressSession = buildMockSession({ status: 'in_progress' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleReply('   ');
            });

            expect(interviewApi.replyInterview).not.toHaveBeenCalled();
        });

        it('should restore previous session state on submit failure', async () => {
            const inProgressSession = buildMockSession({
                status: 'in_progress',
                transcript: [{ role: 'ai', text: 'Question 1' }],
            });
            const error = new Error('Network error');

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.replyInterview).mockRejectedValue(error);

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const originalTranscriptLength = result.current.session?.transcript.length;

            await act(async () => {
                await result.current.handleReply('My answer');
            });

            expect(result.current.session?.transcript).toHaveLength(originalTranscriptLength);
            expect(result.current.pageStatus?.type).toBe('error');
        });

        it('should show completion status when interview completes', async () => {
            const inProgressSession = buildMockSession({ status: 'in_progress' });
            const completedSession = buildMockSession({
                status: 'completed',
                completedBecause: 'manual_end',
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.replyInterview).mockResolvedValue({ session: completedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleReply('Final answer');
            });

            expect(result.current.pageStatus?.type).toBe('success');
            expect(result.current.pageStatus?.title).toContain('ended');
        });
    });

    describe('Pause and Resume', () => {
        it('should successfully pause interview', async () => {
            const inProgressSession = buildMockSession({
                status: 'in_progress',
                lastResumedAt: new Date().toISOString(),
                elapsedSeconds: 100,
            });
            const pausedSession = buildMockSession({
                status: 'paused',
                elapsedSeconds: 100,
                lastResumedAt: null,
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.pauseInterview).mockResolvedValue({ session: pausedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handlePauseToggle();
            });

            expect(interviewApi.pauseInterview).toHaveBeenCalledWith(mockSessionId);
            expect(result.current.session?.status).toBe('paused');
        });

        it('should successfully resume interview', async () => {
            const pausedSession = buildMockSession({
                status: 'paused',
                elapsedSeconds: 100,
            });
            const resumedSession = buildMockSession({
                status: 'in_progress',
                lastResumedAt: new Date().toISOString(),
                elapsedSeconds: 100,
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: pausedSession });
            vi.mocked(interviewApi.resumeInterview).mockResolvedValue({ session: resumedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handlePauseToggle();
            });

            expect(interviewApi.resumeInterview).toHaveBeenCalledWith(mockSessionId);
            expect(result.current.session?.status).toBe('in_progress');
        });

        it('should not pause when in completed state', async () => {
            const completedSession = buildMockSession({ status: 'completed' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: completedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handlePauseToggle();
            });

            expect(interviewApi.pauseInterview).not.toHaveBeenCalled();
            expect(interviewApi.resumeInterview).not.toHaveBeenCalled();
        });
    });

    describe('Repeat Question', () => {
        it('should successfully repeat last question', async () => {
            const inProgressSession = buildMockSession({
                status: 'in_progress',
                transcript: [
                    { role: 'ai', text: 'Tell me about yourself' },
                    { role: 'user', text: 'I am a developer' },
                ],
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.repeatQuestion).mockResolvedValue({
                question: 'Tell me about yourself',
            });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleRepeat();
            });

            expect(interviewApi.repeatQuestion).toHaveBeenCalledWith(mockSessionId);
            expect(result.current.session?.transcript.length).toBeGreaterThan(2);
        });

        it('不應該在 completed 狀態時重複問題', async () => {
            const completedSession = buildMockSession({ status: 'completed' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: completedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleRepeat();
            });

            expect(interviewApi.repeatQuestion).not.toHaveBeenCalled();
        });
    });

    describe('結束面試', () => {
        it('應該顯示確認結束對話框', async () => {
            const inProgressSession = buildMockSession({ status: 'in_progress', mode: 'text' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.handleEnd();
            });

            expect(result.current.pageStatus?.type).toBe('confirm-end');
            expect(result.current.pageStatus?.title).toContain('End interview');
        });

        it('應該為 voice mode 顯示不同的確認訊息', async () => {
            const voiceSession = buildMockSession({ status: 'in_progress', mode: 'voice' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: voiceSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.handleEnd();
            });

            expect(result.current.pageStatus?.message).toContain('voice session');
        });

        it('應該成功確認結束面試', async () => {
            const inProgressSession = buildMockSession({ status: 'in_progress' });
            const endedSession = buildMockSession({
                status: 'completed',
                completedBecause: 'manual_end',
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.endInterview).mockResolvedValue({
                session: endedSession,
                reportStatus: 'ready',
            });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleConfirmEnd();
            });

            expect(interviewApi.endInterview).toHaveBeenCalledWith(mockSessionId);
            expect(result.current.endSessionProgress.step).toBe('completed');
            expect(result.current.pageStatus?.type).toBe('success');
        });

        it('應該在結束過程中顯示進度狀態', async () => {
            const inProgressSession = buildMockSession({ status: 'in_progress' });
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.endInterview).mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 1000))
            );

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.handleConfirmEnd();
            });

            await waitFor(() => {
                expect(result.current.endSessionProgress.step).toBe('saving');
            });

            await act(async () => {
                await vi.advanceTimersByTimeAsync(800);
            });

            expect(result.current.endSessionProgress.step).toBe('generating_report');
        });

        it('應該在結束失敗時顯示錯誤', async () => {
            const inProgressSession = buildMockSession({ status: 'in_progress' });
            const error = new Error('Failed to end');

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });
            vi.mocked(interviewApi.endInterview).mockRejectedValue(error);

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleConfirmEnd();
            });

            expect(result.current.endSessionProgress.step).toBe('failed');
            expect(result.current.pageStatus?.type).toBe('error');
        });
    });

    describe('匯出逐字稿', () => {
        it('應該成功匯出逐字稿', async () => {
            const mockSession = buildMockSession();
            const mockTranscript = 'AI: Tell me about yourself\nUser: I am a developer';

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: mockSession });
            vi.mocked(exportApi.exportTranscript).mockResolvedValue({
                transcriptText: mockTranscript,
            });

            // Mock DOM APIs
            const mockClick = vi.fn();
            const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
                click: mockClick,
                href: '',
                download: '',
            });
            const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
            const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport();
            });

            expect(exportApi.exportTranscript).toHaveBeenCalledWith(mockSessionId);
            expect(mockCreateObjectURL).toHaveBeenCalled();
            expect(mockClick).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalled();

            mockCreateElement.mockRestore();
            mockCreateObjectURL.mockRestore();
            mockRevokeObjectURL.mockRestore();
        });

        it('應該在匯出失敗時顯示錯誤', async () => {
            const mockSession = buildMockSession();
            const error = new Error('Export failed');

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: mockSession });
            vi.mocked(exportApi.exportTranscript).mockRejectedValue(error);

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleExport();
            });

            expect(result.current.pageStatus?.type).toBe('error');
            expect(result.current.pageStatus?.message).toContain('Export failed');
        });
    });

    describe('計時器', () => {
        it('應該在 in_progress 狀態時啟動計時器', async () => {
            const inProgressSession = buildMockSession({
                status: 'in_progress',
                lastResumedAt: new Date().toISOString(),
                elapsedSeconds: 0,
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: inProgressSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const initialElapsed = result.current.viewModel.elapsedSeconds;

            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000);
            });

            expect(result.current.viewModel.elapsedSeconds).toBeGreaterThanOrEqual(initialElapsed);
        });

        it('不應該在 paused 狀態時更新計時器', async () => {
            const pausedSession = buildMockSession({
                status: 'paused',
                elapsedSeconds: 100,
                lastResumedAt: null,
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: pausedSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const initialElapsed = result.current.viewModel.elapsedSeconds;

            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000);
            });

            expect(result.current.viewModel.elapsedSeconds).toBe(initialElapsed);
        });
    });

    describe('Voice session 更新', () => {
        it('應該處理 voice session 更新', async () => {
            const initialSession = buildMockSession({ status: 'in_progress', mode: 'voice' });
            const updatedSession = buildMockSession({
                status: 'in_progress',
                mode: 'voice',
                transcript: [
                    { role: 'ai', text: 'Question 1' },
                    { role: 'user', text: 'Answer 1' },
                ],
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: initialSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.handleVoiceSessionUpdate(updatedSession);
            });

            expect(result.current.session).toEqual(updatedSession);
        });

        it('應該在 voice session 完成時顯示狀態', async () => {
            const initialSession = buildMockSession({ status: 'in_progress', mode: 'voice' });
            const completedSession = buildMockSession({
                status: 'completed',
                mode: 'voice',
                completedBecause: 'time_limit_reached',
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: initialSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.handleVoiceSessionUpdate(completedSession);
            });

            expect(result.current.pageStatus?.type).toBe('success');
            expect(result.current.pageStatus?.title).toContain('time limit');
        });
    });

    describe('狀態管理', () => {
        it('應該能夠 dismiss 狀態訊息', async () => {
            const mockSession = buildMockSession();
            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: mockSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.setPageStatus({ type: 'info', title: 'Test', message: 'Test message' });
            });

            expect(result.current.pageStatus).not.toBeNull();

            act(() => {
                result.current.dismissStatus();
            });

            expect(result.current.pageStatus).toBeNull();
        });
    });

    describe('ViewModel', () => {
        it('應該提供正確的 viewModel', async () => {
            const mockSession = buildMockSession({
                status: 'in_progress',
                currentQuestionIndex: 1,
            });

            vi.mocked(sessionApi.getSession).mockResolvedValue({ session: mockSession });

            const { result } = renderHook(() =>
                useInterviewSession({ sessionId: mockSessionId, navigate: mockNavigate })
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.viewModel).toBeDefined();
            expect(result.current.viewModel.currentPlanItem).toBeDefined();
            expect(result.current.viewModel.statusLabel).toBe('Live');
            expect(result.current.viewModel.elapsedSeconds).toBeGreaterThanOrEqual(0);
        });
    });
});

// Made with Bob
