import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildCvProfile } from '../../../src/services/cv/cvProfileBuilderService.js';
import { buildCvEvidenceProfile } from '../../../src/services/cv/cvEvidenceProfileBuilder.js';
import { buildStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import {
  buildRequirementChecks,
  calculateScoreBreakdown,
  computeRequirementStatus,
} from '../../../src/services/match/matchScoringService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cvFixturePath = path.resolve(__dirname, '../../fixtures/cv/alan-ho-cv.txt');
const seekCorpusDir = path.resolve(__dirname, '../../fixtures/jobDescription/seek_indeed_corpus');
const bigTechCorpusDir = path.resolve(__dirname, '../../fixtures/jobDescription/bigtech_big4_corpus');

const loadAlanHoCvText = () => fs.readFile(cvFixturePath, 'utf8');
const loadSeekJd = (filename) => fs.readFile(path.join(seekCorpusDir, filename), 'utf8');
const loadBigTechJd = (filename) => fs.readFile(path.join(bigTechCorpusDir, filename), 'utf8');

describe('ATS CV-JD Role Fit Matching Benchmark Suite (Alan Ho Real CV vs 30 Real JDs)', () => {
  it('ATS Disjunctive OR Rule: Satisfying 1 option (Python) in "Java or C# or Python" grants valid match credit (not_met eliminated)', async () => {
    const alanCvText = await loadAlanHoCvText();
    const cvProfile = buildCvProfile(alanCvText);
    const evidenceProfile = buildCvEvidenceProfile(cvProfile, alanCvText);

    const disjunctiveReq = {
      id: 'req-disjunctive-or',
      label: 'Proficiency in Java or C# or Python for backend service development',
      mustHave: true,
      type: 'hard',
      category: 'technical_skill',
    };

    const statusResult = computeRequirementStatus(disjunctiveReq, evidenceProfile, {});

    // ATS Rule: Satisfying ANY 1 disjunctive option grants valid match credit (status is met or partial, NOT not_met)
    expect(statusResult.finalStatus).not.toBe('not_met');
    expect(statusResult.combinedSignal).toBeGreaterThan(0);
  });

  it('Match Benchmark 1: Senior Frontend Developer (Pushpay) -> Qualified ATS Match (> 60%)', async () => {
    const alanCvText = await loadAlanHoCvText();
    const cvProfile = buildCvProfile(alanCvText);
    const evidenceProfile = buildCvEvidenceProfile(cvProfile, alanCvText);

    const rawJD = await loadSeekJd('indeed-01-frontend-developer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    const checks = buildRequirementChecks(rubric.requirements, alanCvText, evidenceProfile, {});
    const breakdown = calculateScoreBreakdown({ rubric, macroScores: [], microScores: [], requirementChecks: checks });

    expect(breakdown.overallScore).toBeGreaterThanOrEqual(60);
    const reactCheck = checks.find((c) => /react/i.test(c.label));
    expect(reactCheck?.status).not.toBe('not_met');
  });

  it('Match Benchmark 2: AI Solutions Engineer (Canva) -> Mid-High ATS Match (> 60%)', async () => {
    const alanCvText = await loadAlanHoCvText();
    const cvProfile = buildCvProfile(alanCvText);
    const evidenceProfile = buildCvEvidenceProfile(cvProfile, alanCvText);

    const rawJD = await loadSeekJd('seek-03-ai-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    const checks = buildRequirementChecks(rubric.requirements, alanCvText, evidenceProfile, {});
    const breakdown = calculateScoreBreakdown({ rubric, macroScores: [], microScores: [], requirementChecks: checks });

    expect(breakdown.overallScore).toBeGreaterThanOrEqual(60);
    const pythonCheck = checks.find((c) => /python/i.test(c.label));
    expect(pythonCheck?.status).not.toBe('not_met');
  });

  it('Match Benchmark 3: Google Software Engineer III AI Infrastructure -> Solid Technical Match (> 50%)', async () => {
    const alanCvText = await loadAlanHoCvText();
    const cvProfile = buildCvProfile(alanCvText);
    const evidenceProfile = buildCvEvidenceProfile(cvProfile, alanCvText);

    const rawJD = await loadBigTechJd('google-01-software-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    const checks = buildRequirementChecks(rubric.requirements, alanCvText, evidenceProfile, {});
    const breakdown = calculateScoreBreakdown({ rubric, macroScores: [], microScores: [], requirementChecks: checks });

    expect(breakdown.overallScore).toBeGreaterThanOrEqual(50);
    // Python requirement MUST NOT be not_met
    const pythonCheck = checks.find((c) => /python/i.test(c.label));
    expect(pythonCheck?.status).not.toBe('not_met');
  });

  it('Match Benchmark 4: Retail Store Manager (Farmers) -> Non-Technical Role Score Cap (<= 68%)', async () => {
    const alanCvText = await loadAlanHoCvText();
    const cvProfile = buildCvProfile(alanCvText);
    const evidenceProfile = buildCvEvidenceProfile(cvProfile, alanCvText);

    const rawJD = await loadSeekJd('seek-10-store-manager.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD, { skipAiSkillEnhancement: true });

    const checks = buildRequirementChecks(rubric.requirements, alanCvText, evidenceProfile, {});
    const breakdown = calculateScoreBreakdown({ rubric, macroScores: [], microScores: [], requirementChecks: checks });

    // ATS Mismatch: Engineering candidate applying for retail store manager gets soft leadership credit but fails domain fit
    expect(breakdown.overallScore).toBeLessThanOrEqual(68);
  });
});
