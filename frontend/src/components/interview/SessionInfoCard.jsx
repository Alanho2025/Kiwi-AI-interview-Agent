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

/**
 * Purpose: Execute the main responsibility for SessionInfoCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function SessionInfoCard({ totalQuestions, seniorityLevel }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Session Info</h3>
          <p className="text-sm text-gray-600">Total Questions: {totalQuestions || 8}</p>
          <p className="text-sm text-gray-600 mt-1">Level: {seniorityLevel || 'General'}</p>
        </div>
        
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Next steps</h3>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Immediate text feedback</li>
            <li>• Submit session to review</li>
            <li>• Export transcript (.txt)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
