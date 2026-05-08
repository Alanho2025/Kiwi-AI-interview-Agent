import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildCvProfile } from '../../../src/services/cv/cvProfileBuilderService.js';
import { buildNormalizedCvProfile } from '../../../src/services/cv/cvProfileContractBuilder.js';
import { buildReviewedCvProfile } from '../../../src/services/cv/cvReviewedProfileService.js';
import { extractCvSections } from '../../../src/services/cv/cvSectionParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureRoot = path.resolve(__dirname, '../../fixtures/cv');
const loadCv = (name) => fs.readFile(path.join(fixtureRoot, name), 'utf8');
const skillLabels = (profile) => profile.skills.map((item) => String(item.label || item).toLowerCase());

describe('CV parsing robustness', () => {
  it('extracts stable evidence from a project-heavy graduate CV without losing quantified achievements', async () => {
    const profile = buildCvProfile(await loadCv('graduate-software-engineer.txt'));
    const skills = skillLabels(profile);

    expect(profile.candidateName).toBe('Alex Chen');
    expect(skills).toEqual(expect.arrayContaining(['sql', 'git', 'javascript', 'azure', 'testing']));
    expect(profile.sections.map((section) => section.key)).toEqual(expect.arrayContaining(['summary', 'skills', 'projects', 'experience', 'education']));
    expect(profile.evidenceProfile.quantifiedEvidence.join(' ')).toMatch(/50%/);
    expect(profile.cvAnalysis.candidateIntro).toMatch(/Main direction/i);
    expect(profile.cvAnalysis.strongestEvidence.length).toBeGreaterThan(0);
    expect(profile.cvAnalysis.suggestedInterviewHooks).toEqual(expect.arrayContaining(['self introduction and career direction']));
    expect(profile.warnings).not.toEqual(expect.arrayContaining([expect.stringMatching(/No clear experience/i)]));
  });

  it('does not fail when a student CV has no experience section and keeps project evidence visible', async () => {
    const profile = buildCvProfile(await loadCv('frontend-student.txt'));
    const skills = skillLabels(profile);

    expect(profile.candidateName).toBe('Taylor Smith');
    expect(skills).toEqual(expect.arrayContaining(['react', 'javascript', 'html', 'css', 'git']));
    expect(profile.projects).toMatch(/Campus Events App/i);
    expect(profile.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/No clear experience section/i)]));
  });

  it('treats heading-free single-block CV text conservatively instead of hallucinating sections', () => {
    const sections = extractCvSections('Built a food recommendation API for students and improved response times by 40%.');

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('header');
    expect(sections[0].content).toMatch(/food recommendation API/i);
  });

  it('normalizes mixed project and work evidence into separate downstream fields', () => {
    const normalized = buildNormalizedCvProfile({
      candidateName: 'Mia Wong',
      skills: [{ label: 'Python' }, { label: 'SQL' }, { label: 'Power BI' }],
      projects: [{ title: 'Reporting Prototype', description: 'Built a Python and SQL dashboard prototype' }],
      workHistory: [{ role: 'Operations Analyst', company: 'HealthOps NZ', responsibilities: 'Built weekly SQL reports and reduced reconciliation by 35%' }],
      achievements: ['Reduced manual reconciliation by 35%'],
    });

    expect(normalized.projects[0].title).toBe('Reporting Prototype');
    expect(normalized.workHistory[0].title).toBe('Operations Analyst');
    expect(normalized.evidenceProfile.quantifiedEvidence.join(' ')).toMatch(/35%/);
    expect(normalized.skills).toEqual(expect.arrayContaining(['Python', 'SQL']));
  });

  it('turns human-reviewed CV fields into downstream matching evidence', () => {
    const reviewedProfile = buildReviewedCvProfile({
      baseProfile: { candidateName: 'Alan Ho', sections: [], confidence: 0.48 },
      reviewProfile: {
        candidateSummary: 'Graduate developer with React and data project experience.',
        coreSkills: ['React', 'Node.js', 'Python'],
        experienceEvidence: 'Delivered customer support workflows and automated reporting.',
        projectEvidence: 'Built a React interview dashboard with Node.js APIs.',
        educationCredentials: 'Bachelor of Computer Science.',
        keyCompetencies: ['Communication', 'Troubleshooting'],
      },
      reviewedAt: '2026-05-08T00:00:00.000Z',
    });

    expect(reviewedProfile.summary).toMatch(/Graduate developer/i);
    expect(reviewedProfile.skills.map((item) => item.label)).toEqual(['React', 'Node.js', 'Python']);
    expect(reviewedProfile.sections.map((section) => section.key)).toEqual(expect.arrayContaining(['experience', 'projects', 'education', 'key_competencies']));
    expect(reviewedProfile.evidenceProfile.sections.projects[0].rawText).toMatch(/React interview dashboard/i);
    expect(reviewedProfile.evidenceProfile.hardSkills).toEqual(expect.arrayContaining(['React', 'Node.js', 'Python']));
    expect(reviewedProfile.cvAnalysis.careerDirection).toMatch(/Data|AI|software/i);
    expect(reviewedProfile.cvAnalysis.strongestEvidence.map((item) => item.text).join(' ')).toMatch(/React interview dashboard/i);
    expect(reviewedProfile.metadata.humanReviewStatus).toBe('verified');
  });
});
