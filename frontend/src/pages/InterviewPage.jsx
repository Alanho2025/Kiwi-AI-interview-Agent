/**
 * File responsibility: Page container.
 * Main responsibilities:
 * - Keep the text and voice interview layouts aligned.
 * - Let voice mode replace only the centre interaction panel while the sidebar and right rail stay shared.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { InterviewChatPanel } from '../components/interview/InterviewChatPanel.jsx';
import { InterviewPageHeader } from '../components/interview/InterviewPageHeader.jsx';
import { VoiceInterviewPanel } from '../components/interview/VoiceInterviewPanel.jsx';
import { InterviewRightRail } from '../components/interview/InterviewRightRail.jsx';
import { InterviewSidebar } from '../components/interview/InterviewSidebar.jsx';
import { InterviewStatusBanner } from '../components/interview/InterviewStatusBanner.jsx';
import { EndSessionProgress } from '../components/interview/EndSessionProgress.jsx';
import { downloadSessionRecording } from '../api/recordingApi.js';
import { useInterviewSession } from '../hooks/useInterviewSession.js';
import { useVoiceInterviewSession } from '../hooks/useVoiceInterviewSession.js';

const LoadingState = () => (
  <div className="min-h-screen flex items-center justify-center">Loading session...</div>
);

const EmptyState = () => (
  <div className="min-h-screen flex items-center justify-center">Session not found.</div>
);

export function InterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const {
    session,
    loading,
    isSubmitting,
    pageStatus,
    endSessionProgress,
    setPageStatus,
    dismissStatus,
    handleReply,
    handleVoiceSessionUpdate,
    handlePauseToggle,
    handleRepeat,
    handleEnd,
    handleConfirmEnd,
    handleExport,
    viewModel,
  } = useInterviewSession({ sessionId, navigate });

  const isVoiceMode = String(session?.mode || '').toLowerCase() === 'voice';
  const voiceShell = useVoiceInterviewSession({
    enabled: isVoiceMode,
    session,
    onPause: handlePauseToggle,
    onRepeat: handleRepeat,
    onEnd: handleEnd,
    isPaused: session?.status === 'paused',
    isCompleted: session?.status === 'completed',
    isSubmitting,
    onVoiceSessionUpdate: handleVoiceSessionUpdate,
    sessionId,
  });

  const handleSafeEnd = async () => {
    if (isVoiceMode) {
      await voiceShell.stopVoiceSession?.('manual_end');
    }
    handleEnd({ mode: isVoiceMode ? 'voice' : 'text' });
  };

  const handleDownloadRecording = async () => {
    try {
      await downloadSessionRecording(sessionId);
    } catch (error) {
      setPageStatus({
        type: 'error',
        title: 'Could not download MP3',
        message: error.message || 'Please try again after the recording is ready.',
      });
    }
  };

  if (loading) return <LoadingState />;
  if (!session) return <EmptyState />;

  const sharedBackupDisabled = isSubmitting || session.status === 'paused' || session.status === 'completed';

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col lg:h-screen lg:overflow-hidden">
      <InterviewPageHeader
        session={session}
        title={viewModel.title}
        roleFamilyLabel={viewModel.roleFamilyLabel}
        exactRoleTitle={viewModel.exactRoleTitle}
        modeLabel={viewModel.modeLabel}
        levelLabel={viewModel.levelLabel}
        stageLabel={viewModel.stageLabel}
        elapsedSeconds={viewModel.elapsedSeconds}
        controlMode={viewModel.controlMode}
        timeLimitSeconds={viewModel.timeLimitSeconds}
        isVoiceMode={isVoiceMode}
        onViewReport={() => navigate(`/report/${sessionId}`)}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 sm:px-6 sm:py-6 flex flex-col gap-4 lg:p-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:h-[calc(100vh-64px)] lg:overflow-hidden lg:min-h-0">
        <div className="col-span-12">
          <EndSessionProgress progress={endSessionProgress} />
          <InterviewStatusBanner status={pageStatus} onConfirmEnd={handleConfirmEnd} onCancelEnd={dismissStatus} />
        </div>

        <InterviewSidebar
          session={session}
          currentPlanItem={viewModel.currentPlanItem}
          promiseLabel={viewModel.promiseLabel}
          levelLabel={viewModel.levelLabel}
          modeLabel={viewModel.modeLabel}
          currentFocusLabel={viewModel.currentFocusLabel}
          matchedAreas={viewModel.matchedAreas}
        />

        <div className="lg:col-span-6 flex flex-col min-h-[400px] lg:h-full lg:pb-6 lg:min-h-0">
          {isVoiceMode ? (
            <VoiceInterviewPanel
              session={session}
              onPause={handlePauseToggle}
              onRepeat={handleRepeat}
              onEnd={handleSafeEnd}
              onSubmitBackup={handleReply}
              isPaused={session.status === 'paused'}
              isCompleted={session.status === 'completed'}
              isSubmitting={isSubmitting}
              voiceShell={voiceShell}
            />
          ) : (
            <InterviewChatPanel
              transcript={session.transcript}
              onReply={handleReply}
              onPause={handlePauseToggle}
              onRepeat={handleRepeat}
              onEnd={handleSafeEnd}
              isPaused={session.status === 'paused'}
              isCompleted={session.status === 'completed'}
              isSubmitting={isSubmitting}
              candidateName={session.candidateName}
            />
          )}
        </div>

        <InterviewRightRail
          transcript={session.transcript}
          candidateName={session.candidateName}
          onExport={handleExport}
          onSubmitBackup={handleReply}
          backupDisabled={sharedBackupDisabled}
          isVoiceMode={isVoiceMode}
          isCompleted={session.status === 'completed'}
          recordingStatus={voiceShell.recordingStatus}
          onDownloadRecording={handleDownloadRecording}
        />
      </main>
    </div>
  );
}
