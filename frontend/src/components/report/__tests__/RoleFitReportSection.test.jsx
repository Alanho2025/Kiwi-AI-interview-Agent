import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoleFitReportSection } from '../RoleFitReportSection.jsx';

describe('RoleFitReportSection', () => {
  it('explains role fit outcomes in plain English', () => {
    render(<RoleFitReportSection roleFit={{
      available: true,
      status: 'ready',
      roleIntentCoverage: {
        total: 2,
        covered: 1,
        partial: 1,
        missing: 0,
        items: [
          { label: 'Reliable production delivery', status: 'covered' },
          { label: 'Stakeholder communication', status: 'partial' },
        ],
      },
      evidenceUsageMap: {
        totalUses: 1,
        items: [{ label: 'Production release example', useCount: 1 }],
      },
      answerAlignments: [{
        turnId: 'answer-1',
        question: 'Tell me about a production delivery improvement.',
        label: 'strong',
        score: 84,
        diagnosis: { mainIssue: 'Your answer directly addressed this focus area.' },
        betterAnswerPlan: { direction: 'Keep the example and make the result easy to hear.' },
      }],
      questionReasoning: [{
        questionId: 'question-1',
        topic: 'Reliable production delivery',
        reason: 'This question checked an important part of the role.',
      }],
    }} />);

    expect(screen.getByText('How your answers matched this role')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 focus areas clearly demonstrated')).toBeInTheDocument();
    expect(screen.getByText('Reliable production delivery')).toBeInTheDocument();
    expect(screen.getByText(/Strong match for this answer/i)).toBeInTheDocument();
    expect(screen.queryByText(/proofPointId|coverageId|schemaVersion|evidence-delivery/i)).not.toBeInTheDocument();
  });

  it('shows a calm unavailable message when role fit is unavailable', () => {
    render(<RoleFitReportSection roleFit={{
      available: false,
      status: 'unavailable',
    }} />);

    expect(screen.getByText('Role-specific coaching is unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Your existing interview feedback is still available/i)).toBeInTheDocument();
  });
});
