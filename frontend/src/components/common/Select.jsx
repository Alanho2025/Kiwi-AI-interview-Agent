/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: Select should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { cn } from '../../utils/formatters.js';
import { ChevronDown } from 'lucide-react';

/**
 * Purpose: Execute the main responsibility for Select.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function Select({ className, options = [], ...props }) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex w-full appearance-none rounded-xl border border-theme glass px-4 py-3 pr-10 text-sm text-primary shadow-sm focus:[border-color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-1 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-70",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
