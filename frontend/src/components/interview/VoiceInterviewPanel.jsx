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
    ? { type: 'success', title: 'Interview ended', message: 'Your voice session is saved. Review the report or export the transcript when ready.' }
    : voiceStatus;
  const hasVoiceError = voiceState === 'error' || displayedVoiceStatus?.type === 'error';
  const shouldShowRecovery = !isCompleted && (Boolean(lastTranscriptRejection) || Boolean(isVoiceTakingLong) || hasVoiceError);
  const shouldShowNetworkWarning = !isCompleted && isAutoLoopActive && ['warning', 'poor'].includes(voiceNetworkQuality?.status);
  const networkTone = voiceNetworkQuality?.status === 'poor'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-sky-200 bg-sky-50 text-sky-800';
  const recoveryTitle = lastTranscriptRejection
    ? 'Voice did not catch that clearly'
    : isVoiceTakingLong
      ? 'Voice is taking longer than expected'
      : 'Voice connection had an issue';
  const recoveryMessage = lastTranscriptRejection
    ? 'Answer again so KiwiCoach scores what you actually said. Your accent is not scored.'
    : isVoiceTakingLong
      ? 'You can keep waiting, restart voice, or answer this question by text.'
      : 'Restart the voice connection, or use text for this question and continue the session.';
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
        <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs leading-5 text-gray-600 shadow-sm">
          <span className="font-semibold text-gray-800">Scoring note:</span> KiwiCoach scores answer content and communication clarity, not whether you sound native. If voice recognition fails, you can retry or answer by text.
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
                  <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold">
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
            <div className="mt-4 rounded-xl border border-white/50 bg-white/50 p-3">
              <TextArea
                value={textFallback}
                onChange={(event) => setTextFallback(event.target.value)}
                rows={3}
                placeholder="Type the answer you would give for this question..."
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
              <Button variant="secondary" size="sm" onClick={handleResetShell}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retry voice
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

          {showTextFallback ? (
            <div className="mt-4 rounded-xl border border-amber-100 bg-white p-3">
              <TextArea
                value={textFallback}
                onChange={(event) => setTextFallback(event.target.value)}
                rows={3}
                placeholder="Type the answer you would give for this question..."
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


      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4 flex flex-col justify-center">
          <div className="mx-auto flex w-full max-w-[520px] flex-col items-center justify-center gap-4 sm:gap-6 py-2">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                <span className={cn('h-2.5 w-2.5 rounded-full', isRecording ? 'bg-[#2eb886]' : (isCompleted ? 'bg-emerald-500' : 'bg-gray-300'))} />
                {isCompleted ? 'Session ended' : statusBadgeLabel}
              </div>
              <div className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm">
                {connectionLabel}
              </div>
            </div>

            <div className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full border border-[#cfece0] bg-white sm:h-[132px] sm:w-[132px] xl:h-[160px] xl:w-[160px]">
              <div className={cn('absolute inset-4 rounded-full transition-all duration-200', isRecording ? 'bg-[#2eb886]/20 animate-pulse' : 'bg-[#2eb886]/10')} />
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={voiceActionDisabled}
                className={cn('relative z-10 flex h-[64px] w-[64px] items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 sm:h-[68px] sm:w-[68px] xl:h-[78px] xl:w-[78px]', voiceActionDisabled ? 'cursor-not-allowed bg-gray-300' : 'bg-[#2eb886] hover:bg-[#24a673]')}
                aria-label={isCompleted ? 'Voice interview ended' : (isAutoLoopActive || isRecording ? 'Pause voice interview' : 'Start voice interview')}
              >
                {isAutoLoopActive || isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
            </div>

            <div className="text-center min-h-[52px] flex flex-col justify-center">
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

          </div>
        </div>

        <div className="shrink-0 bg-gray-50 px-4 pb-4">
          <div className="mx-auto w-full max-w-[520px]">
            <div className="flex h-[48px] sm:h-[58px] w-full items-end justify-between gap-1 overflow-hidden rounded-xl bg-white px-4 py-3 shadow-sm">
              {waveBars.map((value, index) => (
                <div
                  key={`wave-${index}`}
                  className={cn('w-full rounded-full transition-all duration-100', isRecording ? 'bg-blue-500' : (isCompleted ? 'bg-blue-100' : 'bg-blue-200'))}
                  style={{ height: `${Math.round(value * 100)}%` }}
                />
              ))}
            </div>

            {isCompleted ? (
              <div className="mt-3 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-center text-sm text-emerald-700 shadow-sm">
                Session ended. Report, transcript, and recording actions are available outside the live voice controls.
              </div>
            ) : null}
          </div>
        </div>

        {!isCompleted ? (
          <div className={cn('shrink-0 border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors', isPaused ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100')}>
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

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-gray-200 bg-white p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] lg:static lg:shadow-none">
          {isCompleted ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">Live controls are closed.</p>
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

      <audio ref={audioRef} controls playsInline src={assistantAudioUrl || undefined} className="hidden" />
    </div>
  );
}
