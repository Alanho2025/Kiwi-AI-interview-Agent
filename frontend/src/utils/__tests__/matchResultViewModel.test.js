import { describe, expect, it } from 'vitest';

import { buildMatchResultViewModel } from '../matchResultViewModel.js';

describe('buildMatchResultViewModel', () => {
  it('uses text-only fit categories and selects no more than two evidence gaps', () => {
    const viewModel = buildMatchResultViewModel({
      decision: { label: 'weak_match' },
      requirementChecks: [
        { id: 'gap-one', label: 'Production delivery', importance: 'high', status: 'not_met' },
        { id: 'gap-two', label: 'External stakeholder management', importance: 'high', status: 'not_met' },
        { id: 'gap-three', label: 'Security review', importance: 'high', status: 'not_met' },
      ],
      roleEvidenceMap: {
        items: [
          { roleIntentId: 'gap-one', roleIntent: 'Production delivery', priority: 'high', classification: 'gap' },
          { roleIntentId: 'gap-two', roleIntent: 'External stakeholder management', priority: 'high', classification: 'gap' },
          { roleIntentId: 'gap-three', roleIntent: 'Security review', priority: 'high', classification: 'gap' },
          {
            roleIntentId: 'project',
            roleIntent: 'Build AI workflows',
            priority: 'high',
            classification: 'direct',
            sourceEvidence: [{ text: 'Built a workflow automation prototype.', sourceTrace: { section: 'projects' } }],
          },
          {
            roleIntentId: 'experience',
            roleIntent: 'Measure adoption',
            priority: 'medium',
            classification: 'direct',
            sourceEvidence: [{ text: 'Tracked adoption data for a product launch.', sourceTrace: { section: 'experience' } }],
          },
          {
            roleIntentId: 'extra',
            roleIntent: 'Write technical documentation',
            priority: 'low',
            classification: 'direct',
            sourceEvidence: [{ text: 'Wrote operating guides.', sourceTrace: { section: 'projects' } }],
          },
        ],
      },
    });

    expect(viewModel.decision.label).toBe('Needs more evidence');
    expect(viewModel.topics).toHaveLength(5);
    expect(viewModel.topics.filter((topic) => topic.needsEvidence)).toHaveLength(2);
    expect(viewModel.topics.map((topic) => topic.topic)).not.toContain('Security review');
  });

  it('uses only Experience or Projects as a CV example and makes the missing evidence explicit', () => {
    const viewModel = buildMatchResultViewModel({
      roleEvidenceMap: {
        items: [
          {
            roleIntentId: 'tools',
            roleIntent: 'AI coding tools',
            priority: 'high',
            classification: 'direct',
            sourceEvidence: [
              { text: 'Listed Cursor and Claude Code.', sourceTrace: { section: 'skills' } },
              { text: 'Used Cursor to ship an internal tool.', sourceTrace: { section: 'projects' } },
            ],
          },
          {
            roleIntentId: 'security',
            roleIntent: 'Security review',
            priority: 'high',
            classification: 'direct',
            sourceEvidence: [{ text: 'Listed OWASP.', sourceTrace: { section: 'skills' } }],
          },
        ],
      },
    });

    const toolsTopic = viewModel.topics.find((topic) => topic.id === 'tools');
    const securityTopic = viewModel.topics.find((topic) => topic.id === 'security');

    expect(toolsTopic.example).toMatchObject({ source: 'Project', text: 'Used Cursor to ship an internal tool.' });
    expect(securityTopic.example).toBeNull();
    expect(securityTopic.evidenceLimit).toBe('The CV does not provide a direct example for this topic.');
    expect(securityTopic.followUp).toBe('Can you walk me through a specific example of Security review?');
  });

  it('marks a topic shortfall rather than inventing additional preparation topics', () => {
    const viewModel = buildMatchResultViewModel({
      roleEvidenceMap: {
        items: [{
          roleIntentId: 'one',
          roleIntent: 'Build AI workflows',
          priority: 'high',
          classification: 'direct',
          sourceEvidence: [{ text: 'Built a workflow prototype.', sourceTrace: { section: 'projects' } }],
        }],
      },
    });

    expect(viewModel.topics).toHaveLength(1);
    expect(viewModel.topicShortfall).toBe(true);
  });

  it('filters qualification requirements and downgrades a strong verdict when two core topics lack direct evidence', () => {
    const qualification = 'A tertiary qualification in Computer Science, Data Engineering, Information Systems, or a related field';
    const viewModel = buildMatchResultViewModel({
      decision: { label: 'strong_match' },
      requirementChecks: [
        { id: 'qualification', label: qualification, category: 'qualification', importance: 'high', status: 'met' },
        { id: 'education', label: 'Education in Data Engineering', category: 'education', importance: 'high', status: 'met' },
        { id: 'etl', label: 'ETL and data modelling', importance: 'high', status: 'not_met' },
        { id: 'pipelines', label: 'Data pipeline delivery', importance: 'high', status: 'not_met' },
        { id: 'collaboration', label: 'Collaboration tools', importance: 'medium', status: 'met' },
      ],
      roleEvidenceMap: {
        items: [
          {
            roleIntentId: 'qualification',
            roleIntent: qualification,
            priority: 'high',
            classification: 'direct',
            sourceEvidence: [{ text: 'Built a GitHub project.', sourceTrace: { section: 'projects' } }],
          },
          { roleIntentId: 'etl', roleIntent: 'ETL and data modelling', priority: 'high', classification: 'gap' },
          { roleIntentId: 'pipelines', roleIntent: 'Data pipeline delivery', priority: 'high', classification: 'gap' },
          {
            roleIntentId: 'collaboration',
            roleIntent: 'Collaboration tools',
            priority: 'medium',
            classification: 'direct',
            sourceEvidence: [{ text: 'Maintained team documentation in Notion.', sourceTrace: { section: 'projects' } }],
          },
        ],
      },
    });

    expect(viewModel.decision.label).toBe('Partial match');
    expect(viewModel.topics.map((topic) => topic.topic)).not.toContain(qualification);
    expect(viewModel.topics.map((topic) => topic.topic)).not.toContain('Education in Data Engineering');
    expect(viewModel.topics.filter((topic) => topic.needsEvidence).map((topic) => topic.topic)).toEqual([
      'ETL and data modelling',
      'Data pipeline delivery',
    ]);
  });

  it('keeps a strong verdict when high-priority topics have direct work or project examples', () => {
    const viewModel = buildMatchResultViewModel({
      decision: { label: 'strong_match' },
      requirementChecks: [
        { id: 'etl', label: 'ETL and data modelling', importance: 'high', status: 'not_met' },
        { id: 'pipelines', label: 'Data pipeline delivery', importance: 'high', status: 'not_met' },
      ],
      roleEvidenceMap: {
        items: [
          {
            roleIntentId: 'etl',
            roleIntent: 'ETL and data modelling',
            priority: 'high',
            classification: 'gap',
            sourceEvidence: [{ text: 'Built ETL jobs for analytics reporting.', sourceTrace: { section: 'experience' } }],
          },
          {
            roleIntentId: 'pipelines',
            roleIntent: 'Data pipeline delivery',
            priority: 'high',
            classification: 'gap',
            sourceEvidence: [{ text: 'Built a data pipeline project.', sourceTrace: { section: 'projects' } }],
          },
        ],
      },
    });

    expect(viewModel.topics.every((topic) => topic.example)).toBe(true);
    expect(viewModel.decision.label).toBe('Strong match');
  });
});
