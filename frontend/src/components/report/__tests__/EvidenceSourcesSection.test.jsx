import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EvidenceSourcesSection } from '../EvidenceSourcesSection.jsx';

describe('EvidenceSourcesSection', () => {
  it('renders claim, source, snippet, and confidence', () => {
    render(<EvidenceSourcesSection items={[{
      claim: 'Reduced retest rate',
      sourceLabel: 'Answer Q6',
      evidenceSnippet: 'reduced the retest rate from 15% to 5%',
      confidenceLevel: 'medium',
    }]} />);

    expect(screen.getByText('Reduced retest rate')).toBeInTheDocument();
    expect(screen.getByText('Answer Q6')).toBeInTheDocument();
    expect(screen.getByText(/15% to 5%/)).toBeInTheDocument();
    expect(screen.getByText(/medium confidence/i)).toBeInTheDocument();
  });
});

