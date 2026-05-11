/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: Checkbox should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { cn } from '../../utils/formatters.js';

/**
 * Purpose: Execute the main responsibility for Checkbox.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function Checkbox({ className, label, ...props }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-theme glass px-4 py-3 text-sm shadow-sm transition hover:border-theme">
      <input
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 cursor-pointer rounded border-theme text-accent transition duration-150 ease-in-out focus:ring-1 focus:ring-accent",
          className
        )}
        {...props}
      />
      {label && <span className="leading-5 text-muted">{label}</span>}
    </label>
  );
}
