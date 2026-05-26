import { useMemo, useState } from 'react';
import { CirclePause, Mic, MicOff, RefreshCcw, Square, Volume2 } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { TextArea } from '../common/TextArea.jsx';
import { cn } from '../../utils/formatters.js';

const buildWaveBars = (levels = []) => {
  if (!levels.length) return Array.from({ length: 42 }, () => 0.08);
  return levels.slice(-42).map((value) => Math.max(0.08, Math.min(1, value)));
};

const renderStatusTone = (type) => {
  if (type === 'error') return 'border-red-200 bg-red-50 text-red-700';
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (type === 'warning') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-sky-200 bg-sky-50 text-sky-700';
};

const resolveUserFacingConnectionLabel = ({ isCompleted, permissionState, realtimeStatus }) => {
  if (isCompleted) return 'Session saved';
  if (permissionState !== 'granted') return 'Mic permission needed';
  if (realtimeStatus === 'connected') return 'Voice connected';
  if (realtimeStatus === 'connecting') return 'Connecting voice';
  return 'Voice ready';
};

export function VoiceInterviewPanel({
  onPause,
  onRepeat,
  onEnd,
  onSubmitBackup,
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
    voiceState,
    voiceStatus,
    realtimeStatus,
    isAutoLoopActive,
    isRecording,
    canUseVoice,
    levelHistory,
    recordingDurationLabel,
    isVoiceTakingLong,
    voiceNetworkQuality,
    lastTranscriptRejection,
    assistantAudioUrl,
    audioRef,
    handleRequestPermission,
    handleToggleRecording,
    handleReplayAssistantAudio,
    handleResetShell,
    handleRetryVoice,
  } = voiceShell;

  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textFallback, setTextFallback] = useState('');

  const waveBars = useMemo(() => buildWaveBars(levelHistory), [levelHistory]);
  const isNotStarted = sessionStatus === 'ready';
  const currentQuestionText = currentQuestion?.displayText || currentQuestion?.text || '';
  const statusBadgeLabel = isAutoLoopActive && !isRecording ? stateLabel : (isRecording ? 'Listening...' : stateLabel);
  const voiceActionDisabled = !canUseVoice || isCompleted;
  const connectionLabel = resolveUserFacingConnectionLabel({ isCompleted, permissionState, realtimeStatus });
  const displayedVoiceStatus = isCompleted
    ? { type: 'success', title: 'Interview ended', message: 'Your session is saved. Review the report or export the transcript when you are ready.' }
    : voiceStatus;
  const hasVoiceError = voiceState === 'error' || displayedVoiceStatus?.type === 'error';
  const shouldShowRecovery = !isCompleted && (Boolean(lastTranscriptRejection) || Boolean(isVoiceTakingLong) || hasVoiceError);
  const shouldShowNetworkWarning = !isCompleted && isAutoLoopActive && ['warning', 'poor'].includes(voiceNetworkQuality?.status);
  const networkTone = voiceNetworkQuality?.status === 'poor'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-sky-200 bg-sky-50 text-sky-800';
  const recoveryTitle = lastTranscriptRejection
    ? 'Speech was not captured clearly'
    : isVoiceTakingLong
      ? 'Voice is taking longer than expected'
      : 'Voice connection needs attention';
  const recoveryMessage = lastTranscriptRejection
    ? 'Try again or answer by text. Your accent is not scored.'
    : isVoiceTakingLong
      ? 'Keep waiting, restart voice, or answer this question by text.'
      : 'Restart voice, or use text for this question and continue the session.';
  const submitTextFallback = () => {
    const cleanText = textFallback.trim();
    if (!cleanText || isSubmitting) return;
    onSubmitBackup?.(cleanText);
    setTextFallback('');
    setShowTextFallback(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      {!isCompleted ? (
        <div className="shrink-0 rounded-xl border border-theme glass px-4 py-3 text-xs leading-5 text-muted shadow-sm">
          <span className="font-semibold text-primary">Scoring note:</span> Kiwi Coach scores your answer content and communication clarity, not whether you sound native. Retry or answer by text if speech recognition misses your answer.
        </div>
      ) : null}

      {displayedVoiceStatus ? (
        <div className={cn('shrink-0 rounded-xl border px-4 py-3 text-sm shadow-sm', renderStatusTone(displayedVoiceStatus.type))}>
          <p className="font-semibold">{displayedVoiceStatus.title}</p>
          <p className="mt-1">{displayedVoiceStatus.message}</p>
        </div>
      ) : null}

      {shouldShowNetworkWarning ? (
        <div className={cn('shrink-0 rounded-xl border px-4 py-3 text-sm shadow-sm', networkTone)}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{voiceNetworkQuality.title}</p>
                {voiceNetworkQuality.rttMs != null ? (
                  <span className="shrink-0 rounded-full glass/60 px-2 py-0.5 text-[10px] font-semibold">
                    {voiceNetworkQuality.rttMs}ms
                  </span>
                ) : null}
              </div>
              <p className="mt-1 leading-6">{voiceNetworkQuality.message}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowTextFallback(false)}>
                Keep going
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  handleResetShell?.();
                  setShowTextFallback((value) => !value);
                }}
                disabled={!onSubmitBackup}
              >
                Answer by text
              </Button>
            </div>
          </div>

          {showTextFallback && !shouldShowRecovery ? (
            <div className="mt-4 rounded-xl border border-white/50 glass/50 p-3">
              <TextArea
                value={textFallback}
                onChange={(event) => setTextFallback(event.target.value)}
                rows={3}
                placeholder="Type the answer you want to give for this question..."
                disabled={isSubmitting}
              />
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={submitTextFallback} disabled={!textFallback.trim() || isSubmitting}>
                  Submit text answer
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {(permissionError && !displayedVoiceStatus) ? (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <p className="font-semibold">Microphone error</p>
          <p className="mt-1">{permissionError}</p>
        </div>
      ) : null}

      {shouldShowRecovery ? (
        <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold">{recoveryTitle}</p>
              <p className="mt-1 leading-6">{recoveryMessage}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!lastTranscriptRejection ? (
                <Button variant="secondary" size="sm" onClick={handleRetryVoice}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry voice
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  handleResetShell?.();
                  setShowTextFallback((value) => !value);
                }}
                disabled={!onSubmitBackup}
              >
                Answer by text
              </Button>
            </div>
          </div>

          {showTextFallback ? (
            <div className="mt-4 rounded-xl border border-amber-100 glass p-3">
              <TextArea
                value={textFallback}
                onChange={(event) => setTextFallback(event.target.value)}
                rows={3}
                placeholder="Type the answer you want to give for this question..."
                disabled={isSubmitting}
              />
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={submitTextFallback} disabled={!textFallback.trim() || isSubmitting}>
                  Submit text answer
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}


      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-theme glass shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto bg-transparent p-4 flex flex-col justify-center">
          <div className="mx-auto flex w-full max-w-[520px] flex-col items-center justify-center gap-4 sm:gap-6 py-2">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-theme glass px-4 py-2 text-sm font-medium text-muted shadow-sm">
                <span className={cn('h-2.5 w-2.5 rounded-full', isRecording ? '[background:var(--accent)]' : (isCompleted ? 'bg-emerald-500' : 'bg-gray-300'))} />
                {isCompleted ? 'Session ended' : statusBadgeLabel}
              </div>
              <div className="rounded-xl glass px-4 py-2 text-xs font-semibold text-muted shadow-sm">
                {connectionLabel}
              </div>
            </div>

            <div className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full border border-theme glass sm:h-[132px] sm:w-[132px] xl:h-[160px] xl:w-[160px]">
              <div className={cn('absolute inset-4 rounded-full transition-all duration-200', isRecording ? '[background:var(--accent)]/20 animate-pulse' : '[background:var(--accent)]/10')} />
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={voiceActionDisabled}
                className={cn('relative z-10 flex h-[64px] w-[64px] items-center justify-center rounded-full text-primary shadow-lg transition-all duration-200 sm:h-[68px] sm:w-[68px] xl:h-[78px] xl:w-[78px]', voiceActionDisabled ? 'cursor-not-allowed bg-gray-300' : '[background:var(--accent)] hover:[background:var(--accent)]')}
                aria-label={isCompleted ? 'Voice interview ended' : (isAutoLoopActive || isRecording ? 'Pause voice interview' : 'Start voice interview')}
              >
                {isAutoLoopActive || isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
            </div>

            <div className="text-center min-h-[52px] flex flex-col justify-center">
              {isCompleted ? (
                <>
                  <p className="text-lg font-semibold text-emerald-700">Interview ended</p>
                  <p className="mt-1 text-sm text-emerald-600">Review your report or export the transcript when you are ready.</p>
                </>
              ) : isAutoLoopActive ? (
                isRecording ? (
                  <>
                    <p className="text-lg font-bold text-accent animate-pulse">You can speak now</p>
                    <p className="mt-1 text-sm text-faint">{stateLabel} · {recordingDurationLabel}</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-sky-600">{stateLabel}</p>
                    <p className="mt-1 text-sm text-faint">Wait for the listening state before answering.</p>
                  </>
                )
              ) : (
                <>
                  <p className="text-lg font-bold text-muted">Ready to begin</p>
                  <p className="mt-1 text-sm text-faint">Click the microphone to start voice practice.</p>
                </>
              )}
            </div>

          </div>
        </div>

        <div className="shrink-0 bg-transparent px-4 pb-4">
          <div className="mx-auto w-full max-w-[520px]">
            <div className="flex h-[48px] sm:h-[58px] w-full items-end justify-between gap-1 overflow-hidden rounded-xl glass px-4 py-3 shadow-sm">
              {waveBars.map((value, index) => (
                <div
                  key={`wave-${index}`}
                  className={cn('w-full rounded-full transition-all duration-100', isRecording ? 'bg-blue-500' : (isCompleted ? 'bg-blue-100' : 'bg-blue-200'))}
                  style={{ height: `${Math.round(value * 100)}%` }}
                />
              ))}
            </div>

            {isCompleted ? (
              <div className="mt-3 w-full rounded-xl border border-emerald-100 glass px-4 py-3 text-center text-sm text-emerald-700 shadow-sm">
                Session ended. Report, transcript, and recording actions are available outside the live voice controls.
              </div>
            ) : null}
          </div>
        </div>

        {!isCompleted ? (
          <div className={cn('shrink-0 border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors', isPaused ? 'bg-amber-50 border-amber-200' : 'glass border-gray-100')}>
            {isPaused ? (
            <div className="flex flex-col items-center justify-center py-3">
              <p className="text-lg font-semibold text-amber-700">Interview paused</p>
              <p className="mt-1 text-sm text-amber-600">Click Resume when you are ready to continue.</p>
            </div>
            ) : (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">Voice practice mode</p>
              <p className="text-lg font-medium leading-7 text-primary pr-2">
                {isNotStarted ? 'Click the microphone when you are ready. The timer starts after voice practice begins.' : (currentQuestionText ? 'Listen to Kiwi Coach. Answer when the listening state appears. Use replay or text fallback if needed.' : 'Waiting for the next interviewer question.')}
              </p>
            </>
            )}
          </div>
        ) : null}

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-theme glass p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] lg:static lg:shadow-none">
          {isCompleted ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-faint">Live voice controls are closed.</p>
              <Button variant="secondary" size="sm" onClick={handleReplayAssistantAudio} disabled={!assistantAudioUrl}>
                <Volume2 className="mr-2 h-4 w-4" />
                Replay audio
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" className="px-3" onClick={onPause} disabled={isNotStarted || isSubmitting}>
                  <CirclePause className="mr-2 h-4 w-4" />
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="secondary"
                  className="px-3"
                  onClick={() => {
                    const played = handleReplayAssistantAudio();
                    if (!played) onRepeat();
                  }}
                  disabled={isNotStarted || isSubmitting}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Ask again
                </Button>
                <Button variant="danger" className="px-3" onClick={onEnd} disabled={isSubmitting}>End</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" size="sm" className="px-2" onClick={handleRequestPermission}><Mic className="mr-1 h-4 w-4 sm:mr-2" />Mic</Button>
                <Button variant="secondary" size="sm" className="px-2 text-xs sm:text-sm" onClick={handleReplayAssistantAudio} disabled={isNotStarted}><Volume2 className="mr-1 h-4 w-4 sm:mr-2" />Replay audio</Button>
                <Button variant="secondary" size="sm" className="px-2 text-xs sm:text-sm" onClick={handleResetShell}><MicOff className="mr-1 h-4 w-4 sm:mr-2" />Restart voice</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} controls playsInline className="hidden" />
    </div>
  );
}
