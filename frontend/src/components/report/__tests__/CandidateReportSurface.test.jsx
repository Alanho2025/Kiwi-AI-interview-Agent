import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CandidateReportSummary } from '../CandidateReportSummary.jsx';
import { DeveloperReportDiagnostics } from '../DeveloperReportDiagnostics.jsx';
import { ReportActionBar } from '../ReportActionBar.jsx';
import { ReportHeroCard } from '../ReportHeroCard.jsx';
import { getReportDiagnostics } from '../../../api/reportApi.js';

vi.mock('../../../api/reportApi.js', () => ({
  getReportDiagnostics: vi.fn(),
}));

describe('candidate report surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an interview-only score explanation without formulas or raw diagnostics', () => {
    render(<CandidateReportSummary
      scoreExplanations={{
        overall: {
          formula: 'private weighted formula',
          explanation: 'This reflects the quality of your interview answers.',
        },
        cvJdMatch: {
          explanation: 'This must not appear on the interview report.',
        },
      }}
      dataInsights={[]}
      hasInterviewPerformance
    />);

    expect(screen.getByRole('heading', { name: 'Interview performance' })).toBeInTheDocument();
    expect(screen.getByText('This reflects the quality of your interview answers.')).toBeInTheDocument();
    expect(screen.queryByText(/CV–JD match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/must not appear/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/private weighted formula/i)).not.toBeInTheDocument();
  });

  it('shows one interview-performance card and ignores legacy CV-JD data', () => {
    render(<ReportHeroCard
      report={{
        scores: { overall: 69, cvJdMatch: 88, interviewPerformance: 69 },
        summary: 'Decision: strong_match.',
        candidateFeedback: {
          scoreExplanations: {
            overall: { summary: 'Answer quality summary.', next: 'Add a measurable outcome.' },
          },
        },
      }}
      qa={{ passed: true }}
      takeaway="Focus on your strongest interview examples."
      scoreBand="Developing"
      generationSource="ai"
    />);

    expect(screen.getByText('Interview performance')).toBeInTheDocument();
    expect(screen.getByText('69.00')).toBeInTheDocument();
    expect(screen.queryByText(/CV-JD|CV–JD|Review status/i)).not.toBeInTheDocument();
  });

  it('does not relabel a legacy blended report as interview performance', () => {
    render(<>
      <ReportHeroCard
        report={{
          scores: { overall: ' ' },
          summary: 'Decision: strong_match.',
          candidateFeedback: {
            scoreExplanations: {
              overall: { summary: 'Historic CV–JD blend.', next: 'Do not show this.' },
            },
          },
        }}
        qa={{ passed: true }}
        takeaway="This report needs regeneration for an interview-only score."
        scoreBand="Strong match"
        generationSource="ai"
      />
      <CandidateReportSummary
        scoreExplanations={{
          overall: { explanation: 'Historic CV–JD blend.' },
        }}
        dataInsights={[]}
        hasInterviewPerformance={false}
      />
    </>);

    expect(screen.queryByText('Interview performance')).not.toBeInTheDocument();
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
    expect(screen.queryByText(/strong_match|Strong match|CV–JD blend/i)).not.toBeInTheDocument();
  });

  it('keeps QA rewrite controls out of the candidate action bar', () => {
    render(<ReportActionBar
      loading={false}
      onGenerate={vi.fn()}
      onExport={vi.fn()}
      recordingStatus={{ state: 'missing' }}
    />);

    expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run qa/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/optional qa rewrite prompt/i)).not.toBeInTheDocument();
  });

  it('loads developer diagnostics only after the non-production toggle is opened', async () => {
    vi.mocked(getReportDiagnostics).mockResolvedValue({
      executionCost: { totalLlmTokens: 100 },
    });
    render(<DeveloperReportDiagnostics sessionId="session-1" />);

    expect(getReportDiagnostics).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /show developer diagnostics/i }));

    await waitFor(() => expect(getReportDiagnostics).toHaveBeenCalledWith('session-1'));
    expect(await screen.findByText(/totalLlmTokens/)).toBeInTheDocument();
  });
});
