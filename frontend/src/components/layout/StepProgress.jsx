import { cn } from '../../utils/formatters.js';

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
