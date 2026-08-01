import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/jobDescriptionRubricBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const corpusDir = path.resolve(__dirname, '../../fixtures/jobDescription/bigtech_big4_corpus');

const loadCorpusFile = (filename) => fs.readFile(path.join(corpusDir, filename), 'utf8');

const ACADEMIC_DEGREE_PATTERN = /\b(degree|bachelor'?s?|master'?s?|phd|doctorate|diploma|gpa|university|tertiary|academic qualification)\b/i;

describe('Big Tech & Big 4 Official Career Portal JD Test Suite (10 Real Postings)', () => {
  it('[GOOGLE] Software Engineer III, AI Infrastructure (Google)', async () => {
    const rawJD = await loadCorpusFile('google-01-software-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Software Engineer/i);
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Java', 'Python', 'PyTorch', 'TensorFlow', 'CUDA', 'Vector Search']));

    // Verify degree filter: Minimum qualifications (BS/MS/PhD) MUST NOT leak into interview targets
    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
    expect(rubric.interviewTargets.experienceFocus.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[APPLE] Senior Machine Learning Engineer (Apple Vision Pro)', async () => {
    const rawJD = await loadCorpusFile('apple-02-ml-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Senior Machine Learning Engineer/i);
    expect(rubric.roleFamily).toBe('ai_ml');
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Python', 'PyTorch', 'Machine Learning', 'Deep Learning']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[EY] Senior Manager - Technology Consulting & Cloud Advisory (EY)', async () => {
    const rawJD = await loadCorpusFile('ey-03-tech-consulting-manager.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Senior Manager/i);
    expect(rubric.jobOverview.companyName).toMatch(/EY|Ernst/i);
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['AWS', 'Azure', 'Cloud Infrastructure']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[DELOITTE] Senior Consultant - SAP S/4HANA Digital Transformation (Deloitte)', async () => {
    const rawJD = await loadCorpusFile('deloitte-04-sap-consultant.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Senior Consultant/i);
    expect(rubric.jobOverview.companyName).toMatch(/Deloitte/i);

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[PWC] Manager - Cybersecurity & Digital Trust (PwC)', async () => {
    const rawJD = await loadCorpusFile('pwc-05-cybersecurity-manager.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Manager/i);
    expect(rubric.jobOverview.companyName).toMatch(/PwC/i);
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['AWS', 'Azure', 'Cybersecurity', 'Access Control', 'Firewalls']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[KPMG] Senior Data Analytics Consultant (KPMG Lighthouse)', async () => {
    const rawJD = await loadCorpusFile('kpmg-06-data-analytics-consultant.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Senior Data Analytics Consultant/i);
    expect(rubric.jobOverview.companyName).toMatch(/KPMG/i);
    expect(rubric.roleFamily).toBe('data');
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['SQL', 'Python', 'Power BI', 'Tableau', 'Snowflake', 'Statistics']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[MICROSOFT] Principal Software Engineering Manager - Azure AI (Microsoft)', async () => {
    const rawJD = await loadCorpusFile('microsoft-07-principal-engineering-manager.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Principal Software Engineering Manager/i);
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['C#', 'Java', 'Kubernetes', 'Azure', 'Microservices']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[AMAZON] Senior Solutions Architect - Enterprise Cloud (AWS)', async () => {
    const rawJD = await loadCorpusFile('amazon-08-solutions-architect.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Senior Solutions Architect/i);
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['AWS', 'Linux', 'Python', 'Terraform', 'Docker', 'Serverless']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[ACCENTURE] Cloud & DevOps Delivery Manager (Accenture Cloud First)', async () => {
    const rawJD = await loadCorpusFile('accenture-09-devops-delivery-manager.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Cloud & DevOps Delivery Manager/i);
    expect(rubric.jobOverview.companyName).toMatch(/Accenture/i);
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['AWS', 'Azure', 'GCP', 'Kubernetes', 'Ansible', 'Agile', 'CI/CD']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });

  it('[META] Staff Product Designer - Design Systems (Meta)', async () => {
    const rawJD = await loadCorpusFile('meta-10-staff-product-designer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    expect(rubric.jobOverview.title).toMatch(/Staff Product Designer/i);
    expect(rubric.technicalSkillRequirements).toEqual(expect.arrayContaining(['Figma', 'HTML', 'CSS', 'React']));

    expect(rubric.interviewTargets.gapFocusCandidates.join(' ')).not.toMatch(ACADEMIC_DEGREE_PATTERN);
  });
});
