import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnswerRewriteSection } from '../AnswerRewriteSection.jsx';

describe('AnswerRewriteSection', () => {
  it('shows an unavailable state instead of an invalid stronger answer', () => {
    render(<AnswerRewriteSection answerRewriteTips={[{
      status: 'unavailable',
      weak: 'Raw answer',
      better: '',
      failureReason: 'A grounded stronger answer could not be generated reliably.',
    }]} />);

    expect(screen.queryByText('Stronger version')).not.toBeInTheDocument();
    expect(screen.getByText(/could not be generated reliably/i)).toBeInTheDocument();
  });
});

