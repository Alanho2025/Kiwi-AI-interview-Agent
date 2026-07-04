import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TurnBreakdownSection } from '../TurnBreakdownSection.jsx';

describe('TurnBreakdownSection', () => {
  it('renders role-specific framework labels and dynamic dimensions without STARR micro-scores', () => {
    render(
      <TurnBreakdownSection
        turnBreakdowns={[{
          question: 'How would you manage a medication safety concern?',
          answer: 'I would review the record, escalate the risk, and document the outcome.',
          feedback: 'Explain how you verified the response.',
          rubricType: 'role_specific',
          frameworkKey: 'safety_quality_ethics',
          frameworkLabel: 'Safety, Quality and Ethics',
          starApplicable: false,
          scores: { business: 5, logic: 7, evidence: 4 },
          frameworkBreakdown: {
            dimensions: [
              { key: 'clinicalContext', label: 'Clinical context', status: 'clear', score: 10, reason: 'Context was clear.' },
              { key: 'professionalJudgement', label: 'Professional judgement', status: 'partial', score: 5, reason: 'Add the decision rationale.' },
              { key: 'riskQualityEthics', label: 'Risk / Quality / Ethics', status: 'clear', score: 10, reason: 'Risk was addressed.' },
              { key: 'validationVerification', label: 'Documentation / Review', status: 'partial', score: 5, reason: 'Explain the review.' },
              { key: 'outcomeValue', label: 'Patient outcome', status: 'not_applicable', score: 0, reason: 'Not required for this scenario.' },
            ],
            mainGapKey: 'professionalJudgement',
            normalizedScore: 7.5,
          },
        }]}
      />
    );

    expect(screen.getByText('Safety, Quality and Ethics')).toBeInTheDocument();
    expect(screen.getByText('Professional judgement')).toBeInTheDocument();
    expect(screen.getByText('Documentation / Review')).toBeInTheDocument();
    expect(screen.queryByText('Patient outcome')).not.toBeInTheDocument();
    expect(screen.queryByText('not applicable')).not.toBeInTheDocument();
    expect(screen.queryByText('STARR Evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Business')).not.toBeInTheDocument();
  });

  it('shows STARR for behavioural answers', () => {
    render(
      <TurnBreakdownSection turnBreakdowns={[{
        question: 'Tell me about a conflict.',
        answer: 'I resolved a conflict and reflected on it.',
        feedback: 'Add the result.',
        rubricType: 'starr',
        frameworkKey: 'behavioural_starr',
        frameworkLabel: 'STARR',
        starApplicable: true,
        starBreakdown: {
          situation: 'clear', task: 'partial', action: 'clear', result: 'partial', reflection: 'clear',
        },
      }]} />
    );

    expect(screen.getByText('STARR Evidence')).toBeInTheDocument();
  });

  it('renders the logic score bar with a visible fill when the score is present', () => {
    const { container } = render(
      <TurnBreakdownSection
        turnBreakdowns={[
          {
            question: 'Tell me about a project.',
            answer: 'I built an automation workflow and reduced repetitive tasks.',
            feedback: 'Add a measurable result.',
            scores: { business: 5, logic: 7, evidence: 4 },
            starBreakdown: {
              situation: 'partial',
              task: 'partial',
              action: 'partial',
              result: 'partial',
              reflection: 'missing',
            },
          },
        ]}
      />
    );

    expect(screen.getByText('Logic')).toBeInTheDocument();
    expect(screen.getByText('7/10')).toBeInTheDocument();

    const visibleFills = [...container.querySelectorAll('[style]')]
      .filter((node) => node.getAttribute('style')?.includes('width: 70%'));

    expect(visibleFills.some((node) => node.getAttribute('style')?.includes('background-color: rgb(139, 92, 246)'))).toBe(true);
  });
});
