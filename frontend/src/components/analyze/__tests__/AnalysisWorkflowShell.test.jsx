import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisWorkflowShell } from '../AnalysisWorkflowShell.jsx';

describe('AnalysisWorkflowShell', () => {
  it('keeps only the completion icon and stage label while preserving stage navigation', () => {
    const onStepChange = vi.fn();

    render(
      <AnalysisWorkflowShell
        activeStepId="cv"
        onStepChange={onStepChange}
        steps={[
          { id: 'cv', label: 'Upload CV', detail: 'Alan Ho_CV.pdf', complete: true },
          { id: 'jd', label: 'Paste JD', detail: 'Ready to summarise', blocked: false },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Upload CV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste JD' })).toBeInTheDocument();
    expect(screen.queryByText('Alan Ho_CV.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to summarise')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Paste JD' }));
    expect(onStepChange).toHaveBeenCalledWith('jd');
  });
});
