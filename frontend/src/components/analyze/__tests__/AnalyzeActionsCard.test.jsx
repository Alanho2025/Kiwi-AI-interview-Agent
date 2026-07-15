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
    expect(screen.getAllByText('Your interview plan is ready.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Generate the match to create your interview plan/i)).not.toBeInTheDocument();
  });

  it('uses print-safe positioning so the action card does not cover match results in PDFs', () => {
    render(<AnalyzeActionsCard {...readyProps} sessionMode="voice" isVoiceReady />);

    const actionCard = screen.getByRole('button', { name: 'Continue to voice interview' }).parentElement;

    expect(actionCard.className).toContain('print:static');
    expect(actionCard.className).toContain('print:shadow-none');
  });
});
