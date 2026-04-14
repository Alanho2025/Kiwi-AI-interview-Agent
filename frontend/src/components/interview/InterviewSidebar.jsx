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
const buildFocusDescription = ({ currentPlanItem, enableNZCultureFit, focusArea }) => {
  const focusKey = String(focusArea || 'Combined').toLowerCase();
  const modeMessage = focusKey === 'technical'
    ? 'This interview stays in technical mode, so explain tools, decisions, trade-offs, and results clearly.'
    : focusKey === 'behavioral'
      ? 'This interview stays in behavioural mode, so use STAR and keep each example concrete.'
      : 'This interview will cover both behavioural and technical evidence, so keep examples concrete.';
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
export function InterviewSidebar({ session, currentPlanItem }) {
  return (
    <div className="col-span-3 flex flex-col gap-6 overflow-y-auto pr-2 pb-6 min-h-0">
      <CandidateCard
        candidateName={session?.candidateName}
        status={session?.status === 'in_progress' ? 'Live' : session?.status}
        planPreview={session?.analysisResult?.planPreview}
      />
      <TipCard
        title="Current focus"
        description={buildFocusDescription({
          currentPlanItem,
          enableNZCultureFit: session?.settings?.enableNZCultureFit,
          focusArea: session?.settings?.focusArea,
        })}
      />
      <SessionInfoCard totalQuestions={session?.totalQuestions} seniorityLevel={session?.settings?.seniorityLevel} />
    </div>
  );
}
