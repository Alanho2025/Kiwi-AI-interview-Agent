/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InterviewRightRail should render transcript, backup, and recording actions from props.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Download } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { TextBackupCard } from './TextBackupCard.jsx';
import { TranscriptPanel } from './TranscriptPanel.jsx';

const resolveRecordingLabel = ({ isCompleted, recordingStatus }) => {
  if (!isCompleted) return 'Available after ending';
  if (recordingStatus?.state === 'uploading') return 'Preparing MP3...';
  if (recordingStatus?.state === 'failed') return 'Recording failed';
  if (recordingStatus?.state === 'ready') return 'MP3 ready';
  return 'Download if available';
};

export function InterviewRightRail({
  transcript,
  candidateName,
  onExport,
  onSubmitBackup,
  backupDisabled,
  isVoiceMode = false,
  isCompleted = false,
  recordingStatus = { state: 'idle', error: null },
  onDownloadRecording,
}) {
  const canDownloadRecording = isVoiceMode && isCompleted && !['uploading', 'failed'].includes(recordingStatus?.state);

  return (
    <div className="hidden lg:flex lg:col-span-3 flex-col gap-6 h-full pb-6 min-h-0">
      <div className="flex-1 overflow-hidden min-h-0">
        <TranscriptPanel transcript={transcript} onExport={onExport} candidateName={candidateName} />
      </div>

      {isVoiceMode ? (
        <div className="shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Voice recording</p>
              <p className="mt-1 text-xs text-gray-500">{resolveRecordingLabel({ isCompleted, recordingStatus })}</p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">MP3</span>
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
            Download MP3
          </Button>
        </div>
      ) : null}

      <div className="shrink-0">
        <TextBackupCard onSubmit={onSubmitBackup} disabled={backupDisabled} />
      </div>
    </div>
  );
}
