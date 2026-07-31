import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareCvToJobDescription } from '../../../src/services/matchService.js';
import { removeHtmlTags, normalizeWhitespace, normalizeBullets, validateText } from '../../../src/utils/textProcessing.js';

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
  roleFit: {
    companyContext: { status: 'ready' },
    review: { status: 'verified', version: 1 },
  },
});

describe('Jobsync Match Optimization - Tests & Edge Cases', () => {
  let previousAiTestMode;

  beforeEach(() => {
    previousAiTestMode = process.env.AI_TEST_MODE;
    process.env.AI_TEST_MODE = 'mock';
  });

  afterEach(() => {
    if (previousAiTestMode === undefined) delete process.env.AI_TEST_MODE;
    else process.env.AI_TEST_MODE = previousAiTestMode;
  });
  describe('Text Preprocessing Utilities', () => {
    it('removes HTML tags and maps list items to standard bullet format', () => {
      const htmlText = '<div><h1>Job Title</h1><ul><li>Python</li><li>React</li></ul><br>Details</div>';
      const cleaned = removeHtmlTags(htmlText);
      expect(cleaned).toContain('• Python');
      expect(cleaned).toContain('• React');
      expect(cleaned).not.toContain('<li>');
      expect(cleaned).not.toContain('<h1>');
    });

    it('normalizes whitespaces and multiple newlines', () => {
      const spacingText = 'Hello    World\n\n\n\nNew   Line\r\nTest';
      const cleaned = normalizeWhitespace(spacingText);
      expect(cleaned).toBe('Hello World\n\nNew Line\nTest');
    });

    it('unifies diverse bullet styles into a single bullet symbol •', () => {
      const bulletText = '● Python\n▪ React\n✓ Node\n- AWS\n* PostgreSQL';
      const cleaned = normalizeBullets(bulletText);
      expect(cleaned).toBe('• Python\n• React\n• Node\n• AWS\n• PostgreSQL');
    });

    it('validates text length and corruption correctly', () => {
      // Too short
      const tooShortResult = validateText('Too short', 200, 50000, 'CV');
      expect(tooShortResult.isValid).toBe(false);
      expect(tooShortResult.error.code).toBe('TOO_SHORT');

      // Valid text
      const validText = 'a'.repeat(250);
      const validResult = validateText(validText, 200, 50000, 'CV');
      expect(validResult.isValid).toBe(true);

      // Corrupted (too many consecutive special characters)
      const corruptedText = 'a'.repeat(210) + '!@#$%^&*()_+{}:"<>?~|-='.repeat(5);
      const corruptedResult = validateText(corruptedText, 200, 50000, 'CV');
      expect(corruptedResult.isValid).toBe(false);
      expect(corruptedResult.error.code).toBe('CORRUPTED');
    });
  });

  describe('Integrated Match Service Guards & Single Canonical Path', () => {
    const validCv = 'Mina Patel\nSoftware Developer\n' + 'Experience '.repeat(40) + '\nSkills: Python, SQL, React.';
    const validJd = 'Software Engineer Job description ' + 'Requirements '.repeat(40) + '\nMust have Python, SQL.';
    const rubric = buildRubric([
      { id: '1', label: 'Python', type: 'hard', importance: 'high' },
      { id: '2', label: 'SQL', type: 'hard', importance: 'high' },
    ]);

    it('fails when CV is too short (< 200 chars)', async () => {
      const shortCv = 'Too short CV';
      await expect(compareCvToJobDescription(shortCv, validJd, rubric, { enableLengthValidation: true }))
        .rejects.toThrow(/too short/i);
    });

    it('fails when JD is too short (< 200 chars)', async () => {
      const shortJd = 'Too short JD';
      await expect(compareCvToJobDescription(validCv, shortJd, rubric, { enableLengthValidation: true }))
        .rejects.toThrow(/too short/i);
    });

    it('fails when CV is corrupted (consecutive special characters)', async () => {
      const corruptCv = 'John Doe CV ' + '#'.repeat(25) + ' ' + 'experience '.repeat(30);
      await expect(compareCvToJobDescription(corruptCv, validJd, rubric, { enableLengthValidation: true }))
        .rejects.toThrow(/corrupted/i);
    });

    it('ignores the rejected legacy matchMode and still runs the canonical Match', async () => {
      const result = await compareCvToJobDescription(validCv, validJd, rubric, { matchMode: 'fast' });

      expect(result).toHaveProperty('matchScore');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('roleEvidenceMap');
      expect(result.matchingDetails.questionPlanHints).toBeDefined();
      expect(result).not.toHaveProperty('matchMode');
    });

    it('returns the canonical interview-preparation result without ATS tailoring fields', async () => {
      const result = await compareCvToJobDescription(validCv, validJd, rubric);

      expect(result).toHaveProperty('matchScore');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('roleEvidenceMap');
      expect(result.matchingDetails.questionPlanHints).toBeDefined();
      expect(result).not.toHaveProperty('atsKeywords');
      expect(result).not.toHaveProperty('tailoringTips');
      expect(result).not.toHaveProperty('matchMode');
    });
  });
});
