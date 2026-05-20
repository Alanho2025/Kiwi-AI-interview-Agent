import { describe, expect, it } from 'vitest';

import { compareCvToJobDescription } from '../../../src/services/matchService.js';

const buildRubric = (requirements = []) => ({
  schemaVersion: 'v3',
  title: 'Software Engineer',
  jobTitle: 'Software Engineer',
  roleSummary: ['Build production software.'],
  responsibilities: [],
  qualifications: [],
  keywords: requirements.map((item) => item.label),
  macroCriteria: [{ label: 'technical expertise', weight: 1 }],
  microCriteria: requirements.map((item) => ({ label: item.label, weight: 1 })),
  requirements,
  weights: {
    macro: { technical_expertise: 1 },
    micro: Object.fromEntries(requirements.map((item) => [item.label, 1])),
    overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
  },
  technicalSkillRequirements: requirements.map((item) => item.label),
  softSkillRequirements: [],
  mustHaveRequirements: requirements.filter((item) => item.type === 'hard').map((item) => item.label),
  niceToHaveExperience: [],
});

describe('semantic evidence match robustness', () => {
  it('does not treat skills-list-only hard requirements as fully met', async () => {
    const cvText = `Mina Patel
Software Developer

Skills
Python
SQL`;
    const rubric = buildRubric([
      { label: 'Python', type: 'hard', importance: 'high' },
      { label: 'SQL', type: 'hard', importance: 'high' },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Software Engineer JD', rubric);
    const statuses = Object.fromEntries(result.requirementChecks.map((item) => [item.label, item.status]));

    expect(statuses.Python).not.toBe('met');
    expect(statuses.SQL).not.toBe('met');
    expect(result.requirementChecks.map((item) => item.notes).join(' ')).toMatch(/skills-list evidence only/i);
    expect(result.riskFlags.join(' ')).toMatch(/validate applied/i);
  });

  it('uses project evidence and semantic aliases for API development requirements', async () => {
    const cvText = `Ari Wong
Backend Developer

Projects
Developer Portal
- Built REST endpoints for booking workflows with Node.js and PostgreSQL.
- Added integration tests for endpoint behaviour.`;
    const rubric = buildRubric([
      { label: 'API development', type: 'hard', importance: 'high' },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Backend API JD', rubric);
    const requirement = result.requirementChecks.find((item) => item.label === 'API development');

    expect(['met', 'partial']).toContain(requirement.status);
    expect(requirement.notes).toMatch(/evidenceStrength=strong/i);
    expect(result.matchingDetails.semanticEvidenceMatches.find((item) => item.label === 'API development')?.matches[0]?.text)
      .toMatch(/REST endpoints/i);
  });

  it('does not upgrade project-only evidence into full commercial-years proof', async () => {
    const cvText = `Leo Tan
Graduate Developer

Projects
Roster API
- Built Python APIs for a student scheduling prototype.`;
    const rubric = buildRubric([
      { label: '2 years commercial experience with Python APIs', type: 'hard', importance: 'high' },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Commercial Python API JD', rubric);
    const requirement = result.requirementChecks[0];

    expect(requirement.status).not.toBe('met');
    expect(requirement.notes).toMatch(/commercial|limited direct proof|project/i);
  });
});
