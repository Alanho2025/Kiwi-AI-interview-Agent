import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProofStrategyReviewPanel } from '../ProofStrategyReviewPanel.jsx';

describe('ProofStrategyReviewPanel', () => {
  it('explains a ready interview focus in plain English', () => {
    render(<ProofStrategyReviewPanel questionPoolInfo={{
      count: 8,
      proofStrategy: {
        status: 'ready',
        focusAreaCount: 4,
        gapCount: 2,
        fallbackQuestionCount: 0,
        unresolvedCount: 0,
        focusAreas: [
          {
            label: 'React delivery experience',
            kind: 'experience',
            proofAngle: 'frontend delivery ownership',
            preparationHint: 'Prepare one example that shows frontend delivery ownership.',
            risk: 'Do not use this as proof of backend ownership.',
          },
          { label: 'Production support', kind: 'gap' },
        ],
      },
    }} />);

    expect(screen.getByText('Your interview focus is ready')).toBeInTheDocument();
    expect(screen.getByText('4 focus areas')).toBeInTheDocument();
    expect(screen.getByText('2 gaps to explore')).toBeInTheDocument();
    expect(screen.getByText('React delivery experience')).toBeInTheDocument();
    expect(screen.getByText('Prepare one example that shows frontend delivery ownership.')).toBeInTheDocument();
    expect(screen.getByText('Do not use this as proof of backend ownership.')).toBeInTheDocument();
    expect(screen.getByText('Production support')).toBeInTheDocument();
    expect(screen.queryByText(/coverage|schema|proof point|rank/i)).not.toBeInTheDocument();
  });

  it('uses actionable fallback language instead of backend error codes', () => {
    render(<ProofStrategyReviewPanel questionPoolInfo={{
      count: 5,
      readiness: 'degraded',
      degradedReason: 'missing_role_fit_artifacts',
      proofStrategy: {
        status: 'degraded',
        focusAreaCount: 0,
        gapCount: 0,
        fallbackQuestionCount: 2,
        unresolvedCount: 1,
        focusAreas: [],
      },
    }} />);

    expect(screen.getByText('Interview focus needs a quick review')).toBeInTheDocument();
    expect(screen.getByText(/Check the job and company details/i)).toBeInTheDocument();
    expect(screen.queryByText('missing_role_fit_artifacts')).not.toBeInTheDocument();
  });
});
