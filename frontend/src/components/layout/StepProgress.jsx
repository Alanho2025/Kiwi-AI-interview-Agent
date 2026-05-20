/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: StepProgress should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { cn } from '../../utils/formatters.js';

/**
 * Purpose: Execute the main responsibility for StepProgress.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function StepProgress({ currentStep = 1, steps: customSteps = null }) {
  const steps = customSteps || [
    { id: 1, label: 'Upload' },
    { id: 2, label: 'Analyze' },
    { id: 3, label: 'Start' },
  ];

  return (
    <div className="flex flex-1 items-center justify-center max-w-3xl mx-auto">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors sm:h-8 sm:w-8 sm:text-sm",
            currentStep === step.id ? "border-gray-900 text-primary" : 
            currentStep > step.id ? "[border-color:var(--accent)] text-accent [background:var(--accent-glow)]" : "border-theme text-gray-400"
          )}>
            {step.id}
          </div>
          <span className={cn(
            "ml-2 hidden text-sm font-medium lg:inline",
            currentStep === step.id ? "text-primary" : "text-faint"
          )}>
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div className="mx-2 h-px w-4 bg-chip sm:mx-3 sm:w-8 lg:w-12" />
          )}
        </div>
      ))}
    </div>
  );
}
