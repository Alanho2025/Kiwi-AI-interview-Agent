/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: AppHeader should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Link } from 'react-router-dom';
import { Bird } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for AppHeader.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function AppHeader({ children }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-4">
        <Link to="/analysis" className="flex items-center gap-2 text-gray-900 font-semibold text-lg shrink-0">
          <Bird className="w-6 h-6 text-[#2eb886]" />
          <span>Kiwi Voice Coach</span>
        </Link>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </header>
  );
}
