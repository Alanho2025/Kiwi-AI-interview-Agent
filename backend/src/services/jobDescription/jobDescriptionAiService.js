/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Ask the LLM for extra skill and requirement hints without making it the primary parser.
 */

import { callDeepSeek } from '../deepseekService.js';
import { safeJsonParse } from './jobDescriptionShared.js';

export const extractSkillsWithAI = async (rawJD) => {
  try {
    const prompt = `You are a strict job-description parser for IT roles. Extract only what is explicitly stated.
Return JSON only with this schema:
{
  "technicalSkills": string[],
  "softSkills": string[],
  "macroCriteria": string[],
  "requirements": string[]
}
Technical skills may include software development, data, AI/ML, IT infrastructure, and common engineering skills.
Job description:\n${rawJD.slice(0, 5000)}`;
    const response = await callDeepSeek(prompt, 'Return valid JSON only. No prose.');
    const parsed = safeJsonParse(response);
    return {
      technicalSkillRequirements: Array.isArray(parsed.technicalSkills) ? parsed.technicalSkills : [],
      softSkillRequirements: Array.isArray(parsed.softSkills) ? parsed.softSkills : [],
      macroCriteria: Array.isArray(parsed.macroCriteria) ? parsed.macroCriteria : [],
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
    };
  } catch (error) {
    console.warn('AI skill extraction failed:', error.message);
    return { technicalSkillRequirements: [], softSkillRequirements: [], macroCriteria: [], requirements: [] };
  }
};
