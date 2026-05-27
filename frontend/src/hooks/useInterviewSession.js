/**
 * File responsibility: Custom React hook.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: useInterviewSession should manage state transitions, side effects, and derived values while keeping UI files thin.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endInterview, pauseInterview, repeatQuestion, replyInterview, resumeInterview, startInterview, warmAdaptiveInterviewSession } from '../api/interviewApi.js';
import { exportTranscript } from '../api/exportApi.js';
import { getSession } from '../api/sessionApi.js';
import { buildInterviewDisplayModel } from '../utils/buildInterviewDisplayModel.js';

const buildStatus = (type, title, message) => ({ type, title, message });

const appendTranscriptMessage = (transcript = [], role, text, metadata = {}) => [
  ...transcript,
  { role, text, metadata, timestamp: new Date().toISOString() },
];

const getCurrentPlanItem = (session) => {
  const items = session?.interviewPlan?.questionPool || [];
  return items[Math.max(0, (session?.currentQuestionIndex || 1) - 1)] || null;
};

const downloadTranscriptFile = ({ transcriptText, sessionId }) => {
  const blob = new Blob([transcriptText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `transcript-${sessionId}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const toSafeElapsedSeconds = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const getActiveElapsedSeconds = (session = {}, nowMs = Date.now()) => {
  if (session?.status !== 'in_progress' || !session?.lastResumedAt) return 0;
  const resumedAtMs = new Date(session.lastResumedAt).getTime();
  if (!Number.isFinite(resumedAtMs)) return 0;
  const elapsedMs = nowMs - resumedAtMs;
  return elapsedMs > 0 ? Math.floor(elapsedMs / 1000) : 0;
};

const getDisplayElapsedSeconds = (session = {}, nowMs = Date.now()) => (
  toSafeElapsedSeconds(session?.elapsedSeconds) + getActiveElapsedSeconds(session, nowMs)
);

const buildCompletedStatus = (session = {}) => {
  const reason = session?.completedBecause || session?.metadata?.completedBecause;
  if (reason === 'time_limit_reached') {
    return buildStatus(
      'success',
      'Interview time limit reached',
      'The planned interview time has ended. Your session is saved, and you can now review the report.'
    );
  }
  if (reason === 'manual_end') {
    return buildStatus(
      'success',
      'Interview ended',
      'Your session is saved. You can now review the report or export the transcript.'
    );
  }
  return buildStatus(
    'success',
    'Interview completed',
    'The planned question set is finished. You can now review the report.'
  );
};

export function useInterviewSession({ sessionId, navigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timerTick, setTimerTick] = useState(0);
  const [pageStatus, setPageStatus] = useState(null);
  const [endSessionProgress, setEndSessionProgress] = useState({
    active: false,
    step: 'idle',
    error: null,
  });
  const warmedAdaptiveRef = useRef(new Set());

  const warmAdaptiveInBackground = useCallback((nextSession) => {
    const nextSessionId = nextSession?.id || nextSession?._id || sessionId;
    const isVoiceSession = String(nextSession?.mode || '').toLowerCase() === 'voice';
    const isInProgress = nextSession?.status === 'in_progress';
    if (!nextSessionId || !isVoiceSession || !isInProgress || warmedAdaptiveRef.current.has(nextSessionId)) return;

    warmedAdaptiveRef.current.add(nextSessionId);
    warmAdaptiveInterviewSession(nextSessionId).catch((error) => {
      warmedAdaptiveRef.current.delete(nextSessionId);
      console.warn('[voice-latency] adaptive warm-up failed', error);
    });
  }, [sessionId]);

  const loadSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data.session);
      warmAdaptiveInBackground(data.session);
    } catch (error) {
      setPageStatus(buildStatus('error', 'Could not load interview', error.message || 'Failed to load session.'));
      navigate('/analysis');
    } finally {
      setLoading(false);
    }
  }, [navigate, sessionId, warmAdaptiveInBackground]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    warmAdaptiveInBackground(session);
  }, [session, warmAdaptiveInBackground]);

  const timerSessionKey = `${session?.id || session?._id || sessionId}:${session?.status || 'unknown'}:${session?.lastResumedAt || ''}:${session?.elapsedSeconds || 0}`;
  const isTimerActive = session?.status === 'in_progress' && Boolean(session?.lastResumedAt);

  useEffect(() => {
    setTimerTick(0);
    if (!isTimerActive) return undefined;
    const interval = setInterval(() => setTimerTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerActive, timerSessionKey]);

  const handleStartInterview = useCallback(async () => {
    if (!sessionId || isSubmitting) return session;
    if (session?.status && session.status !== 'ready') return session;

    setIsSubmitting(true);
    try {
      const data = await startInterview(sessionId);
      setTimerTick(0);
      setSession(data.session);
      warmAdaptiveInBackground(data.session);
      return data.session;
    } catch (error) {
      setPageStatus(buildStatus('error', 'Start failed', error.message || 'Could not start the interview.'));
      return session;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, session, sessionId, warmAdaptiveInBackground]);

  const handleReply = useCallback(async (answer) => {
    const cleanAnswer = answer?.trim();
    if (isSubmitting || !cleanAnswer) return;

    setIsSubmitting(true);
    const previousSession = session ? { ...session } : null;

    try {
      if (session?.status === 'ready') {
        const startData = await startInterview(sessionId);
        setTimerTick(0);
        setSession(startData.session);
        warmAdaptiveInBackground(startData.session);
      }

      setSession((prev) => prev
        ? { ...prev, transcript: appendTranscriptMessage(prev.transcript, 'user', cleanAnswer) }
        : prev);

      const data = await replyInterview(sessionId, cleanAnswer);
      setTimerTick(0);
      setSession(data.session);

      if (data.session?.status === 'completed') {
        setPageStatus(buildCompletedStatus(data.session));
      }
    } catch (error) {
      if (previousSession) {
        setSession(previousSession);
      }
      setPageStatus(buildStatus('error', 'Reply failed', error.message || 'Could not send your answer.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, session, sessionId, warmAdaptiveInBackground]);

  const handleVoiceSessionUpdate = useCallback((nextSession) => {
    setTimerTick(0);
    setSession(nextSession);
    if (nextSession?.status === 'completed') {
      setPageStatus(buildCompletedStatus(nextSession));
    }
  }, []);

  const handlePauseToggle = useCallback(async () => {
    if (session?.status === 'completed' || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (session?.status === 'in_progress') {
        const frozenElapsedSeconds = getDisplayElapsedSeconds(session);
        setSession((prev) => prev ? {
          ...prev,
          status: 'paused',
          elapsedSeconds: frozenElapsedSeconds,
          lastResumedAt: null,
        } : prev);
        setTimerTick(0);
      }

      const data = session?.status === 'paused'
        ? await resumeInterview(sessionId)
        : await pauseInterview(sessionId);

      setTimerTick(0);
      setSession(data.session);
    } catch (error) {
      setPageStatus(buildStatus('error', 'Pause/resume failed', error.message || 'Could not update interview status.'));
      await loadSession();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, loadSession, session, sessionId]);

  const handleRepeat = useCallback(async () => {
    if (session?.status === 'completed') return;

    try {
      const data = await repeatQuestion(sessionId);
      if (!data.question) return;

      setSession((prev) => {
        if (!prev) return prev;
        const lastMessage = prev.transcript[prev.transcript.length - 1];
        if (lastMessage?.role === 'ai' && lastMessage.text === data.question) {
          return prev;
        }
        return {
          ...prev,
          transcript: appendTranscriptMessage(prev.transcript, 'ai', data.question, {
            repeatOnly: true,
          }).map((turn, index, turns) => (
            index === turns.length - 1 && turn.role === 'ai'
              ? { ...turn, displayText: data.question }
              : turn
          )),
        };
      });
    } catch (error) {
      setPageStatus(buildStatus('error', 'Repeat failed', error.message || 'Could not repeat the last question.'));
    }
  }, [session?.status, sessionId]);

  const handleEnd = useCallback((options = {}) => {
    const mode = options.mode || session?.mode || 'text';
    const isVoiceEnd = String(mode).toLowerCase() === 'voice';

    if (session?.status === 'in_progress') {
      const frozenElapsedSeconds = getDisplayElapsedSeconds(session);
      setSession((prev) => prev ? {
        ...prev,
        elapsedSeconds: frozenElapsedSeconds,
        lastResumedAt: null,
      } : prev);
      setTimerTick(0);
    }

    setEndSessionProgress({ active: false, step: 'idle', error: null });
    setPageStatus(buildStatus(
      'confirm-end',
      'End interview?',
      isVoiceEnd
        ? 'This will stop the voice session, save your transcript, and generate your report.'
        : 'This will save your transcript and generate your report.'
    ));
  }, [session]);

  const handleConfirmEnd = useCallback(async () => {
    let progressTimer = null;

    try {
      setEndSessionProgress({ active: true, step: 'saving', error: null });
      setPageStatus(buildStatus('info', 'Ending session', 'Saving your interview session...'));

      progressTimer = window.setTimeout(() => {
        setEndSessionProgress({ active: true, step: 'generating_report', error: null });
        setPageStatus(buildStatus('info', 'Generating report', 'Your interview is saved. KiwiCoach is preparing the report.'));
      }, 700);

      const data = await endInterview(sessionId);
      if (progressTimer) window.clearTimeout(progressTimer);

      setTimerTick(0);
      setSession(data.session);
      setEndSessionProgress({ active: true, step: 'completed', error: null });
      setPageStatus(buildStatus(
        'success',
        'Interview ended',
        data.reportStatus
          ? 'Your session is saved and the report is ready.'
          : 'Your session is saved. You can now review or export the transcript.'
      ));
    } catch (error) {
      if (progressTimer) window.clearTimeout(progressTimer);
      setEndSessionProgress({
        active: true,
        step: 'failed',
        error: error.message || 'Could not end interview.',
      });
      setPageStatus(buildStatus('error', 'Could not end interview', error.message || 'Please try again.'));
    }
  }, [sessionId]);

  const handleExport = useCallback(async () => {
    try {
      const result = await exportTranscript(sessionId);
      downloadTranscriptFile({ transcriptText: result.transcriptText, sessionId });
    } catch (error) {
      setPageStatus(buildStatus('error', 'Export failed', error.message || 'Could not export the transcript.'));
    }
  }, [sessionId]);

  const dismissStatus = useCallback(() => {
    setPageStatus(null);
    if (endSessionProgress.step !== 'completed') {
      setEndSessionProgress({ active: false, step: 'idle', error: null });
    }
  }, [endSessionProgress.step]);

  const viewModel = useMemo(() => {
    const currentPlanItem = getCurrentPlanItem(session);
    const displayModel = buildInterviewDisplayModel(session, currentPlanItem);
    const nowMs = Date.now() + timerTick * 0;

    return {
      currentPlanItem,
      ...displayModel,
      elapsedSeconds: getDisplayElapsedSeconds(session, nowMs),
      statusLabel: session?.status === 'in_progress' ? 'Live' : session?.status,
    };
  }, [session, timerTick]);

  return {
    session,
    loading,
    isSubmitting,
    pageStatus,
    endSessionProgress,
    setPageStatus,
    dismissStatus,
    handleStartInterview,
    handleReply,
    handleVoiceSessionUpdate,
    handlePauseToggle,
    handleRepeat,
    handleEnd,
    handleConfirmEnd,
    handleExport,
    viewModel,
  };
}
