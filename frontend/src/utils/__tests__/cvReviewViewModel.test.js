import { describe, expect, it } from 'vitest';
import { buildCvReviewFormModel, buildCvReviewViewModel, buildReviewedCvProfilePayload } from '../cvReviewViewModel.js';

describe('buildCvReviewViewModel', () => {
  it('keeps only CV fields used for matching review', () => {
    const viewModel = buildCvReviewViewModel({
      parseConfidence: 0.72,
      parseWarnings: ['No dedicated skills section was detected.'],
      display: {
        summary: 'Data analyst moving toward engineering roles.',
        topSkills: ['SQL', 'Python'],
      },
      profile: {
        contact: { email: 'candidate@example.com' },
        experience: 'Built dashboards and automated reporting.',
        projects: 'Created ETL pipeline project.',
        education: 'Bachelor of IT.',
      },
    });

    expect(viewModel.confidence).toBe(0.72);
    expect(viewModel.warnings).toHaveLength(1);
    expect(viewModel.fields.map((field) => field.label)).toEqual([
      'Candidate summary',
      'Core skills',
      'Experience evidence',
      'Project evidence',
      'Education and credentials',
      'Key competencies',
    ]);
    expect(JSON.stringify(viewModel.fields)).not.toContain('candidate@example.com');
  });

  it('builds editable and saveable reviewed CV profile fields', () => {
    const formModel = buildCvReviewFormModel({
      display: {
        summary: 'Frontend engineer focused on React apps.',
        topSkills: ['React', 'Node.js'],
      },
      profile: {
        experience: 'Delivered production UI features.',
        projects: 'Built an interview practice app.',
        education: 'Bachelor of Software Engineering.',
        keyCompetencies: 'Stakeholder collaboration\nDebugging',
      },
    });

    expect(formModel.coreSkills).toEqual(['React', 'Node.js']);
    expect(formModel.keyCompetencies).toEqual(['Stakeholder collaboration', 'Debugging']);

    const payload = buildReviewedCvProfilePayload({
      ...formModel,
      coreSkills: [' React ', { label: 'Python' }],
    });
    expect(payload.coreSkills).toEqual(['React', 'Python']);
    expect(payload.candidateSummary).toBe('Frontend engineer focused on React apps.');
  });
});
