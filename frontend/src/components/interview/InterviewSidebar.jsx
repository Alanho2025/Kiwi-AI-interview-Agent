/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InterviewSidebar should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { CandidateCard } from './CandidateCard.jsx';
import { SessionInfoCard } from './SessionInfoCard.jsx';
import { TipCard } from './TipCard.jsx';

/**
 * Purpose: Execute the main responsibility for buildFocusDescription.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildFocusDescription = ({ currentPlanItem, enableNZCultureFit, promiseLabel }) => {
  const modeMessage = promiseLabel || 'Keep your examples concrete and role-specific.';
  if (!currentPlanItem) {
    return `${enableNZCultureFit ? 'Use teamwork and communication examples when they are relevant. ' : ''}${modeMessage}`;
  }

  return `Stage: ${(currentPlanItem.stage || 'opening').replace(/_/g, ' ')}. Topic: ${currentPlanItem.topic || 'role fit'}. ${modeMessage} ${enableNZCultureFit ? 'Use teamwork and communication examples when they are relevant. ' : ''}`;
};

/**
 * Purpose: Execute the main responsibility for InterviewSidebar.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function InterviewSidebar({ session, currentPlanItem, promiseLabel, levelLabel, modeLabel, currentFocusLabel, matchedAreas = [] }) {
  const sessionModeLabel = String(session?.mode || '').toLowerCase() === 'voice' ? 'Voice interview' : 'Text interview';

  return (
    <div className="hidden xl:flex xl:col-span-3 flex-col gap-6 overflow-y-auto pr-2 pb-6 min-h-0">
      <CandidateCard
        candidateName={session?.candidateName}
        status={session?.status === 'in_progress' ? 'Live' : session?.status}
        planPreview={session?.analysisResult?.planPreview}
      />
      <TipCard
        title="Current focus"
        description={`${currentFocusLabel ? `${currentFocusLabel}. ` : ''}${buildFocusDescription({
          currentPlanItem,
          enableNZCultureFit: session?.settings?.enableNZCultureFit,
          promiseLabel,
        })}`}
      />
      <SessionInfoCard
        totalQuestions={session?.totalQuestions}
        levelLabel={levelLabel}
        modeLabel={sessionModeLabel}
        formatLabel={modeLabel}
        status={session?.status}
        transcript={session?.transcript}
        matchedAreas={matchedAreas}
      />
    </div>
  );
}
