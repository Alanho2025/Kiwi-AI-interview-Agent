/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: Button should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { cn } from '../../utils/formatters.js';

/**
 * Purpose: Execute the main responsibility for Button.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function Button({ className, variant = 'primary', size = 'md', children, ...props }) {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-[#2eb886] text-white shadow-sm hover:bg-[#259a6f] focus:ring-[#2eb886]",
    secondary: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus:ring-gray-200",
    outline: "border border-[#2eb886] bg-white text-[#217c5d] hover:bg-[#eef8f4] focus:ring-[#2eb886]",
    ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-950",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-200"
  };
  
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3 text-base"
  };

  return (
    <button className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}
