import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { buildGuardedStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/guardedJobDescriptionService.js';

const rawJuniorDataEngineerJD = `We are seeking a Junior Data Engineer to join our team.

Location: On-site in Henderson, Auckland, New Zealand
Relocation assistance (for the right candidate, if needed)
Full time position - 40 hours a week

The position includes the following duties:

Building and maintaining data pipelines and systems

Contribute to the development of a long-term data strategy

Create scripts and queries to fulfil various data needs

We are seeking someone with:

6 months experience in data or software engineering roles

Proficiency in Python and SQL or similar languages

Experience with Linux or command-line tools

Experience with our game, Path of Exile, or similar games

A drive for problem solving

Pluses:

Experience with tools like Elasticsearch, Kibana, Grafana, version control

Understanding of other programming languages, especially C++`;

describe('JD parse agentic safeguard robustness', () => {
  const previousSafeguardFlag = process.env.ENABLE_AGENTIC_SAFEGUARDS;
  const previousAiMode = process.env.AI_TEST_MODE;

  beforeEach(() => {
    process.env.ENABLE_AGENTIC_SAFEGUARDS = 'true';
    process.env.AI_TEST_MODE = 'mock';
  });

  afterEach(() => {
    process.env.ENABLE_AGENTIC_SAFEGUARDS = previousSafeguardFlag;
    process.env.AI_TEST_MODE = previousAiMode;
  });

  it('re-runs the parser after safeguard detects Seek-style field misclassification', async () => {
    const result = await buildGuardedStructuredJobDescriptionRubric(rawJuniorDataEngineerJD);

    expect(result.safeguard.parseAttempts).toBeGreaterThanOrEqual(1);
    expect(result.jobOverview.companyName || '').not.toMatch(/6 months experience/i);

    expect(result.sections.responsibilities).toEqual([
      'Building and maintaining data pipelines and systems',
      'Contribute to the development of a long-term data strategy',
      'Create scripts and queries to fulfil various data needs',
    ]);

    expect(result.sections.mustHaveRequirements).toContain('Proficiency in Python and SQL or similar languages');
    expect(result.sections.mustHaveRequirements).toContain('Experience with Linux or command-line tools');
    expect(result.sections.mustHaveRequirements).toContain('Experience with Path of Exile or similar games');

    expect(result.sections.niceToHaveRequirements).toContain('Experience with tools like Elasticsearch, Kibana, Grafana, version control');
    expect(result.sections.niceToHaveRequirements).toContain('Understanding of other programming languages, especially C++');
    expect(result.sections.mustHaveRequirements.join(' ')).not.toMatch(/Elasticsearch|Kibana|Grafana|C\+\+/i);
    expect(result.safeguard.blockMatch).toBe(false);
  });
});
