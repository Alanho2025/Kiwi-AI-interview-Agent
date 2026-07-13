import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TranscriptRiskSection } from '../TranscriptRiskSection.jsx';

describe('TranscriptRiskSection', () => {
  it('renders deferred review evidence without pretending actions are available', () => {
    render(<TranscriptRiskSection risks={[{
      code: 'deferred_transcript_review',
      message: 'A transcript correction was deferred for review before relying on this answer as evidence.',
      affectedTurnIds: ['answer-database'],
      evidence: [{
        turnId: 'answer-database',
        rawSnippet: 'I used history team during the incident response.',
        normalizedSnippet: 'I used SRE team during the incident response.',
        reviewItems: [{
          rawSnippet: 'history team',
          proposedSnippet: 'SRE team',
          reasonLabel: 'technical term unclear',
          riskLabel: 'Medium transcript risk',
        }],
      }],
      needsUserConfirmation: false,
    }]} />);

    expect(screen.getByText('Transcript Checks Needed')).toBeInTheDocument();
    expect(screen.getByText(/deferred for review/i)).toBeInTheDocument();
    expect(screen.getByText('Medium transcript risk')).toBeInTheDocument();
    expect(screen.getByText('technical term unclear')).toBeInTheDocument();
    expect(screen.getByText(/history team/)).toBeInTheDocument();
    expect(screen.getByText(/SRE team/)).toBeInTheDocument();
    expect(screen.getByText(/Only correct words the system misheard/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept correction/i })).not.toBeInTheDocument();
  });

  it('renders nothing when there are no transcript risks', () => {
    const { container } = render(<TranscriptRiskSection risks={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
