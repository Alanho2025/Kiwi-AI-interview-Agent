import { Download } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { SessionInfoCard } from './SessionInfoCard.jsx';
import { TextBackupCard } from './TextBackupCard.jsx';
import { TranscriptPanel } from './TranscriptPanel.jsx';

const resolveRecordingLabel = ({ isCompleted, recordingStatus }) => {
  if (!isCompleted) return 'Available after the session ends';
  if (recordingStatus?.state === 'uploading') return 'Preparing recording...';
  if (recordingStatus?.state === 'failed') return 'Recording could not be prepared';
  if (recordingStatus?.state === 'ready') return 'Recording ready';
  return 'Recording is still being processed';
};

export function MobileInterviewDetails({
  transcript,
  candidateName,
  onExport,
  onSubmitBackup,
  backupDisabled,
  isVoiceMode,
  isCompleted,
  recordingStatus,
  onDownloadRecording,
  session,
  levelLabel,
  modeLabel,
  formatLabel,
  matchedAreas,
}) {
  const canDownloadRecording = isVoiceMode && isCompleted && recordingStatus?.state === 'ready';
  const transcriptModeLabel = isVoiceMode ? 'Voice interview' : 'Text interview';

  return (
    <div className="space-y-3 lg:hidden">
      <details className="rounded-2xl border border-theme glass shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Conversation history</summary>
        <div className="h-[360px] border-t border-gray-100">
          <TranscriptPanel transcript={transcript} onExport={onExport} candidateName={candidateName} modeLabel={transcriptModeLabel} />
        </div>
      </details>

      <details className="rounded-2xl border border-theme glass shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Session info</summary>
        <div className="border-t border-gray-100 p-3">
          <SessionInfoCard
            totalQuestions={session?.totalQuestions}
            levelLabel={levelLabel}
            modeLabel={isVoiceMode ? 'Voice interview' : 'Text interview'}
            formatLabel={formatLabel || modeLabel}
            status={session?.status}
            transcript={transcript}
            matchedAreas={matchedAreas}
          />
        </div>
      </details>

      {isVoiceMode ? (
        <details className="rounded-2xl border border-theme glass shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Recording</summary>
          <div className="border-t border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-primary">Voice recording</p>
                <p className="mt-1 text-xs text-faint">{resolveRecordingLabel({ isCompleted, recordingStatus })}</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Audio</span>
            </div>
            {recordingStatus?.error ? (
              <p className="mt-3 text-xs text-red-600">{recordingStatus.error}</p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              onClick={onDownloadRecording}
              disabled={!canDownloadRecording}
            >
              <Download className="mr-2 h-4 w-4" />
              Download recording
            </Button>
          </div>
        </details>
      ) : null}

      <details className="rounded-2xl border border-theme glass shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Text fallback</summary>
        <div className="border-t border-gray-100 p-3">
          <TextBackupCard onSubmit={onSubmitBackup} disabled={backupDisabled} />
        </div>
      </details>
    </div>
  );
}
