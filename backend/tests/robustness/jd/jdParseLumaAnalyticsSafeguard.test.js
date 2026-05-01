import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({
    technicalSkills: [],
    softSkills: [],
    confidence: 0.5,
  })),
}));

import { buildGuardedStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/guardedJobDescriptionService.js';

const rawJD = `About us
Luma Analytics is one of New Zealand’s fastest-growing analytics consulting firms, recognised in the Deloitte Fast 50.

About the role
As a Data Engineer at Luma Analytics, you’ll be building the foundations that power modern analytics and AI solutions.

What you’ll be doing
Designing and building modern data platforms and pipelines to support advanced analytics and AI use cases.

Developing scalable data models and architectures that enable high-performance analytics.

Working with cloud-native technologies and platforms (e.g. Databricks, Azure, AWS, GCP) to deliver robust, production-grade solutions.

Embedding AI and machine learning capabilities into data pipelines and workflows.

Contributing to CI/CD pipelines and infrastructure automation using Infrastructure as Code.

What we’re looking for
2–5 years’ experience in a Data Engineering or related role.

A relevant qualification in Computer Science, Engineering, or a related field.

Experience building data pipelines and working with modern data processing frameworks (e.g. Spark, Kafka).

Strong SQL skills and experience with modern data platforms (e.g. Snowflake, Databricks, Redshift, PostgreSQL).

Experience with cloud platforms such as AWS, Azure, or GCP.

Familiarity with DevOps practices, version control (e.g. Git), and CI/CD pipelines.

What we offer
We offer competitive remuneration, flexible working arrangements, and a range of wellbeing initiatives to support work-life balance.

Employer questions
What's your expected annual base salary?`;

describe('Luma Analytics JD safeguard regression', () => {
  beforeEach(() => {
    process.env.ENABLE_AGENTIC_SAFEGUARDS = 'true';
    process.env.AI_TEST_MODE = 'mock';
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('reparses Seek-style consulting data engineer JD without field drift', async () => {
    const result = await buildGuardedStructuredJobDescriptionRubric(rawJD);

    expect(result.jobOverview.title).toBe('Data Engineer');
    expect(result.jobOverview.companyName).toBe('Luma Analytics');
    expect(result.sections.responsibilities).toContain('Working with cloud-native technologies and platforms (e.g. Databricks, Azure, AWS, GCP) to deliver robust, production-grade solutions.');
    expect(result.sections.mustHaveRequirements).toContain('Experience building data pipelines and working with modern data processing frameworks (e.g. Spark, Kafka).');
    expect(result.sections.mustHaveRequirements).toContain('Strong SQL skills and experience with modern data platforms (e.g. Snowflake, Databricks, Redshift, PostgreSQL).');
    expect(result.sections.mustHaveRequirements.join(' ')).not.toMatch(/\(e\.g$/i);
    expect(result.sections.responsibilities.join(' ')).not.toMatch(/\bAND\b|\bTO\b|\bTHE\b/);
    expect(result.safeguard.parseAttempts).toBe(2);
    expect(result.safeguard.finalStatus).toBe('accepted_after_reparse');
  });
});
