/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: InterviewStatusBanner should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Button } from '../common/Button.jsx';
import { StatusBanner } from '../common/StatusBanner.jsx';

/**
 * Purpose: Execute the main responsibility for InterviewStatusBanner.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function InterviewStatusBanner({ status, onConfirmEnd, onCancelEnd }) {
  if (!status) {
    return null;
  }

  if (status.type === 'confirm-end') {
    return (
      <StatusBanner
        variant="info"
        title="End interview?"
        message="This will mark the text interview as completed."
        actions={[
          <Button key="confirm" size="sm" variant="danger" onClick={onConfirmEnd}>Confirm End</Button>,
          <Button key="cancel" size="sm" variant="secondary" onClick={onCancelEnd}>Cancel</Button>,
        ]}
      />
    );
  }

  return <StatusBanner variant={status.type} title={status.title} message={status.message} />;
}
