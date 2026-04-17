import { useMemo } from 'react';
import { Bird, CirclePause, Download, FileAudio, Flag, Lightbulb, Lock, Mic, MicOff, NotebookPen, RefreshCcw, Square, Volume2 } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { TextArea } from '../common/TextArea.jsx';
import { cn, formatClockTime } from '../../utils/formatters.js';

const renderStatusTone = (type) => {
  if (type === 'error') return 'border-red-200 bg-red-50 text-red-700';
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
};

const getTranscriptSpeakerLabel = (turn, candidateName) => {
  if (turn.role === 'ai') return 'KiwiCoach';
  return candidateName || 'You';
};

const buildWaveBars = (levels = []) => {
  if (!levels.length) {
    return Array.from({ length: 48 }, () => 0.08);
  }
  return levels.slice(-48).map((value) => Math.max(0.08, Math.min(1, value)));
};

const VoiceSidebarCard = ({ children, className = '' }) => (
  <div className={cn('rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm', className)}>{children}</div>
);

const TranscriptAvatar = ({ role, initials }) => (
  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', role === 'ai' ? 'bg-[#e7f8f1] text-[#2eb886]' : 'bg-gray-100 text-gray-600')}>
    {role === 'ai' ? <Bird className="h-4 w-4" /> : <span className="text-xs font-semibold">{initials}</span>}
  </div>
);

export function VoiceInterviewPanel({
  session,
  candidateName,
  exactRoleTitle,
  elapsedSeconds,
  onPause,
  onRepeat,
  onEnd,
  onExport,
  onSubmitBackup,
  isPaused,
  isCompleted,
  isSubmitting,
  viewModel,
  voiceShell,
}) {
  const {
    currentQuestion,
    latestUserTurn,
    liveTranscript,
    permissionState,
    permissionError,
    stateLabel,
    voiceStatus,
    isRecording,
    isProcessingTurn,
    canUseVoice,
    levelHistory,
    recordingDurationLabel,
    transcriptionPreview,
    assistantAudioUrl,
    audioRef,
    lastAsrConfidence,
    manualAudioFile,
    backupText,
    isBackupExpanded,
    handleRequestPermission,
    handleToggleRecording,
    handleReplayAssistantAudio,
    handleResetShell,
    handleAudioFileSelect,
    handleSubmitSelectedAudio,
    setBackupText,
    setIsBackupExpanded,
  } = voiceShell;

  const initials = useMemo(() => String(candidateName || 'Candidate').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), [candidateName]);
  const waveBars = useMemo(() => buildWaveBars(levelHistory), [levelHistory]);
  const statusBadgeLabel = isRecording ? 'Listening...' : stateLabel;
  const asrAccuracy = lastAsrConfidence != null ? `${Math.round(lastAsrConfidence * 100)}%` : 'Pending';
  const timerLabel = `${Math.floor((elapsedSeconds || 0) / 60) || 5} minute per question limit`;
  const transcriptPreviewText = transcriptionPreview || latestUserTurn?.text || 'Your latest spoken answer preview will appear here after a voice turn.';
  const currentQuestionText = currentQuestion?.displayText || currentQuestion?.text || 'The interviewer question will appear here once the session starts.';
  const backupDisabled = isSubmitting || isPaused || isCompleted;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-6 pb-6">
      <aside className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-3">
        <VoiceSidebarCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Candidate</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{candidateName || 'Candidate'}</p>
              <p className="mt-4 text-sm text-gray-500">Plan: {session?.analysisResult?.planPreview || 'Tailored from CV & JD'}</p>
            </div>
            <div className="rounded-full bg-[#dff5ec] px-4 py-2 text-sm font-semibold text-[#1f9b6f]">{session?.status === 'in_progress' ? 'Live' : (session?.status || 'Live').replace('_', ' ')}</div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-gray-400">
            <Lock className="h-3.5 w-3.5" />
            <span>Google-connected encrypted recordings</span>
          </div>
        </VoiceSidebarCard>

        <VoiceSidebarCard className="bg-[#fffdf5] border-yellow-200">
          <div className="flex items-center gap-2 text-yellow-600">
            <Lightbulb className="h-4 w-4" />
            <p className="text-base font-semibold text-gray-900">Tip: Use the STAR technique</p>
          </div>
          <p className="mt-3 text-sm text-gray-600">{viewModel?.currentFocusLabel || 'Focus on concrete outcomes, communication, and ownership that fit NZ interview expectations.'}</p>
          <p className="mt-4 text-sm text-gray-400">Tip: {viewModel?.promiseLabel || 'Use teamwork examples when they are relevant.'}</p>
        </VoiceSidebarCard>

        <VoiceSidebarCard>
          <p className="text-base font-semibold text-gray-900">Session Info</p>
          <div className="mt-4 space-y-3 text-sm text-gray-500">
            <p>Interview length: {timerLabel}</p>
            <p>ASR latency: ~0.6s target</p>
            <p>Mode: {viewModel?.modeLabel || 'Voice'}</p>
            <p>Target role: {exactRoleTitle || viewModel?.exactRoleTitle || 'Role-specific mock interview'}</p>
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-900">Next steps</p>
            <ul className="mt-3 space-y-1 text-sm text-gray-500">
              <li>- Immediate ASR feedback</li>
              <li>- Submit recording to review</li>
              <li>- Export transcript (.txt)</li>
            </ul>
          </div>
        </VoiceSidebarCard>
      </aside>

      <section className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-6">
        {voiceStatus ? (
          <div className={cn('rounded-[24px] border px-4 py-3 text-sm shadow-sm', renderStatusTone(voiceStatus.type))}>
            <p className="font-semibold">{voiceStatus.title}</p>
            <p className="mt-1">{voiceStatus.message}</p>
          </div>
        ) : null}

        {(permissionError && !voiceStatus) ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <p className="font-semibold">Microphone error</p>
            <p className="mt-1">{permissionError}</p>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
              <span className={cn('h-2.5 w-2.5 rounded-full', isRecording ? 'bg-[#2eb886]' : 'bg-gray-300')} />
              {statusBadgeLabel}
            </div>
            <div className="rounded-full bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{permissionState}</div>
          </div>

          <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-6">
            <div className="relative flex h-[250px] w-[250px] items-center justify-center rounded-full border border-[#cfece0] bg-[#f7fcfa]">
              <div className={cn('absolute inset-6 rounded-full transition-all duration-200', isRecording ? 'bg-[#2eb886]/20 animate-pulse' : 'bg-[#2eb886]/10')} />
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={!canUseVoice}
                className={cn('relative z-10 flex h-[120px] w-[120px] items-center justify-center rounded-full text-white shadow-lg transition-all duration-200', canUseVoice ? 'bg-[#2eb886] hover:bg-[#24a673]' : 'cursor-not-allowed bg-gray-300')}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
            </div>

            <div className="text-center">
              <p className="text-base font-medium text-gray-500">
                {isRecording ? `Microphone is active - ${recordingDurationLabel}` : 'Tap the microphone to answer the current interview question'}
              </p>
            </div>

            <div className="flex h-[92px] w-full max-w-[420px] items-end justify-between gap-1 overflow-hidden rounded-[24px] bg-[#f6fbf9] px-4 py-4">
              {waveBars.map((value, index) => (
                <div
                  key={`wave-${index}`}
                  className={cn('w-full rounded-full transition-all duration-100', isRecording ? 'bg-[#0f7d8a]' : 'bg-[#9cd8c4]')}
                  style={{ height: `${Math.round(value * 100)}%` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-gray-100 bg-[#fbfcfb] p-5">
            <p className="text-sm font-medium text-gray-500">AI Question</p>
            <p className="mt-3 text-[28px] font-semibold leading-tight text-gray-900">{currentQuestionText}</p>
            <div className="mt-5 rounded-[20px] border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Live transcription preview (ASR)</p>
              <p className="mt-3 text-base text-gray-700">“{transcriptPreviewText}”</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={onPause} disabled={isCompleted || isSubmitting} className="rounded-full px-5">
                <CirclePause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button variant="secondary" onClick={() => {
                if (assistantAudioUrl) {
                  handleReplayAssistantAudio();
                  return;
                }
                onRepeat();
              }} disabled={isCompleted || isSubmitting} className="rounded-full px-5">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Repeat Question
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" className="rounded-full px-5" disabled>
                <NotebookPen className="mr-2 h-4 w-4" />
                Notes
              </Button>
              <Button variant="danger" onClick={onEnd} disabled={isCompleted || isSubmitting} className="rounded-full px-5 py-3 text-red-500 border border-red-200 bg-white hover:bg-red-50">
                End Interview
              </Button>
            </div>
          </div>
        </div>
      </section>

      <aside className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-3">
        <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <p className="text-xl font-semibold text-gray-900">Live Transcript</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400">ASR conversation feed</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>ASR accuracy</p>
              <p className="mt-1 font-semibold text-gray-700">{asrAccuracy}</p>
            </div>
          </div>

          <div className="mt-5 flex-1 space-y-5 overflow-y-auto pr-1">
            {liveTranscript.length ? liveTranscript.map((turn, index) => (
              <div key={`${turn.timestamp}-${index}`} className="flex gap-3">
                <TranscriptAvatar role={turn.role} initials={initials} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="font-semibold text-gray-900">{getTranscriptSpeakerLabel(turn, candidateName)}</p>
                    <p className="text-xs text-gray-400">{formatClockTime(turn.timestamp)}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">“{turn.displayText || turn.text}”</p>
                </div>
              </div>
            )) : (
              <div className="rounded-[20px] border border-dashed border-gray-200 p-4 text-sm text-gray-500">The live transcript will appear here after the interview starts.</div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 text-sm text-gray-500">
            <span>Assistant audio {assistantAudioUrl ? 'ready' : 'pending'}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onExport}><Download className="mr-2 h-4 w-4" />Export</Button>
              <Button variant="secondary" size="sm"><Flag className="mr-2 h-4 w-4" />Flag</Button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-gray-900">Text Backup</p>
              <p className="mt-1 text-sm text-gray-400">Hidden by default - expand if voice fails</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsBackupExpanded((current) => !current)}>
              {isBackupExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          {isBackupExpanded ? (
            <div className="mt-4 space-y-4">
              <TextArea
                value={backupText}
                onChange={(event) => setBackupText(event.target.value)}
                placeholder="Paste text here as backup..."
                rows={4}
                disabled={backupDisabled}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={async () => {
                  await onSubmitBackup(backupText);
                  setBackupText('');
                }} disabled={!backupText.trim() || backupDisabled}>Submit Backup</Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  <FileAudio className="h-4 w-4" />
                  Upload WAV fallback
                  <input type="file" accept=".wav,audio/wav,audio/x-wav" className="hidden" onChange={handleAudioFileSelect} />
                </label>
                {manualAudioFile ? (
                  <Button variant="secondary" onClick={handleSubmitSelectedAudio} disabled={backupDisabled}>Submit WAV</Button>
                ) : null}
              </div>
              {manualAudioFile ? <p className="text-xs text-gray-500">Selected: {manualAudioFile.name}</p> : null}
            </div>
          ) : null}
        </div>

        <audio ref={audioRef} controls src={assistantAudioUrl} className="hidden" />

        <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Voice tools</p>
              <p className="mt-2 text-sm text-gray-600">Use these controls if you need to re-arm the microphone or replay the assistant question.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleRequestPermission}><Mic className="mr-2 h-4 w-4" />Enable Mic</Button>
              <Button variant="secondary" size="sm" onClick={handleReplayAssistantAudio} disabled={!assistantAudioUrl}><Volume2 className="mr-2 h-4 w-4" />Replay</Button>
              <Button variant="secondary" size="sm" onClick={handleResetShell}><MicOff className="mr-2 h-4 w-4" />Reset</Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
