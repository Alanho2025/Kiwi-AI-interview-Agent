import { describe, expect, it } from 'vitest';
import { buildCvSignals } from '../../../src/services/cv/cvSignalExtractor.js';

describe('buildCvSignals', () => {
  it('derives the currently supported role signals from technical skills', () => {
    const signals = buildCvSignals({
      skills: [{ label: 'Python' }, { label: 'SQL' }, { label: 'React' }, { label: 'Node.js' }],
      projects: [{ title: 'Forkcast' }],
      achievements: ['Reduced response time by 40%'],
    });

    expect(signals.roleSignals).toEqual(expect.arrayContaining(['data_profile', 'web_engineering']));
    expect(signals.roleSignals).not.toContain('backend_engineering');
    expect(signals.skills).toEqual(expect.arrayContaining(['Python', 'SQL', 'React', 'Node.js']));
  });
});
