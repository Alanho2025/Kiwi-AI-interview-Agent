/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: SessionInfoCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Card, CardContent } from '../common/Card.jsx';

const countCandidateAnswers = (transcript = []) => transcript.filter((turn) => turn?.role === 'user').length;

const formatStatus = (status) => {
  if (status === 'in_progress') return 'Live';
  if (status === 'completed') return 'Ended';
  if (status === 'ready') return 'Ready';
  if (status === 'paused') return 'Paused';
  return status || 'Ready';
};

/**
 * Purpose: Execute the main responsibility for SessionInfoCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function SessionInfoCard({ totalQuestions, levelLabel, modeLabel, formatLabel, status, transcript = [], matchedAreas = [] }) {
  const answeredCount = countCandidateAnswers(transcript);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-primary mb-2">Session Info</h3>
          <p className="text-sm text-muted">Status: {formatStatus(status)}</p>
          <p className="text-sm text-muted mt-1">Questions: {answeredCount} answered / {totalQuestions || 8} planned</p>
          <p className="text-sm text-muted mt-1">Level: {levelLabel || 'Junior Combined'}</p>
          <p className="text-sm text-muted mt-1">Mode: {modeLabel || 'Combined'}</p>
          {formatLabel ? <p className="text-sm text-muted mt-1">Format: {formatLabel}</p> : null}
          {matchedAreas.length ? <p className="text-sm text-muted mt-1">Likely discussion areas: {matchedAreas.slice(0, 4).join(', ')}</p> : null}
        </div>
        
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-primary mb-2">Next steps</h3>
          <ul className="text-sm text-faint space-y-1">
            <li>• Immediate text feedback</li>
            <li>• Submit session to review</li>
            <li>• Export transcript (.txt)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
