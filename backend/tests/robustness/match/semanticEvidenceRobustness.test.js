import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildUniversalRoleProfile } from '../../../src/services/jobDescription/jdUniversalParserService.js';
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
  const previousMatchEngine = process.env.MATCH_ENGINE;
  const previousAiTestMode = process.env.AI_TEST_MODE;

  beforeEach(() => {
    process.env.AI_TEST_MODE = 'mock';
  });

  afterEach(() => {
    if (previousMatchEngine === undefined) delete process.env.MATCH_ENGINE;
    else process.env.MATCH_ENGINE = previousMatchEngine;

    if (previousAiTestMode === undefined) delete process.env.AI_TEST_MODE;
    else process.env.AI_TEST_MODE = previousAiTestMode;
  });

  it('does not treat skills-list-only hard requirements as fully met or project-backed', async () => {
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
    const evidenceText = result.requirementChecks.flatMap((item) => item.evidence || []).join(' ');

    expect(statuses.Python).not.toBe('met');
    expect(statuses.SQL).not.toBe('met');
    expect(result.requirementChecks.map((item) => item.notes).join(' ')).toMatch(/skills-list evidence only/i);
    expect(evidenceText).not.toMatch(/Matched in projects/i);
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

  it('uses semantic engine dimensions and judgement notes for non-IT customer-service evidence', async () => {
    process.env.MATCH_ENGINE = 'semantic';
    const cvText = `Noah Lee
Retail Assistant

Experience
- Resolved customer issues during weekend retail shifts and escalated difficult cases to the store manager.
- Presented weekly stock updates to cross-functional team members.

Skills
Customer service
Communication`;
    const rubric = buildRubric([
      { label: 'Ability to handle customer complaints in a fast-paced environment', type: 'hard', importance: 'high' },
      { label: 'Strong written communication skills', type: 'soft', importance: 'high' },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Customer service JD', rubric, { matchEngine: 'semantic' });
    const complaintRequirement = result.requirementChecks.find((item) => /customer complaints/i.test(item.label));

    expect(['met', 'partial']).toContain(complaintRequirement.status);
    expect(complaintRequirement.notes).toMatch(/missingEvidence=|interviewProbe=/i);
    expect(result.matchingDetails.scoreDimensions).toMatchObject({
      mustHaveFit: expect.any(Number),
      responsibilityFit: expect.any(Number),
      skillAndToolFit: expect.any(Number),
      evidenceQuality: expect.any(Number),
      softSkillAndCultureFit: expect.any(Number),
    });
    expect(result.matchingDetails.universalRoleProfile.industry).toMatch(/customer service|general/i);
  });

  it('does not present generic one-token overlap as strong workflow evidence', async () => {
    process.env.MATCH_ENGINE = 'semantic';
    process.env.AI_TEST_MODE = 'mock';

    const cvText = `Alan Ho
NPI Engineer

Experience
- Worked as an engineer on product quality investigations.`;
    const rubric = buildRubric([
      {
        id: 'req_workflow_automation',
        label: 'Ability to deconstruct complex business workflows and re-engineer them for automation',
        category: 'workflow_automation',
        mustHave: true,
        type: 'hard',
        importance: 'high',
      },
    ]);

    const result = await compareCvToJobDescription(cvText, 'AI automation JD', rubric, { matchEngine: 'semantic' });
    const requirement = result.requirementChecks[0];
    const evidenceText = (requirement.evidence || []).join(' ');

    expect(requirement.status).toBe('not_met');
    expect(requirement.notes).toMatch(/evidenceStrength=missing/i);
    expect(requirement.notes).not.toMatch(/evidenceStrength=strong/i);
    expect(evidenceText).not.toMatch(/Matched in experience: engineer/i);
  });

  it('keeps direct qualification requirements gated when semantic evidence is only adjacent', async () => {
    process.env.MATCH_ENGINE = 'semantic';
    const cvText = `Sam Taylor
Healthcare Assistant

Experience
- Supported patients with appointment preparation and documented shift notes.

Skills
Patient care
Team communication`;
    const rubric = buildRubric([
      { label: 'Registered nurse qualification', type: 'hard', importance: 'high' },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Registered Nurse JD', rubric, { matchEngine: 'semantic' });
    const requirement = result.requirementChecks[0];

    expect(['not_met', 'partial']).toContain(requirement.status);
    expect(['not_qualified', 'manual_review']).toContain(result.decision.label);
    expect(requirement.notes).toMatch(/direct qualification|missingEvidence=|Registered nurse/i);
  });

  it('treats Master of Information Technology as meeting Lightspeed related degree requirement', async () => {
    process.env.MATCH_ENGINE = 'semantic';
    process.env.AI_TEST_MODE = 'mock';

    const cvText = `Alan Ho
Master of Information Technology student building full-stack AI products.

Education
Master of Information Technology, University of Auckland
Bachelor of Engineering`;
    const rubric = buildRubric([
      {
        id: 'req_degree',
        label: "Bachelor's degree or higher in Computer Science, Software Engineering, AI, Data Science, or related fields",
        category: 'qualification',
        mustHave: true,
        type: 'hard',
        importance: 'high',
        evidenceNeeded: "The CV should show direct education evidence for Bachelor's degree or higher in Computer Science, Software Engineering, AI, Data Science, or related fields.",
      },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Lightspeed AI Agent JD', rubric, { matchEngine: 'semantic' });
    const requirement = result.requirementChecks[0];

    expect(requirement.status).toBe('met');
    expect(requirement.notes).toMatch(/evidenceStrength=strong/i);
    expect(requirement.notes).toMatch(/direct education evidence/i);
    expect(requirement.notes).not.toMatch(/missingEvidence=/i);
    expect((requirement.evidence || []).join(' ')).toMatch(/Matched in education/i);
  });

  it('keeps related in-progress degree evidence visible instead of marking the requirement missing', async () => {
    process.env.MATCH_ENGINE = 'semantic';
    process.env.AI_TEST_MODE = 'mock';

    const cvText = `Alan Ho
Master of Information Technology student building AI products.

Education
Feb 2025 - Present Master of Information Technology, University of Auckland
Expected graduation: Nov 2026
Sep 2014 - Jun 2016 Master of Electrical Engineering, Chung Yuan Christian University`;
    const rubric = buildRubric([
      {
        id: 'req_recent_degree',
        label: 'Recent graduate with a degree in Data Science, Computer Science, Software Engineering, Engineering Science, or similar field',
        category: 'qualification',
        mustHave: true,
        type: 'hard',
        importance: 'high',
      },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Graduate Data JD', rubric, { matchEngine: 'semantic' });
    const requirement = result.requirementChecks[0];

    expect(requirement.status).not.toBe('not_met');
    expect((requirement.evidence || []).join(' ')).toMatch(/Matched in education/i);
  });

  it('treats PostgreSQL evidence as related SQL evidence for hard SQL requirements', async () => {
    process.env.MATCH_ENGINE = 'semantic';
    process.env.AI_TEST_MODE = 'mock';

    const cvText = `Alan Ho
Full-stack AI product developer.

Skills
PostgreSQL
Python

Projects
AI Interview Agent
- Built backend data flows using PostgreSQL and MongoDB.`;
    const rubric = buildRubric([
      {
        id: 'req_sql',
        label: 'Experience with SQL',
        category: 'technical_skill',
        mustHave: true,
        type: 'hard',
        importance: 'high',
      },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Graduate Data JD', rubric, { matchEngine: 'semantic' });
    const requirement = result.requirementChecks[0];

    expect(['partial', 'met']).toContain(requirement.status);
    expect(requirement.status).not.toBe('not_met');
    expect((requirement.evidence || []).join(' ')).toMatch(/sql|postgres/i);
  });

  it('does not use education evidence to satisfy non-qualification behavioural or role-context requirements', async () => {
    process.env.MATCH_ENGINE = 'semantic';
    const cvText = `Alan Ho
Master of Information Technology student

Education
Master of Information Technology, University of Auckland
Bachelor of Engineering`;
    const rubric = buildRubric([
      {
        label: 'Naturally curious, commercially aware, and capable of delivering features with autonomy',
        type: 'hard',
        importance: 'high',
      },
    ]);

    const result = await compareCvToJobDescription(cvText, 'Software Engineer JD', rubric, { matchEngine: 'semantic' });
    const requirement = result.requirementChecks[0];
    const evidenceText = (requirement.evidence || []).join(' ');

    expect(['not_met', 'partial']).toContain(requirement.status);
    expect(evidenceText).not.toMatch(/Matched in education/i);
    expect(requirement.notes).toMatch(/missingEvidence=|missing direct proof|limited direct proof/i);
  });

  it('normalises fallback universal JD requirements without turning company context into candidate requirements', async () => {
    process.env.MATCH_ENGINE = 'legacy';
    process.env.AI_TEST_MODE = 'mock';

    const roleProfile = await buildUniversalRoleProfile({
      rawJD: `About The Hiring Team
We are a fast-growing engineering team investing heavily in product quality.

Requirements
- Recent tertiary qualification in Computer Science or Software Engineering.
- Experience with AWS services.
- Strong written communication skills.`,
      rubric: {
        title: 'Graduate Software Engineer',
        roleFamily: 'Software Engineering',
        requirements: [
          {
            label: 'We are a fast-growing engineering team investing heavily in product quality.',
            category: 'company_context',
            importance: 'high',
            type: 'hard',
          },
          {
            label: 'Recent tertiary qualification in Computer Science or Software Engineering',
            importance: 'high',
            type: 'hard',
          },
          {
            label: 'Experience with AWS services',
            importance: 'high',
            type: 'hard',
          },
          {
            label: 'Strong written communication skills',
            importance: 'medium',
            type: 'soft',
          },
        ],
      },
    });

    expect(roleProfile.requirements.map((item) => item.text)).not.toEqual(
      expect.arrayContaining(['We are a fast-growing engineering team investing heavily in product quality.'])
    );
    expect(roleProfile.requirements.find((item) => /tertiary qualification/i.test(item.text))).toMatchObject({
      category: 'qualification',
      mustHave: true,
    });
    expect(roleProfile.requirements.find((item) => /AWS/i.test(item.text))).toMatchObject({
      category: 'experience',
      mustHave: true,
    });
    expect(roleProfile.requirements.find((item) => /communication/i.test(item.text))).toMatchObject({
      category: 'communication',
      mustHave: false,
    });
  });
});
