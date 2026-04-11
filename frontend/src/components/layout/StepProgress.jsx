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
export function StepProgress({ currentStep = 1 }) {
  const steps = [
    { id: 1, label: 'Upload' },
    { id: 2, label: 'Analyze' },
    { id: 3, label: 'Start' },
  ];

  return (
    <div className="flex items-center justify-center flex-1 max-w-lg mx-auto">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium transition-colors",
            currentStep === step.id ? "border-gray-900 text-gray-900" : 
            currentStep > step.id ? "border-[#2eb886] text-[#2eb886] bg-[#e6f7f0]" : "border-gray-300 text-gray-400"
          )}>
            {step.id}
          </div>
          <span className={cn(
            "ml-2 text-sm font-medium",
            currentStep === step.id ? "text-gray-900" : "text-gray-500"
          )}>
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div className="w-16 h-px bg-gray-200 mx-4" />
          )}
        </div>
      ))}
    </div>
  );
}
