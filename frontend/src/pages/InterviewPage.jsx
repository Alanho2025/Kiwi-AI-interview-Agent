/**
 * File responsibility: Page container.
 * Main responsibilities:
 * - Keep the text and voice interview layouts aligned.
 * - Let voice mode replace only the centre interaction panel while the sidebar and right rail stay shared.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InterviewChatPanel } from '../components/interview/InterviewChatPanel.jsx';
import { InterviewPageHeader } from '../components/interview/InterviewPageHeader.jsx';
import { VoiceInterviewPanel } from '../components/interview/VoiceInterviewPanel.jsx';
import { InterviewRightRail } from '../components/interview/InterviewRightRail.jsx';
import { InterviewSidebar } from '../components/interview/InterviewSidebar.jsx';
import { MobileInterviewDetails } from '../components/interview/MobileInterviewDetails.jsx';
import { InterviewStatusBanner } from '../components/interview/InterviewStatusBanner.jsx';
import { EndSessionProgress } from '../components/interview/EndSessionProgress.jsx';
import { downloadSessionRecording } from '../api/recordingApi.js';
import { useInterviewSession } from '../hooks/useInterviewSession.js';
import { useVoiceInterviewSession } from '../hooks/useVoiceInterviewSession.js';
import { useTour } from '../contexts/TourContext.jsx';

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
    handleStartInterview,
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
    onStartInterview: handleStartInterview,
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

  const { startTour, globalTourStep, advanceGlobalTour } = useTour();

  const INTERVIEW_TOUR_STEPS = [
    {
      target: '#tour-interview-header',
      content: 'Here is your session info — role, level, mode, and a live timer.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '#tour-interview-center',
      content: isVoiceMode
        ? 'This is your Voice Interview panel. Click the microphone to start talking. You can end the interview here when finished.'
        : 'This is where your conversation happens. Type your answers here. Click End when you are done.',
      placement: 'right',
      spotlightClicks: true, // Allow clicking End button
    },
    {
      target: '#tour-interview-right',
      content: 'Check the conversation transcript here, and use the Text Reply area below to draft or refine your answers.',
      placement: 'left',
    },
  ];

  useEffect(() => {
    if (!loading && session && (globalTourStep === 'interview' || globalTourStep === 'analyze')) {
      advanceGlobalTour('interview');
      setTimeout(() => {
        startTour(INTERVIEW_TOUR_STEPS);
      }, 500);
    }
  }, [globalTourStep, loading, session, startTour, advanceGlobalTour]);

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

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 sm:px-6 sm:py-6 flex flex-col gap-4 lg:p-6 lg:grid lg:grid-cols-8 xl:grid-cols-12 lg:gap-6 lg:h-[calc(100vh-64px)] lg:overflow-hidden lg:min-h-0">
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

        <div id="tour-interview-center" className="flex min-h-[400px] flex-col lg:col-span-5 lg:h-full lg:min-h-0 xl:col-span-6">
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
              sessionStatus={session.status}
            />
          ) : (
            <InterviewChatPanel
              transcript={session.transcript}
              onStart={handleStartInterview}
              onReply={handleReply}
              onPause={handlePauseToggle}
              onRepeat={handleRepeat}
              onEnd={handleSafeEnd}
              isPaused={session.status === 'paused'}
              isCompleted={session.status === 'completed'}
              isSubmitting={isSubmitting}
              candidateName={session.candidateName}
              sessionStatus={session.status}
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

        <MobileInterviewDetails
          transcript={session.transcript}
          candidateName={session.candidateName}
          onExport={handleExport}
          onSubmitBackup={handleReply}
          backupDisabled={sharedBackupDisabled}
          isVoiceMode={isVoiceMode}
          isCompleted={session.status === 'completed'}
          recordingStatus={voiceShell.recordingStatus}
          onDownloadRecording={handleDownloadRecording}
          session={session}
          levelLabel={viewModel.levelLabel}
          modeLabel={viewModel.modeLabel}
          formatLabel={viewModel.modeLabel}
          matchedAreas={viewModel.matchedAreas}
        />
      </main>
    </div>
  );
}
