/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: TipCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Card, CardContent } from '../common/Card.jsx';
import { Lightbulb } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for TipCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function TipCard({ title, description }) {
  return (
    <Card className="bg-[#fffdf5] border-yellow-200">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-yellow-600">
          <Lightbulb className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Tip: {title}</h3>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
}
