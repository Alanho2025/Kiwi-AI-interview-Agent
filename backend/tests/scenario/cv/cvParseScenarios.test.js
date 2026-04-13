import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { extractCvSections } from '../../../src/services/cv/cvSectionParser.js';
import { buildCvSignals } from '../../../src/services/cv/cvSignalExtractor.js';
import { normalizeCvEvidence } from '../../../src/services/cv/cvEvidenceNormalizer.js';

const loadFixture = async (name) => fs.readFile(path.resolve('tests/fixtures/cv', name), 'utf8');

describe('CV parse scenarios', () => {
  it('handles a graduate engineering CV with project and skill signals', async () => {
    const raw = await loadFixture('graduate-software-engineer.txt');
    const sections = extractCvSections(raw);
    expect(sections.map((item) => item.key)).toEqual(expect.arrayContaining(['education', 'projects', 'skills']));

    const signals = buildCvSignals({
      skills: ['Java', 'SQL', 'React', 'Node.js'],
      projects: [{ title: 'Capstone backend API' }],
      achievements: ['Reduced manual effort by 30%'],
    });
    expect(signals.roleSignals).toEqual(expect.arrayContaining(['web_engineering', 'backend_engineering']));
  });

  it('stays conservative on a transition CV while still surfacing evidence', async () => {
    const raw = await loadFixture('data-analyst-transition.txt');
    const sections = extractCvSections(raw);
    expect(sections.length).toBeGreaterThan(1);

    const evidence = normalizeCvEvidence({
      workHistory: raw.split('\n').filter(Boolean).slice(0, 10),
      achievements: ['Improved reporting efficiency by 25%'],
    });
    expect(evidence.quantifiedEvidence.join(' ')).toMatch(/25%|improved/i);
  });
});
