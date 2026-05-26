import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TokenUsageSummary } from '../TokenUsageSummary.jsx';
import { getRecentSessionUsage, getUsageSummary } from '../../../api/usageApi.js';

vi.mock('../../../api/usageApi.js', () => ({
  getUsageSummary: vi.fn(),
  getRecentSessionUsage: vi.fn(),
}));

describe('TokenUsageSummary', () => {
  it('formats dashboard execution costs with the backend currency', async () => {
    getUsageSummary.mockResolvedValue({
      currency: 'NZD',
      totalCost: 1.0933,
      totalTokens: 290100,
      measuredSessions: 16,
      ai: {
        currency: 'NZD',
        totalCost: 1.0933,
        totalTokens: 290100,
        measuredSessions: 16,
      },
    });
    getRecentSessionUsage.mockResolvedValue([
      { currency: 'NZD', sessionId: 'session-6080c2', totalTokens: 2100, estimatedCost: 0.00184 },
    ]);

    render(<TokenUsageSummary />);

    expect(await screen.findByText('NZ$1.0933')).toBeInTheDocument();
    expect(screen.getAllByText('NZ$0.00184')).toHaveLength(2);
  });
});
