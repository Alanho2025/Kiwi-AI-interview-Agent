import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReportTrustStatusCard } from '../ReportTrustStatusCard.jsx';

describe('ReportTrustStatusCard', () => {
  it.each([
    ['verified', 'Report checks complete'],
    ['verified_after_repair', 'Report checks complete after repair'],
    ['needs_review', 'This report still needs review'],
    ['verification_incomplete', 'Report verification is incomplete'],
  ])('renders a candidate-safe %s state', (status, title) => {
    render(<ReportTrustStatusCard summary={{
      schemaVersion: 'report_publication_summary_v1',
      status,
      tone: status.startsWith('verified') ? 'success' : 'warning',
      title,
      message: 'Candidate-safe explanation.',
      nextAction: status.startsWith('verified')
        ? null
        : { type: 'recheck_report', label: 'Recheck report' },
    }} />);

    expect(screen.getByRole('status')).toHaveTextContent(title);
    expect(screen.getByText('Candidate-safe explanation.')).toBeInTheDocument();
  });

  it('offers report recheck and regeneration without changing export behavior', () => {
    const onRecheck = vi.fn();
    const onRegenerate = vi.fn();
    render(<ReportTrustStatusCard
      summary={{
        status: 'needs_review',
        tone: 'warning',
        title: 'This report still needs review',
        message: 'Use the report as a draft until checks pass.',
        nextAction: { type: 'recheck_report', label: 'Recheck report' },
      }}
      onRecheck={onRecheck}
      onRegenerate={onRegenerate}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Recheck report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate fresh report' }));

    expect(onRecheck).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/export blocked/i)).not.toBeInTheDocument();
  });

  it('does not render an empty card before report data is available', () => {
    const { container } = render(<ReportTrustStatusCard summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
