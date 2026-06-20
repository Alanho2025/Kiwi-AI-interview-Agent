import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScoreBreakdownCard } from '../ScoreBreakdownCard.jsx';

describe('ScoreBreakdownCard', () => {
  it('renders dynamic framework scoring transparency for v5 reports', () => {
    render(<ScoreBreakdownCard scoreExplanations={{
      frameworkRules: {
        explanation: 'Not-applicable dimensions are excluded.',
        turnLevelBreakdowns: [
          { turnId: 'q1', frameworkLabel: 'Scenario / Case Reasoning', score: 7.5, mainGapKey: 'validationVerification' },
          { turnId: 'q2', frameworkLabel: 'STARR', score: 6, mainGapKey: 'reflection' },
        ],
      },
    }} />);

    expect(screen.getByText('Framework Scoring Rules')).toBeInTheDocument();
    expect(screen.getByText(/Scenario \/ Case Reasoning/)).toBeInTheDocument();
    expect(screen.getByText(/STARR/)).toBeInTheDocument();
    expect(screen.getByText(/Validation Verification/)).toBeInTheDocument();
  });

  it('still renders legacy STARR transparency', () => {
    render(<ScoreBreakdownCard scoreExplanations={{
      starStructure: { explanation: 'Legacy STARR rules.' },
    }} />);

    expect(screen.getByText('STARR Scoring Rules')).toBeInTheDocument();
  });
});
