import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalyzeActionsCard } from '../AnalyzeActionsCard.jsx';

const readyProps = {
  analysisStatus: 'success',
  generatedSessionId: 'session-1',
  selectedCV: { id: 'cv-1', name: 'Alan Ho_CV.pdf' },
  rawJD: 'AI Automation Engineer',
  hasCurrentJDSummary: true,
  canUseJDSummary: true,
  isCvHumanVerified: true,
  onGeneratePlan: vi.fn(),
  onStartInterview: vi.fn(),
};

describe('AnalyzeActionsCard', () => {
  it('does not show generate-match helper copy after the interview plan is ready', () => {
    render(<AnalyzeActionsCard {...readyProps} sessionMode="voice" isVoiceReady />);

    expect(screen.getByRole('button', { name: 'Continue to voice interview' })).toBeInTheDocument();
    expect(screen.getByText('Match control')).toBeInTheDocument();
    expect(screen.getByText('Interview plan ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate match' })).toBeInTheDocument();
    expect(screen.queryByText('Setup checklist')).not.toBeInTheDocument();
    expect(screen.queryByText('CV added')).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate the match to create your interview plan/i)).not.toBeInTheDocument();
  });

  it('uses print-safe positioning so the action card does not cover match results in PDFs', () => {
    render(<AnalyzeActionsCard {...readyProps} sessionMode="voice" isVoiceReady />);

    const actionCard = screen.getByRole('button', { name: 'Continue to voice interview' }).parentElement;

    expect(actionCard.className).toContain('print:static');
    expect(actionCard.className).toContain('print:shadow-none');
  });

  it('shows plan preparation separately after the Match completes', () => {
    render(<AnalyzeActionsCard
      {...readyProps}
      generatedSessionId={null}
      planStatus="preparing"
      sessionMode="voice"
      isVoiceReady
    />);

    expect(screen.getByRole('button', { name: 'Preparing interview session...' })).toBeDisabled();
    expect(screen.getByText(/saved Match is ready/i)).toBeInTheDocument();
  });

  it('offers a plan-only retry without rerunning Match', () => {
    const onRetryPlan = vi.fn();
    render(<AnalyzeActionsCard
      {...readyProps}
      generatedSessionId={null}
      planStatus="failed"
      onRetryPlan={onRetryPlan}
      sessionMode="voice"
      isVoiceReady
    />);

    screen.getByRole('button', { name: 'Retry interview preparation' }).click();
    expect(onRetryPlan).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Generate match analysis/i })).not.toBeInTheDocument();
  });
});
