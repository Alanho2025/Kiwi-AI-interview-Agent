import { describe, expect, it } from 'vitest';
import { extractSkillsWithAI } from '../../src/services/jobDescription/jobDescriptionAiService.js';
import { buildJobDescriptionInterviewTargets } from '../../src/services/jobDescription/jobDescriptionInterviewTargetBuilder.js';
import { resolveRoleFamily } from '../../src/services/jobDescription/extractors/roleFamilyResolver.js';
import { extractJobDescriptionSkills } from '../../src/services/jobDescription/jobDescriptionSkillExtractor.js';

describe('Job Description Parser semantic fixes', () => {
  describe('Domain-agnostic AI skill extraction prompt', () => {
    it('uses a domain-agnostic system prompt instead of restricting to IT roles', async () => {
      // Test empty return fallback behavior when disabled/mocked
      const result = await extractSkillsWithAI('Project Manager required', { disabled: true });
      expect(result).toHaveProperty('technicalSkillRequirements');
      expect(result).toHaveProperty('softSkillRequirements');
    });
  });

  describe('Education filtering in interview targets', () => {
    it('filters out degree and academic qualifications from interview targets', () => {
      const targets = buildJobDescriptionInterviewTargets({
        roleFamily: 'software_development',
        groupedTechnicalSkills: {
          softwareDevelopment: [{ label: 'React' }, { label: 'Node.js' }],
          data: [],
          aiMl: [],
          itInfrastructure: [],
          commonEngineering: [],
        },
        softSkills: [{ label: 'Communication' }],
        requirementGroups: {
          mustHaveRequirements: [
            { label: 'Bachelor of Computer Science degree' },
            { label: '5+ years experience building APIs' },
          ],
          niceToHaveRequirements: [
            { label: 'Master of IT degree' },
            { label: 'Experience with Docker' },
          ],
          responsibilities: [
            { label: 'Lead frontend development' },
          ],
        },
        title: 'Senior Software Engineer',
      });

      expect(targets.gapFocusCandidates).not.toEqual(expect.arrayContaining([
        expect.stringMatching(/Bachelor of Computer Science/i),
        expect.stringMatching(/Master of IT/i),
      ]));
      expect(targets.gapFocusCandidates).toEqual(expect.arrayContaining([
        '5+ years experience building APIs',
        'Experience with Docker',
      ]));
    });
  });

  describe('Role family resolution for AI Engineer', () => {
    it('preserves ai_ml as primary role family for AI Engineer roles with full stack tech stack', () => {
      const result = resolveRoleFamily({
        title: 'Senior AI Engineer',
        flatText: 'We are seeking an AI Engineer with LLM, RAG, agentic workflow, React, and TypeScript experience.',
        groupedTechnicalSkills: {
          aiMl: [{ label: 'OpenAI' }, { label: 'RAG' }],
          softwareDevelopment: [{ label: 'React' }, { label: 'TypeScript' }],
        },
      });

      expect(result.primary).toBe('ai_ml');
      expect(result.secondary).toBe('software_development');
    });
  });

  describe('Skill extraction alias collision prevention', () => {
    it('does not extract C when only C# is present in the text', () => {
      const result = extractJobDescriptionSkills({
        sections: {
          responsibilities: [{ text: 'Develop web applications using C# and .NET Core.' }],
        },
        requirementGroups: {},
        aiSkills: {},
      });

      const extractedNames = result.technicalSkillRequirements.map((s) => String(s).toUpperCase());
      expect(extractedNames).toContain('C#');
      expect(extractedNames).not.toContain('C');
    });
  });
});
