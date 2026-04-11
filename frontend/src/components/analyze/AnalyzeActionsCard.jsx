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
}) {
  const isGenerating = analysisStatus === 'matching' || analysisStatus === 'summarizing';
  const canGenerate = Boolean(selectedCV && rawJD && !isGenerating);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col gap-4">
      {analysisStatus === 'success' && generatedSessionId ? (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onStartInterview}
        >
          Start Text Interview
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
        Current scope: CV upload, JD summary, CV to JD match score, and text interview.
      </p>
    </div>
  );
}
