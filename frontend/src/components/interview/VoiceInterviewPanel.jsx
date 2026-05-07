import { useMemo } from 'react';
import { CirclePause, Mic, MicOff, RefreshCcw, Square, Volume2 } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { cn } from '../../utils/formatters.js';

const buildWaveBars = (levels = []) => {
  if (!levels.length) return Array.from({ length: 42 }, () => 0.08);
  return levels.slice(-42).map((value) => Math.max(0.08, Math.min(1, value)));
};

const renderStatusTone = (type) => {
  if (type === 'error') return 'border-red-200 bg-red-50 text-red-700';
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
};

export function VoiceInterviewPanel({
  onPause,
  onRepeat,
  onEnd,
  isPaused,
  isCompleted,
  isSubmitting,
  voiceShell,
  sessionStatus = 'ready',
}) {
  const {
    currentQuestion,
    permissionState,
    permissionError,
    stateLabel,
    voiceStatus,
    realtimeStatus,
    vadState,
    isAutoLoopActive,
    isRecording,
    canUseVoice,
    levelHistory,
    recordingDurationLabel,
    recordingStatus,
    assistantAudioUrl,
    audioRef,
    handleRequestPermission,
    handleToggleRecording,
    handleReplayAssistantAudio,
    handleResetShell,
  } = voiceShell;

  const waveBars = useMemo(() => buildWaveBars(levelHistory), [levelHistory]);
  const isNotStarted = sessionStatus === 'ready';
  const currentQuestionText = currentQuestion?.displayText || currentQuestion?.text || '';
  const statusBadgeLabel = isAutoLoopActive && !isRecording ? stateLabel : (isRecording ? 'Listening...' : stateLabel);
  const voiceActionDisabled = !canUseVoice || isCompleted;
  const displayedVoiceStatus = isCompleted
    ? { type: 'success', title: 'Interview ended', message: 'Your voice session is saved. Review the report or export the transcript when ready.' }
    : voiceStatus;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      {displayedVoiceStatus ? (
        <div className={cn('shrink-0 rounded-2xl border px-4 py-3 text-sm shadow-sm', renderStatusTone(displayedVoiceStatus.type))}>
          <p className="font-semibold">{displayedVoiceStatus.title}</p>
          <p className="mt-1">{displayedVoiceStatus.message}</p>
        </div>
      ) : null}

      {(permissionError && !displayedVoiceStatus) ? (
        <div className="shrink-0 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <p className="font-semibold">Microphone error</p>
          <p className="mt-1">{permissionError}</p>
        </div>
      ) : null}


      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 min-h-0">
          <div className="mx-auto flex min-h-[420px] max-w-[520px] flex-col items-center justify-center gap-6 py-4">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                <span className={cn('h-2.5 w-2.5 rounded-full', isRecording ? 'bg-[#2eb886]' : (isCompleted ? 'bg-emerald-500' : 'bg-gray-300'))} />
                {isCompleted ? 'Session ended' : statusBadgeLabel}
              </div>
              <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 shadow-sm">
                {permissionState} · {realtimeStatus || 'idle'}
              </div>
            </div>

            <div className="relative flex h-[160px] w-[160px] items-center justify-center rounded-full border border-[#cfece0] bg-white">
              <div className={cn('absolute inset-4 rounded-full transition-all duration-200', isRecording ? 'bg-[#2eb886]/20 animate-pulse' : 'bg-[#2eb886]/10')} />
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={voiceActionDisabled}
                className={cn('relative z-10 flex h-[80px] w-[80px] items-center justify-center rounded-full text-white shadow-lg transition-all duration-200', voiceActionDisabled ? 'cursor-not-allowed bg-gray-300' : 'bg-[#2eb886] hover:bg-[#24a673]')}
                aria-label={isCompleted ? 'Voice interview ended' : (isAutoLoopActive || isRecording ? 'Pause voice interview' : 'Start voice interview')}
              >
                {isAutoLoopActive || isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
            </div>

            <div className="text-center h-16 flex flex-col justify-center">
              {isCompleted ? (
                <>
                  <p className="text-lg font-semibold text-emerald-700">Interview ended</p>
                  <p className="mt-1 text-sm text-emerald-600">Live voice controls are closed for this session.</p>
                </>
              ) : isAutoLoopActive ? (
                isRecording ? (
                  <>
                    <p className="text-lg font-bold text-[#2eb886] animate-pulse">You can speak now</p>
                    <p className="mt-1 text-sm text-gray-500">{stateLabel} · {recordingDurationLabel}</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-sky-600">{stateLabel}</p>
                    <p className="mt-1 text-sm text-gray-500">Please wait for your turn</p>
                  </>
                )
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-700">Ready to begin</p>
                  <p className="mt-1 text-sm text-gray-500">Click the microphone to start the interview</p>
                </>
              )}
            </div>

            <div className="flex h-[78px] w-full items-end justify-between gap-1 overflow-hidden rounded-3xl bg-white px-4 py-4 shadow-sm">
              {waveBars.map((value, index) => (
                <div
                  key={`wave-${index}`}
                  className={cn('w-full rounded-full transition-all duration-100', isRecording ? 'bg-blue-500' : (isCompleted ? 'bg-blue-100' : 'bg-blue-200'))}
                  style={{ height: `${Math.round(value * 100)}%` }}
                />
              ))}
            </div>

            {isCompleted ? (
              <div className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-center text-sm text-emerald-700 shadow-sm">
                Session ended. Report, transcript, and recording actions are available outside the live voice controls.
              </div>
            ) : null}
          </div>
        </div>

        {!isCompleted ? (
          <div className={cn('shrink-0 border-t p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors', isPaused ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100')}>
            {isPaused ? (
            <div className="flex flex-col items-center justify-center py-3">
              <p className="text-lg font-semibold text-amber-700">Interview Paused</p>
              <p className="mt-1 text-sm text-amber-600">Click Resume to continue your interview.</p>
            </div>
            ) : (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Voice-only question mode</p>
              <p className="text-lg font-medium leading-7 text-gray-900 pr-2">
                {isNotStarted ? 'Click the mic button when you are ready. The timer starts only after Voice Interview begins.' : (currentQuestionText ? 'Listen to KiwiCoach. Start speaking if you need to interrupt, or answer when the listening state appears.' : 'Waiting for the interviewer voice.')}
              </p>
            </>
            )}
          </div>
        ) : null}

        <div className="shrink-0 border-t border-gray-200 bg-white p-4">
          {isCompleted ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Live controls are closed.</p>
              <Button variant="secondary" size="sm" onClick={handleReplayAssistantAudio} disabled={!assistantAudioUrl}>
                <Volume2 className="mr-2 h-4 w-4" />
                Replay
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={onPause} disabled={isNotStarted || isSubmitting}>
                  <CirclePause className="mr-2 h-4 w-4" />
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const played = handleReplayAssistantAudio();
                    if (!played) onRepeat();
                  }}
                  disabled={isNotStarted || isSubmitting}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Repeat Question
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={handleRequestPermission}><Mic className="mr-2 h-4 w-4" />Allow Mic</Button>
                <Button variant="secondary" size="sm" onClick={handleReplayAssistantAudio} disabled={isNotStarted}><Volume2 className="mr-2 h-4 w-4" />Replay</Button>
                <Button variant="secondary" size="sm" onClick={handleResetShell}><MicOff className="mr-2 h-4 w-4" />Reset</Button>
                <Button variant="danger" onClick={onEnd} disabled={isSubmitting}>End Interview</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} controls src={assistantAudioUrl || undefined} className="hidden" />
    </div>
  );
}
