import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildRoleFitProfile } from '../../../src/services/jobDescription/roleFitProfileBuilder.js';
import { buildStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/jobDescriptionRubricBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const corpusDir = path.resolve(__dirname, '../../fixtures/jobDescription/seek_indeed_corpus');

const loadCorpusFile = (filename) => fs.readFile(path.join(corpusDir, filename), 'utf8');

const ACADEMIC_DEGREE_PATTERN = /\b(degree|bachelor'?s?|master'?s?|phd|doctorate|diploma|gpa|university|tertiary|academic qualification)\b/i;

const JD_POLLUTION_PATTERN =
  /\b(apply now|additional information|click here to apply|submit your application|save job|share this job)\b/i;

const collectRequirementLikeText = (rubric = {}) => [
  ...(rubric.sections?.responsibilities || []),
  ...(rubric.sections?.mustHaveRequirements || []),
  ...(rubric.sections?.niceToHaveRequirements || []),
  ...(rubric.sections?.qualifications || []),
  ...(rubric.sections?.softSkills || []),
  ...(rubric.requirements || []).map((item) => item.label || item.text || ''),
  ...(rubric.interviewTargets?.gapFocusCandidates || []),
  ...(rubric.interviewTargets?.experienceFocus || []),
].join('\n');

const expectNoJdPollution = (rubric) => {
  expect(collectRequirementLikeText(rubric)).not.toMatch(
    JD_POLLUTION_PATTERN
  );
};
describe('Seek & Indeed 20 JD Deterministic Parser Corpus Test Suite', () => {
  describe('SEEK Job Descriptions (10 Real Postings)', () => {
    it('[SEEK 1] Senior Software Engineer (Xero, Auckland)', async () => {
      const rawJD = await loadCorpusFile('seek-01-software-engineer.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Senior Software Engineer');
      expect(rubric.jobOverview.companyName).toMatch(/Xero/i);
      expect(rubric.jobOverview.location).toMatch(/Auckland/i);
      expect(rubric.roleFamily).toBe('software_development');
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS']));

      // Degree filter assertion: degrees must NOT leak into interview targets
      const targets = rubric.interviewTargets;
      expect(targets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
      expect(targets.experienceFocus.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 2] Senior Data Engineer (Fonterra, Hamilton)', async () => {
      const rawJD = await loadCorpusFile('seek-02-data-engineer.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Senior Data Engineer');
      expect(rubric.jobOverview.companyName).toMatch(/Fonterra/i);
      expect(rubric.jobOverview.location).toMatch(/Hamilton/i);
      expect(rubric.roleFamily).toBe('data');
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['SQL', 'Python', 'Snowflake', 'dbt', 'Power BI']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 3] AI Solutions Engineer (Canva, Auckland) - Preserves primary ai_ml role family', async () => {
      const rawJD = await loadCorpusFile('seek-03-ai-engineer.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('AI Solutions Engineer');
      // Verify primary roleFamily is ai_ml, NOT downgraded to software_development
      expect(rubric.roleFamily).toBe('ai_ml');
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Python', 'PyTorch', 'LLM', 'RAG', 'Vector Search', 'PostgreSQL']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 4] Lead DevOps Engineer (Datacom, Wellington)', async () => {
      const rawJD = await loadCorpusFile('seek-04-devops-engineer.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Lead DevOps Engineer');
      expect(rubric.jobOverview.companyName).toMatch(/Datacom/i);
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Terraform', 'Ansible', 'AWS', 'Kubernetes', 'Docker', 'Linux', 'Python']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 5] Senior Product Manager (Trade Me, Christchurch)', async () => {
      const rawJD = await loadCorpusFile('seek-05-product-manager.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Senior Product Manager');
      expect(rubric.jobOverview.companyName).toMatch(/Trade Me/i);
      expect(rubric.roleFamily).toBe('product');

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 6] Senior Business Analyst (Air New Zealand, Auckland)', async () => {
      const rawJD = await loadCorpusFile('seek-06-business-analyst.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Senior Business Analyst');
      expect(rubric.jobOverview.companyName).toMatch(/Air New Zealand/i);
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['SQL']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 7] Digital Marketing Specialist (Fisher & Paykel Healthcare, Auckland)', async () => {
      const rawJD = await loadCorpusFile('seek-07-marketing-specialist.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Digital Marketing Specialist');
      expect(rubric.jobOverview.companyName).toMatch(/Fisher & Paykel Healthcare/i);

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 8] Operations Coordinator (Mainfreight, Takanini)', async () => {
      const rawJD = await loadCorpusFile('seek-08-operations-coordinator.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Operations Coordinator');
      expect(rubric.jobOverview.companyName).toMatch(/Mainfreight/i);

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 9] Registered Nurse (Te Toka Tumai Auckland Health)', async () => {
      const rawJD = await loadCorpusFile('seek-09-registered-nurse.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Registered Nurse - Clinical Specialist');
      expect(rubric.jobOverview.companyName).toMatch(/Te Toka Tumai/i);

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[SEEK 10] Retail Store Manager (Farmers, Albany)', async () => {
      const rawJD = await loadCorpusFile('seek-10-store-manager.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Retail Store Manager');
      expect(rubric.jobOverview.companyName).toMatch(/Farmers/i);

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });
  });

  describe('INDEED Job Descriptions (10 Real Postings)', () => {
    it('[INDEED 1] Senior Frontend Developer (Pushpay, Auckland)', async () => {
      const rawJD = await loadCorpusFile('indeed-01-frontend-developer.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Senior Frontend Developer');
      expect(rubric.jobOverview.companyName).toMatch(/Pushpay/i);
      expect(rubric.roleFamily).toBe('software_development');
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['React', 'TypeScript', 'HTML', 'CSS', 'JavaScript', 'GraphQL']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 2] Lead Data Scientist (ASB Bank, Auckland)', async () => {
      const rawJD = await loadCorpusFile('indeed-02-data-scientist.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Lead Data Scientist');
      expect(rubric.roleFamily).toBe('data');
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Python', 'Scikit-Learn', 'XGBoost', 'PyTorch', 'SQL', 'PySpark', 'AWS']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 3] Machine Learning Engineer (Soul Machines, Auckland) - Preserves primary ai_ml role family', async () => {
      const rawJD = await loadCorpusFile('indeed-03-ml-engineer.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Machine Learning Engineer');
      expect(rubric.roleFamily).toBe('ai_ml');
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Docker', 'Kubernetes', 'MLflow', 'PyTorch', 'CUDA', 'Python']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 4] Senior Cloud Architect (Spark, Auckland)', async () => {
      const rawJD = await loadCorpusFile('indeed-04-cloud-architect.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Senior Cloud Architect');
      expect(rubric.jobOverview.companyName).toMatch(/Spark/i);
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['AWS', 'Azure', 'Terraform']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 5] IT Project Manager (Orion Health, Grafton)', async () => {
      const rawJD = await loadCorpusFile('indeed-05-project-manager.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('IT Project Manager');
      expect(rubric.jobOverview.companyName).toMatch(/Orion Health/i);
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Jira']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 6] Senior Financial Analyst (Genesis Energy, Auckland)', async () => {
      const rawJD = await loadCorpusFile('indeed-06-financial-analyst.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Senior Financial Analyst');
      expect(rubric.jobOverview.companyName).toMatch(/Genesis Energy/i);
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['SQL', 'Power BI', 'Excel']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 7] Content & Communications Manager (University of Auckland)', async () => {
      const rawJD = await loadCorpusFile('indeed-07-content-strategist.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Content & Communications Manager');
      expect(rubric.jobOverview.companyName).toMatch(/University of Auckland/i);

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 8] Customer Success Team Lead (Vend by Lightspeed)', async () => {
      const rawJD = await loadCorpusFile('indeed-08-customer-support-lead.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Customer Success Team Lead');
      expect(rubric.jobOverview.companyName).toMatch(/Vend/i);
      expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Zendesk', 'Salesforce']));

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 9] Clinical Research Coordinator (Fisher & Paykel Healthcare)', async () => {
      const rawJD = await loadCorpusFile('indeed-09-clinical-coordinator.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Clinical Research Coordinator');
      expect(rubric.jobOverview.companyName).toMatch(/Fisher & Paykel Healthcare/i);

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });

    it('[INDEED 10] Restaurant Operations Manager (Restaurant Brands NZ)', async () => {
      const rawJD = await loadCorpusFile('indeed-10-restaurant-operations-manager.txt');
      const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });
      expectNoJdPollution(rubric);
      expect(rubric.jobOverview.title).toBe('Restaurant Operations Manager');
      expect(rubric.jobOverview.companyName).toMatch(/Restaurant Brands/i);

      expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    });
    it('[INDEED 11] AI Engineer - excludes employer marketing and application copy from preparation targets', async () => {
      const rawJD = await loadCorpusFile(
        'indeed-11-warehouse-ai-engineer.txt'
      );

      const rubric = await buildStructuredJobDescriptionRubric(
        rawJD,
        { skipAiSkillEnhancement: true }
      );

      const requirementLikeText = [
        ...(rubric.sections?.responsibilities || []),
        ...(rubric.sections?.mustHaveRequirements || []),
        ...(rubric.sections?.niceToHaveRequirements || []),
        ...(rubric.sections?.qualifications || []),
        ...(rubric.sections?.softSkills || []),
        ...(rubric.requirements || []).map(
          (item) => item.label || item.text || ''
        ),
        ...(rubric.interviewTargets?.gapFocusCandidates || []),
        ...(rubric.interviewTargets?.experienceFocus || []),
      ].join('\n');

      expect.soft(rubric.jobOverview.title).toBe('AI Engineer');
      expect.soft(rubric.jobOverview.companyName).toMatch(
        /Warehouse Group/i
      );
      expect.soft(rubric.roleFamily).toBe('ai_ml');

      expect.soft(rubric.sections?.responsibilities?.length).toBeGreaterThan(0);
      const responsibilitiesText = (rubric.sections?.responsibilities || []).join('\n');
      expect.soft(responsibilitiesText).toMatch(/Building and maintaining data pipelines/i);
      expect.soft(responsibilitiesText).toMatch(/Translate business requirements/i);

      expect.soft(rubric.sections?.niceToHaveRequirements?.length).toBeGreaterThan(0);
      const niceToHaveText = (rubric.sections?.niceToHaveRequirements || []).join('\n');
      expect.soft(niceToHaveText).toMatch(/Cloud data platforms/i);
      expect.soft(niceToHaveText).toMatch(/Airflow/i);

      expect.soft(requirementLikeText).toMatch(/AI\/ML concepts/i);
      expect.soft(requirementLikeText).toMatch(/PowerPoint/i);
      expect.soft(requirementLikeText).toMatch(/ETL\/ELT/i);
      expect.soft(requirementLikeText).toMatch(/Azure.*AWS.*GCP/i);
      expect.soft(requirementLikeText).toMatch(/Git/i);

      expect.soft(requirementLikeText).not.toMatch(
        /^\s*[*#_]*additional information[*#_]*\s*$/im
      );
      expect.soft(requirementLikeText).not.toMatch(
        /apply now.*make an impact/i
      );
      expect.soft(requirementLikeText).not.toMatch(
        /intentional about finding the right people/i
      );
      expect.soft(requirementLikeText).not.toMatch(
        /be part of our journey to make sustainable living/i
      );

      const roleFitProfile = buildRoleFitProfile({
        rawJD,
        rubric,
      });

      const roleIntentText = (
        roleFitProfile.roleIntent?.items || []
      )
        .map((item) => item.statement)
        .join('\n');

      expect.soft(roleIntentText).not.toMatch(
        /^\s*[*#_]*additional information[*#_]*\s*$/im
        );
      expect.soft(roleIntentText).not.toMatch(
        /apply now.*make an impact/i
      );
      expect.soft(roleIntentText).not.toMatch(
        /intentional about finding the right people/i
      );
      expect.soft(roleIntentText).not.toMatch(
        /be part of our journey to make sustainable living/i
      );
    });
  });
});
