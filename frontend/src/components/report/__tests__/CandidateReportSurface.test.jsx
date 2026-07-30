import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CandidateReportSummary } from '../CandidateReportSummary.jsx';
import { DeveloperReportDiagnostics } from '../DeveloperReportDiagnostics.jsx';
import { ReportActionBar } from '../ReportActionBar.jsx';
import { getReportDiagnostics } from '../../../api/reportApi.js';

vi.mock('../../../api/reportApi.js', () => ({
  getReportDiagnostics: vi.fn(),
}));

describe('candidate report surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows concise score explanations without formulas or raw diagnostics', () => {
    render(<CandidateReportSummary
      scoreExplanations={{
        overall: {
          formula: 'private weighted formula',
          explanation: 'This combines role match and interview evidence.',
        },
      }}
      dataInsights={[]}
    />);

    expect(screen.getByText('This combines role match and interview evidence.')).toBeInTheDocument();
    expect(screen.queryByText(/private weighted formula/i)).not.toBeInTheDocument();
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
