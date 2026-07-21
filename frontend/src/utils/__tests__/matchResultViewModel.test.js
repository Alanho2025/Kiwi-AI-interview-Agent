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

    expect(viewModel.decision.label).toBe('Promising but needs validation');
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

  it('groups the grounded role evidence map and exposes high-priority coverage', () => {
    const viewModel = buildMatchResultViewModel({
      roleEvidenceMap: {
        intentCoverage: { highPriorityTotal: 2, strong: 1, partial: 1, missing: 0 },
        items: [
          {
            roleIntentId: 'intent:sql',
            roleIntent: 'Production SQL experience',
            priority: 'high',
            classification: 'direct',
            score: 88,
            sourceEvidence: [{ text: 'Built SQL pipelines.', sourceTrace: { section: 'experience' } }],
            limitation: '',
          },
          {
            roleIntentId: 'intent:stakeholder',
            roleIntent: 'Stakeholder communication',
            priority: 'high',
            classification: 'adjacent',
            score: 68,
            sourceEvidence: [{ text: 'Presented internal project updates.', sourceTrace: { section: 'projects' } }],
            limitation: 'External stakeholder scope is not explicit.',
          },
        ],
      },
    });

    expect(viewModel.roleIntentCoverage).toEqual({ highPriorityTotal: 2, strong: 1, partial: 1, missing: 0 });
    expect(viewModel.roleEvidenceGroups.direct[0]).toMatchObject({
      label: 'Production SQL experience',
      sourceSection: 'experience',
    });
    expect(viewModel.roleEvidenceGroups.adjacent[0].limitation).toMatch(/External stakeholder/i);
  });
});
