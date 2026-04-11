/**
 * File responsibility: Page container.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InterviewPage should orchestrate the screen and compose child sections without burying domain rules in JSX.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { InterviewChatPanel } from '../components/interview/InterviewChatPanel.jsx';
import { InterviewPageHeader } from '../components/interview/InterviewPageHeader.jsx';
import { InterviewRightRail } from '../components/interview/InterviewRightRail.jsx';
import { InterviewSidebar } from '../components/interview/InterviewSidebar.jsx';
import { InterviewStatusBanner } from '../components/interview/InterviewStatusBanner.jsx';
import { useInterviewSession } from '../hooks/useInterviewSession.js';

/**
 * Purpose: Execute the main responsibility for LoadingState.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const LoadingState = () => (
  <div className="min-h-screen flex items-center justify-center">Loading session...</div>
);

/**
 * Purpose: Execute the main responsibility for EmptyState.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const EmptyState = () => (
  <div className="min-h-screen flex items-center justify-center">Session not found.</div>
);

/**
 * Purpose: Execute the main responsibility for InterviewPage.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
    handlePauseToggle,
    handleRepeat,
    handleEnd,
    handleConfirmEnd,
    handleExport,
    viewModel,
  } = useInterviewSession({ sessionId, navigate });

  if (loading) return <LoadingState />;
  if (!session) return <EmptyState />;

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col h-screen overflow-hidden">
      <InterviewPageHeader
        session={session}
        displayRole={viewModel.displayRole}
        compactRoleLabel={viewModel.compactRoleLabel}
        stageLabel={viewModel.stageLabel}
        elapsedSeconds={viewModel.elapsedSeconds}
        onViewReport={() => navigate(`/report/${sessionId}`)}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-12 gap-6 h-[calc(100vh-64px)] overflow-hidden min-h-0">
        <div className="col-span-12">
          <InterviewStatusBanner status={pageStatus} onConfirmEnd={handleConfirmEnd} onCancelEnd={dismissStatus} />
        </div>

        <InterviewSidebar session={session} currentPlanItem={viewModel.currentPlanItem} />

        <div className="col-span-6 flex flex-col h-full pb-6 min-h-0">
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
        </div>

        <InterviewRightRail
          transcript={session.transcript}
          candidateName={session.candidateName}
          onExport={handleExport}
          onSubmitBackup={handleReply}
          backupDisabled={isSubmitting || session.status === 'paused' || session.status === 'completed'}
        />
      </main>
    </div>
  );
}
