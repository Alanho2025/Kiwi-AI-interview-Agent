import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CommercialStressTestSection } from '../CommercialStressTestSection.jsx';

describe('CommercialStressTestSection', () => {
  it('formats execution and stage costs with the report currency', () => {
    render(<CommercialStressTestSection commercialStressTest={{
      currency: 'NZD',
      totalExecutionCost: 0.000594,
      totalLlmTokens: 150,
      speechAudioSeconds: 12,
      estimatedHumanMinutesReplaced: { min: 30, max: 60 },
      conclusion: 'Costs are lower than manual review.',
      assumptions: 'Assumes 30-60 minutes at NZ$35/hour.',
      stageBreakdown: [
        { id: 'interview', label: 'Interview', providers: ['DeepSeek'], estimatedCost: 0.000594 },
      ],
    }} />);

    expect(screen.getAllByText('NZ$0.000594')).toHaveLength(2);
  });
});
