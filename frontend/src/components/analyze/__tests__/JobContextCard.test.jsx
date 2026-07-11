import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JobContextCard } from '../JobContextCard.jsx';

const baseRubric = {
  title: 'Data Engineer',
  jobOverview: {
    title: 'Data Engineer',
    companyName: 'Luma Analytics',
  },
  sections: {
    responsibilities: ['Build reliable data pipelines.'],
    mustHaveRequirements: ['Production SQL'],
    technicalSkills: {
      data: [{ label: 'SQL' }],
    },
  },
  roleFit: {
    companyUnderstanding: {
      summary: 'Luma builds analytics products.',
    },
    roleIntent: {
      items: [{
        id: 'intent:sql',
        statement: 'Production SQL',
        priority: 'high',
        category: 'requirement',
        sourceLabel: 'JD must-have requirement',
        confidence: 0.78,
        sourceConfidence: 'medium',
        reviewConfidence: 'unreviewed',
        sourceTrace: { sourceType: 'job_description', section: 'mustHaveRequirements', rawSnippet: 'Production SQL' },
      }],
    },
  },
};

const renderCard = (overrides = {}) => {
  const props = {
    rawJD: 'Data Engineer at Luma Analytics',
    setRawJD: vi.fn(),
    companyWebsiteUrl: 'https://luma.example',
    setCompanyWebsiteUrl: vi.fn(),
    userCompanyContext: '',
    setUserCompanyContext: vi.fn(),
    structuredJD: 'Structured JD',
    structuredJDRubric: baseRubric,
    onStructuredJDRubricChange: vi.fn(),
    onSummarize: vi.fn(),
    isSummarizing: false,
    requiresJdHumanReview: true,
    onConfirmJDSummary: vi.fn(),
    ...overrides,
  };

  render(<JobContextCard {...props} />);
  return props;
};

describe('JobContextCard role-fit editing', () => {
  it('keeps source confidence separate from human review confidence for edited role intent', () => {
    const props = renderCard();

    fireEvent.change(screen.getByLabelText(/Role intent priorities/i), {
      target: { value: 'Production SQL\nWorkflow automation ownership' },
    });

    const nextRubric = props.onStructuredJDRubricChange.mock.calls.at(-1)[0];
    const newIntent = nextRubric.roleFit.roleIntent.items.find((item) => item.statement === 'Workflow automation ownership');

    expect(newIntent).toEqual(expect.objectContaining({
      sourceLabel: 'Human-reviewed role intent',
      sourceConfidence: 'unsupported',
      reviewConfidence: 'user_modified',
    }));
    expect(newIntent.confidence).not.toBe(1);
  });
});
