/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Ask the LLM for extra skill and requirement hints without making it the primary parser.
 */

import { callDeepSeek } from '../deepseekService.js';
import { safeJsonParse } from './jobDescriptionShared.js';
import { getJdAiSkillEnhancementTimeoutMs } from './jdSafeguardAiBudget.js';

export const emptyAiSkillBundle = () => ({
  technicalSkillRequirements: [],
  softSkillRequirements: [],
  macroCriteria: [],
  requirements: [],
});

export const extractSkillsWithAI = async (rawJD, { disabled = false } = {}) => {
  if (disabled || process.env.DISABLE_AI_JD_ENHANCEMENT === 'true' || !process.env.DEEPSEEK_API_KEY) {
    return emptyAiSkillBundle();
  }

  try {
    const prompt = `You are a strict, domain-agnostic job description parser. Extract only what is explicitly stated in the job description across any professional domain (including IT/software, data/AI, engineering, product/project management, operations, finance, marketing, etc.).
Return JSON only with this schema:
{
  "technicalSkills": string[],
  "softSkills": string[],
  "macroCriteria": string[],
  "requirements": string[]
}
Domain skills may include technical tools, software, methodologies, domain knowledge, certifications, and specialized practices.
Job description:\n${rawJD.slice(0, 5000)}`;
    const { content: response } = await callDeepSeek(prompt, 'Return valid JSON only. No prose.', {
      usageMetadata: { stage: 'jd_parse', operation: 'llm_chat', feature: 'jd_skill_extraction' },
      timeoutMs: getJdAiSkillEnhancementTimeoutMs(),
    });
    const parsed = safeJsonParse(response);

    return {
      technicalSkillRequirements: Array.isArray(parsed.technicalSkills) ? parsed.technicalSkills : [],
      softSkillRequirements: Array.isArray(parsed.softSkills) ? parsed.softSkills : [],
      macroCriteria: Array.isArray(parsed.macroCriteria) ? parsed.macroCriteria : [],
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
    };
  } catch (error) {
    console.warn('AI skill extraction failed:', error.message);
    return emptyAiSkillBundle();
  }
};
