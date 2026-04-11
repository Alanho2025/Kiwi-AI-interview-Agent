/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InterviewRightRail should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { TextBackupCard } from './TextBackupCard.jsx';
import { TranscriptPanel } from './TranscriptPanel.jsx';

/**
 * Purpose: Execute the main responsibility for InterviewRightRail.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function InterviewRightRail({ transcript, candidateName, onExport, onSubmitBackup, backupDisabled }) {
  return (
    <div className="col-span-3 flex flex-col gap-6 h-full pb-6 min-h-0">
      <div className="flex-1 overflow-hidden min-h-0">
        <TranscriptPanel transcript={transcript} onExport={onExport} candidateName={candidateName} />
      </div>
      <div className="shrink-0">
        <TextBackupCard onSubmit={onSubmitBackup} disabled={backupDisabled} />
      </div>
    </div>
  );
}
