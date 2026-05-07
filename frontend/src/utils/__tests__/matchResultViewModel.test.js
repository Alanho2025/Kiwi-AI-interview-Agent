import { describe, expect, it } from 'vitest';
import { buildMatchResultViewModel } from '../matchResultViewModel.js';

describe('buildMatchResultViewModel', () => {
  it('turns raw decision and confidence fields into user-facing match copy', () => {
    const viewModel = buildMatchResultViewModel({
      overallScore: 77.2,
      confidence: 0.84,
      decision: { label: 'moderate_match' },
      scoreBreakdown: { macro: 70, micro: 82, requirements: 65 },
      explanation: {
        strengths: [{ label: 'Python and SQL', evidence: ['Built analytics scripts with Python and SQL.'] }],
        gaps: [{ label: 'Limited commercial delivery proof' }],
        risks: [],
      },
      requirementChecks: [],
    });

    expect(viewModel.decision.label).toBe('Promising match');
    expect(viewModel.overallScore).toBe(77);
    expect(viewModel.confidencePercent).toBe(84);
    expect(viewModel.summary).toContain('Python and SQL');
    expect(viewModel.scoreCards.map((item) => item.title)).toEqual(['Role fit', 'Skill match', 'Must-have fit']);
  });

  it('prioritises missing hard requirements before matched requirements', () => {
    const viewModel = buildMatchResultViewModel({
      decision: { label: 'not_qualified' },
      requirementChecks: [
        { id: 'sql', label: 'SQL', type: 'hard', importance: 'high', status: 'met', evidence: ['SQL project'] },
        { id: 'prod', label: 'Production data pipelines', type: 'hard', importance: 'high', status: 'not_met' },
        { id: 'docs', label: 'Documentation', type: 'soft', importance: 'medium', status: 'partial' },
      ],
    });

    expect(viewModel.requirementChecks[0]).toMatchObject({
      label: 'Production data pipelines',
      status: 'Missing evidence',
      tone: 'danger',
    });
    expect(viewModel.requirementChecks[1].label).toBe('Documentation');
    expect(viewModel.requirementChecks[2].label).toBe('SQL');
  });
});
