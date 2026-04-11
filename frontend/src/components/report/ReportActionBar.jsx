/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: ReportActionBar should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Button } from '../common/Button.jsx';

/**
 * Purpose: Execute the main responsibility for ReportActionBar.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportActionBar({ loading, onGenerate, onRunQa }) {
  return (
    <div className="flex gap-3">
      <Button onClick={onGenerate} disabled={loading}>{loading ? 'Working...' : 'Generate report'}</Button>
      <Button onClick={onRunQa} variant="secondary" disabled={loading}>Run QA</Button>
    </div>
  );
}
