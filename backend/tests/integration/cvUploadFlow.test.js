import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { extractCvSections } from '../../src/services/cv/cvSectionParser.js';
import { buildNormalizedCvProfile } from '../../src/services/cv/cvProfileContractBuilder.js';

const loadFixture = async (name) => fs.readFile(path.resolve('tests/fixtures/cv', name), 'utf8');

describe('cv upload flow', () => {
  it('parses raw CV text into reusable normalized profile data', async () => {
    const raw = await loadFixture('cloud-platform-engineer.txt');
    const sections = extractCvSections(raw);

    const profile = buildNormalizedCvProfile({
      candidateName: 'Cloud Candidate',
      skills: ['AWS', 'Terraform', 'Python'],
      projects: [{ title: 'Cloud migration', description: 'Deployed workloads to AWS with Terraform' }],
      workHistory: [{ role: 'Cloud Engineer', responsibilities: 'Improved reliability by 20%' }],
      achievements: ['Improved reliability by 20%'],
    });

    expect(sections.length).toBeGreaterThan(1);
    expect(profile.skills).toEqual(expect.arrayContaining(['AWS', 'Terraform', 'Python']));
    expect(profile.evidenceProfile.quantifiedEvidence.join(' ')).toMatch(/20%/);
  });
});
