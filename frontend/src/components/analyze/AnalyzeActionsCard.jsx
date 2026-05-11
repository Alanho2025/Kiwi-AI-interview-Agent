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
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';

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
  hasCurrentJDSummary = false,
  jdParseConfidence = 0,
  jdConfidenceThreshold = 0.9,
  requiresJdHumanReview = false,
  canUseJDSummary = false,
  isCvHumanVerified = false,
  onGeneratePlan,
  onStartInterview,
  sessionMode = 'text',
  isVoiceReady = false,
}) {
  const isGenerating = analysisStatus === 'matching' || analysisStatus === 'summarizing';
  const hasRawJD = Boolean(rawJD?.trim());
  const canGenerate = Boolean(selectedCV && isCvHumanVerified && hasRawJD && hasCurrentJDSummary && canUseJDSummary && !isGenerating);
  const isVoiceSession = sessionMode === 'voice';
  const canContinue = Boolean(generatedSessionId && (!isVoiceSession || isVoiceReady));
  const confidencePercent = Math.round((jdParseConfidence || 0) * 100);
  const thresholdPercent = Math.round(jdConfidenceThreshold * 100);

  const buttonLabel = (() => {
    if (analysisStatus === 'summarizing') return 'Summarizing JD...';
    if (analysisStatus === 'matching') return 'Generating Match Analysis...';
    if (!selectedCV) return 'Select a CV first';
    if (!isCvHumanVerified) return 'Review CV parse before matching';
    if (!hasRawJD) return 'Paste a JD first';
    if (!hasCurrentJDSummary) return 'Summarise JD before matching';
    if (requiresJdHumanReview) return 'Review JD summary before matching';
    return 'Generate Match Analysis';
  })();

  const helperText = (() => {
    if (analysisStatus === 'success' && isVoiceSession && !isVoiceReady) {
      return 'Run the voice readiness check in Session Setup before continuing to Voice Session.';
    }
    if (selectedCV && !isCvHumanVerified) {
      return 'Check the parsed CV fields used for matching, then mark the CV as reviewed.';
    }
    if (!hasCurrentJDSummary) {
      return 'CV-JD matching uses the reviewed JD summary, so summarise the current JD before generating the plan.';
    }
    if (requiresJdHumanReview) {
      return `JD confidence is ${confidencePercent}%. Gate target is ${thresholdPercent}%, but every JD still needs one human review before matching.`;
    }
    if (isVoiceSession) {
      return 'Voice devices are ready. Your interview plan will use the selected CV, reviewed JD, and session setup above.';
    }
    return 'Your interview plan will use the selected CV, reviewed JD, delivery mode, and session setup above.';
  })();

  const workflowSteps = [
    {
      label: 'CV selected',
      detail: selectedCV ? selectedCV.name : 'Upload or choose a recent CV.',
      complete: Boolean(selectedCV),
      blocked: false,
    },
    {
      label: 'CV parse reviewed',
      detail: isCvHumanVerified ? 'Reviewed profile is ready for matching.' : 'Check the parsed fields and mark the CV as reviewed.',
      complete: isCvHumanVerified,
      blocked: Boolean(selectedCV && !isCvHumanVerified),
    },
    {
      label: 'JD summary reviewed',
      detail: canUseJDSummary ? 'Reviewed JD summary is ready.' : hasRawJD ? 'Summarise and review the current JD before matching.' : 'Paste the target job description.',
      complete: Boolean(canUseJDSummary),
      blocked: Boolean(hasRawJD && (!hasCurrentJDSummary || requiresJdHumanReview)),
    },
    {
      label: 'Match analysis',
      detail: generatedSessionId ? 'Interview plan is ready.' : 'Generate the plan after the inputs are reviewed.',
      complete: Boolean(generatedSessionId),
      blocked: false,
    },
  ];

  const StepIcon = ({ complete, blocked }) => {
    if (complete) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (blocked) return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    return <Circle className="h-4 w-4 text-gray-300" />;
  };

  return (
    <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-4 border-t border-theme glass/95 p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:p-6 sm:shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Setup checklist</p>
        <div className="mt-3 space-y-2">
          {workflowSteps.map((step) => (
            <div key={step.label} className="flex gap-3 rounded-xl border border-gray-100 bg-transparent px-3 py-3">
              <StepIcon complete={step.complete} blocked={step.blocked} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{step.label}</p>
                <p className="mt-1 truncate text-xs text-muted">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
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
          {buttonLabel}
        </Button>
      )}
      <p className="text-center text-xs leading-5 text-muted">
        {helperText}
      </p>
    </div>
  );
}
