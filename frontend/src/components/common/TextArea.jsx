/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: TextArea should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { cn } from '../../utils/formatters.js';

/**
 * Purpose: Execute the main responsibility for TextArea.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function TextArea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex w-full resize-none rounded-xl border border-theme glass px-4 py-3 text-sm leading-6 placeholder:text-gray-400 focus:[border-color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-1 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
