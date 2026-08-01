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
import { CheckCircle2 } from 'lucide-react';

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
  planStatus = 'idle',
  onRetryPlan,
}) {
  const isPreparingPlan = planStatus === 'preparing';
  const planFailed = planStatus === 'failed';
  const isGenerating = analysisStatus === 'matching' || analysisStatus === 'summarizing' || isPreparingPlan;
  const hasRawJD = Boolean(rawJD?.trim());
  const isVoiceSession = sessionMode === 'voice';
  const setupReady = !isVoiceSession || isVoiceReady;
  const canGenerate = Boolean(selectedCV && isCvHumanVerified && hasRawJD && hasCurrentJDSummary && canUseJDSummary && setupReady && !isGenerating);
  const canContinue = Boolean(generatedSessionId && (!isVoiceSession || isVoiceReady));
  const confidencePercent = Math.round((jdParseConfidence || 0) * 100);
  const thresholdPercent = Math.round(jdConfidenceThreshold * 100);

  const buttonLabel = (() => {
    if (isPreparingPlan) return 'Preparing interview session...';
    if (analysisStatus === 'summarizing') return 'Parsing job description...';
    if (analysisStatus === 'matching') return 'Generating match analysis...';
    if (!selectedCV) return 'Upload or choose a CV first';
    if (!isCvHumanVerified) return 'Review the CV fields first';
    if (!hasRawJD) return 'Paste a job description first';
    if (!hasCurrentJDSummary) return 'Parse the job description first';
    if (requiresJdHumanReview) return 'Review the job description fields first';
    if (isVoiceSession && !isVoiceReady) return 'Complete the voice check first';
    return 'Generate match analysis';
  })();

  const helperText = (() => {
    if (analysisStatus === 'success' && generatedSessionId) {
      return 'Your interview plan is ready.';
    }
    if (analysisStatus === 'success' && isVoiceSession && !isVoiceReady) {
      return 'Run the voice check before opening the voice interview.';
    }
    if (analysisStatus === 'success' && isPreparingPlan) {
      return 'Your saved Match is ready. We’re preparing the question focus.';
    }
    if (analysisStatus === 'success' && planFailed) {
      return 'Your Match is saved. Retry interview preparation without running Match again.';
    }
    if (!selectedCV) {
      return 'Upload a new CV or choose one from your recent CV list.';
    }
    if (selectedCV && !isCvHumanVerified) {
      return 'Check the CV fields that will be used for matching, then mark them as reviewed.';
    }
    if (!hasRawJD) {
      return 'Paste the target job description so the system can compare it with your CV.';
    }
    if (!hasCurrentJDSummary) {
      return 'Parse the current job description before running the match.';
    }
    if (requiresJdHumanReview) {
      return `Review the parsed job fields. Current confidence is ${confidencePercent}%, and the target is ${thresholdPercent}%.`;
    }
    if (isVoiceSession && !isVoiceReady) {
      return 'Check your microphone and speaker before generating a voice interview.';
    }
    if (isVoiceSession) {
      return 'Voice setup is ready. Generate the match to create your interview plan.';
    }
    return 'Setup is ready. Generate the match to create your interview plan.';
  })();

  const isMatchReady = analysisStatus === 'success' && Boolean(generatedSessionId);

  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-3 border-t border-theme glass/95 p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur print:static print:mx-0 print:border print:shadow-none print:backdrop-blur-0 sm:static sm:mx-0 sm:rounded-2xl sm:border sm:p-4 sm:shadow-sm"
      data-qa="qa:card:analysis-actions"
    >
      <div className="rounded-xl border border-theme bg-white/45 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Match control</p>
        <div className="mt-2 flex items-start gap-2">
          {isMatchReady ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : null}
          <div>
            <p className="text-sm font-semibold text-primary">{isMatchReady ? 'Interview plan ready' : 'Next step'}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{helperText}</p>
          </div>
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
          {isVoiceSession ? 'Continue to voice interview' : 'Start text interview'}
        </Button>
      ) : planFailed && analysisStatus === 'success' ? (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onRetryPlan}
          disabled={!onRetryPlan}
          data-qa="qa:button:retry-interview-preparation"
        >
          Retry interview preparation
        </Button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          className="w-full disabled:border disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
          onClick={onGeneratePlan}
          disabled={!canGenerate}
        >
          {buttonLabel}
        </Button>
      )}
      {isMatchReady ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={onGeneratePlan}
          disabled={isGenerating}
        >
          Regenerate match
        </Button>
      ) : null}
    </div>
  );
}
