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
import { endInterview, pauseInterview, repeatQuestion, replyInterview, resumeInterview, startInterview } from '../api/interviewApi.js';
import { exportTranscript } from '../api/exportApi.js';
import { getSession } from '../api/sessionApi.js';

/**
 * Purpose: Execute the main responsibility for buildStatus.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildStatus = (type, title, message) => ({ type, title, message });

const appendTranscriptMessage = (transcript = [], role, text) => [
  ...transcript,
  { role, text, timestamp: new Date().toISOString() },
];

/**
 * Purpose: Execute the main responsibility for getCurrentPlanItem.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const getCurrentPlanItem = (session) => {
  const items = session?.interviewPlan?.questionPool || [];
  return items[Math.max(0, (session?.currentQuestionIndex || 1) - 1)] || null;
};

/**
 * Purpose: Execute the main responsibility for downloadTranscriptFile.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const downloadTranscriptFile = ({ transcriptText, sessionId }) => {
  const blob = new Blob([transcriptText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `transcript-${sessionId}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
};

/**
 * Purpose: Execute the main responsibility for useInterviewSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function useInterviewSession({ sessionId, navigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timerOffset, setTimerOffset] = useState(0);
  const [pageStatus, setPageStatus] = useState(null);
  const hasStartedRef = useRef(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data.session);

      if (data.session.status === 'ready' && !hasStartedRef.current) {
        hasStartedRef.current = true;
        const startData = await startInterview(sessionId);
        setSession(startData.session);
      }
    } catch (error) {
      setPageStatus(buildStatus('error', 'Could not load interview', error.message || 'Failed to load session.'));
      navigate('/analysis');
    } finally {
      setLoading(false);
    }
  }, [navigate, sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!session || session.status !== 'in_progress') {
      return undefined;
    }

    setTimerOffset(0);
    const interval = setInterval(() => setTimerOffset((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handleReply = useCallback(async (answer) => {
    const cleanAnswer = answer?.trim();
    if (isSubmitting || !cleanAnswer) return;

    setIsSubmitting(true);
    const previousSession = session ? { ...session } : null;

    try {
      setSession((prev) => prev
        ? { ...prev, transcript: appendTranscriptMessage(prev.transcript, 'user', cleanAnswer) }
        : prev);

      const data = await replyInterview(sessionId, cleanAnswer);
      setSession(data.session);

      if (data.session?.status === 'completed') {
        setPageStatus(buildStatus('success', 'Interview completed', 'The planned question set is finished. You can now review the report.'));
      }
    } catch (error) {
      if (previousSession) {
        setSession(previousSession);
      }
      setPageStatus(buildStatus('error', 'Reply failed', error.message || 'Could not send your answer.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, session, sessionId]);

  const handlePauseToggle = useCallback(async () => {
    if (session?.status === 'completed') return;

    try {
      const data = session?.status === 'paused'
        ? await resumeInterview(sessionId)
        : await pauseInterview(sessionId);
      setSession(data.session);
    } catch (error) {
      setPageStatus(buildStatus('error', 'Pause/resume failed', error.message || 'Could not update interview status.'));
    }
  }, [session?.status, sessionId]);

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
        return { ...prev, transcript: appendTranscriptMessage(prev.transcript, 'ai', data.question) };
      });
    } catch (error) {
      setPageStatus(buildStatus('error', 'Repeat failed', error.message || 'Could not repeat the last question.'));
    }
  }, [session?.status, sessionId]);

  const handleEnd = useCallback(() => {
    setPageStatus(buildStatus('confirm-end', 'End interview?', 'This will mark the text interview as completed.'));
  }, []);

  const handleConfirmEnd = useCallback(async () => {
    try {
      const data = await endInterview(sessionId);
      setSession(data.session);
      setPageStatus(buildStatus('success', 'Interview ended', 'You can now review or export the text transcript.'));
    } catch (error) {
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

  const dismissStatus = useCallback(() => setPageStatus(null), []);

  const viewModel = useMemo(() => {
    const rubric = session?.analysisResult?.parsedJdProfile || session?.analysisResult?.matchingDetails?.rubric || {};
    const currentPlanItem = getCurrentPlanItem(session);
    const roleMetaLabel = String(rubric.roleCanonical || '')
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return {
      rubric,
      currentPlanItem,
      displayRole: rubric.title || session?.targetRole,
      compactRoleLabel: roleMetaLabel || rubric.title || session?.targetRole || 'Role',
      elapsedSeconds: (session?.elapsedSeconds || 0) + (session?.status === 'in_progress' ? timerOffset : 0),
      stageLabel: String(currentPlanItem?.stage || 'opening').replace(/_/g, ' '),
      statusLabel: session?.status === 'in_progress' ? 'Live' : session?.status,
    };
  }, [session, timerOffset]);

  return {
    session,
    loading,
    isSubmitting,
    pageStatus,
    setPageStatus,
    dismissStatus,
    handleReply,
    handlePauseToggle,
    handleRepeat,
    handleEnd,
    handleConfirmEnd,
    handleExport,
    viewModel,
  };
}
