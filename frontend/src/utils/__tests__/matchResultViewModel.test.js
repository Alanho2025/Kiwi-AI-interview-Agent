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
    expect(viewModel.scoreCards.map((item) => item.title)).toEqual(['Responsibility fit', 'Skill and tool fit', 'Must-have evidence']);
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

  it('surfaces semantic judgement evidence fields from requirement notes', () => {
    const viewModel = buildMatchResultViewModel({
      requirementChecks: [
        {
          id: 'stakeholder',
          label: 'Stakeholder communication',
          type: 'soft',
          importance: 'high',
          status: 'partial',
          notes: 'section=projects; capabilities=communication; evidenceStrength=partial; Team updates are related; missingEvidence=External stakeholder proof; interviewProbe=Ask about client updates',
          evidence: ['Presented weekly updates to a cross-functional team.'],
        },
      ],
    });

    expect(viewModel.requirementChecks[0]).toMatchObject({
      evidenceStrength: 'partial',
      missingEvidence: 'External stakeholder proof',
      interviewProbe: 'Ask about client updates',
    });
  });
});
