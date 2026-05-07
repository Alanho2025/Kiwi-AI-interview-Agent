/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: AnalyzeActionsCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Button } from '../common/Button.jsx';

/**
 * Purpose: Execute the main responsibility for AnalyzeActionsCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function AnalyzeActionsCard({
  analysisStatus,
  generatedSessionId,
  selectedCV,
  rawJD,
  onGeneratePlan,
  onStartInterview,
  sessionMode = 'text',
  isVoiceReady = false,
}) {
  const isGenerating = analysisStatus === 'matching' || analysisStatus === 'summarizing';
  const canGenerate = Boolean(selectedCV && rawJD && !isGenerating);
  const isVoiceSession = sessionMode === 'voice';
  const canContinue = Boolean(generatedSessionId && (!isVoiceSession || isVoiceReady));

  return (
    <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-3 border-t border-gray-200 bg-white/95 p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:p-6 sm:shadow-sm">
      {analysisStatus === 'success' && generatedSessionId ? (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onStartInterview}
          disabled={!canContinue}
        >
          {isVoiceSession ? 'Continue to Voice Session' : 'Start Text Interview'}
        </Button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onGeneratePlan}
          disabled={!canGenerate}
        >
          Generate Match Analysis
        </Button>
      )}
      <p className="text-xs text-gray-500 text-center mt-2">
        {isVoiceSession
          ? (isVoiceReady ? 'Voice devices are ready. Your interview plan will use the selected CV, JD, and session setup above.' : 'Run the voice readiness check in Session Setup before continuing to Voice Session.')
          : 'Your interview plan will use the selected CV, JD, delivery mode, and session setup above.'}
      </p>
    </div>
  );
}
