/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: CandidateCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Card, CardContent } from '../common/Card.jsx';
import { Lock } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for CandidateCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function CandidateCard({ candidateName, status, planPreview }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Candidate</h3>
            <p className="text-lg font-semibold text-gray-900">{candidateName}</p>
          </div>
          <div className="px-3 py-1 bg-[#e6f7f0] text-[#2eb886] text-xs font-medium rounded-full capitalize">
            {status.replace('_', ' ')}
          </div>
        </div>
        
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600">{planPreview || 'Plan: Tailored from CV & JD'}</p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Lock className="w-3 h-3" />
          <span>Session data protected</span>
        </div>
      </CardContent>
    </Card>
  );
}
