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

  if (loading) return <LoadingState />;
  if (!session) return <EmptyState />;

  const sharedBackupDisabled = isSubmitting || session.status === 'paused' || session.status === 'completed';

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col h-screen overflow-hidden">
      <InterviewPageHeader
        session={session}
        title={viewModel.title}
        roleFamilyLabel={viewModel.roleFamilyLabel}
        exactRoleTitle={viewModel.exactRoleTitle}
        modeLabel={viewModel.modeLabel}
        levelLabel={viewModel.levelLabel}
        stageLabel={viewModel.stageLabel}
        elapsedSeconds={viewModel.elapsedSeconds}
        isVoiceMode={isVoiceMode}
        onViewReport={() => navigate(`/report/${sessionId}`)}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-12 gap-6 h-[calc(100vh-64px)] overflow-hidden min-h-0">
        <div className="col-span-12">
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

        <div className="col-span-6 flex flex-col h-full pb-6 min-h-0">
          {isVoiceMode ? (
            <VoiceInterviewPanel
              session={session}
              onPause={handlePauseToggle}
              onRepeat={handleRepeat}
              onEnd={handleEnd}
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
              onEnd={handleEnd}
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
        />
      </main>
    </div>
  );
}
