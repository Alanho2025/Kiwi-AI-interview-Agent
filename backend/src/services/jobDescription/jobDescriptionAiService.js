/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: jobDescriptionAiService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { callDeepSeek } from '../deepseekService.js';
import { safeJsonParse } from './jobDescriptionShared.js';

/**
 * Purpose: Execute the main responsibility for extractSkillsWithAI.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const extractSkillsWithAI = async (rawJD) => {
  try {
    const prompt = `You are a strict job-description parser. Extract only what is clearly stated. Return JSON only.\nSchema: {"technicalSkills": string[], "softSkills": string[], "macroCriteria": string[], "requirements": string[]}\nJob description:\n${rawJD.slice(0, 4000)}`;
    const response = await callDeepSeek(prompt, 'Return valid JSON only.');
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
