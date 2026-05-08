import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NZWorkplaceFitSection } from '../NZWorkplaceFitSection.jsx';

const fit = {
  enabled: true,
  score: 7.2,
  summary: 'Your answers showed useful NZ workplace fit signals, with room to make collaboration more explicit.',
  strengths: ['You showed that your work connected to team goals and other people.'],
  gaps: ['Balance your personal contribution with how you worked with others and supported a shared result.'],
  dimensionScores: [
    {
      id: 'teamwork',
      label: 'Teamwork and shared outcomes',
      score: 7.3,
      observed: true,
      riskDetected: false,
      feedback: 'You showed that your work connected to team goals and other people.',
    },
  ],
  evidence: [
    {
      dimension: 'Teamwork and shared outcomes',
      quote: 'I checked the design with the team.',
      signal: 'strength',
    },
    {
      dimension: 'Humility with confidence',
      quote: 'I completed the full system myself.',
      signal: 'risk',
    },
  ],
  suggestedRewrite: {
    weak: 'I completed the full system myself.',
    better: 'I led the main implementation, and I kept the team aligned through design checks and review.',
    reason: 'This keeps ownership clear while showing collaboration.',
  },
};

describe('NZWorkplaceFitSection', () => {
  it('does not render when NZ workplace coaching is disabled', () => {
    const { container } = render(<NZWorkplaceFitSection fit={{ enabled: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders score, summary, evidence, and suggested rewrite when enabled', () => {
    render(<NZWorkplaceFitSection fit={fit} />);

    expect(screen.getByText('NZ Workplace Communication Fit')).toBeInTheDocument();
    expect(screen.getByText('7.2')).toBeInTheDocument();
    expect(screen.getByText('Developing')).toBeInTheDocument();
    expect(screen.getByText(fit.summary)).toBeInTheDocument();
    expect(screen.getByText(/Balance your personal contribution/i)).toBeInTheDocument();
    expect(screen.getAllByText(/I completed the full system myself/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/kept the team aligned/i)).toBeInTheDocument();
  });
});
