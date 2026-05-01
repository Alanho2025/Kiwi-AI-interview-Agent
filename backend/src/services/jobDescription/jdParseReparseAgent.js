/**
 * File responsibility: DeepSeek-guided JD reparse agent.
 * Main responsibilities:
 * - Build section overrides after a critic blocks the first JD parse.
 * - Keep the original parser/output schema in control by returning only safe section-level overrides.
 */

import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { ensureArray, isMockAiMode } from '../agenticSafeguards/safeguardShared.js';
import { extractSeekStyleSections } from './jdSafeguardHeuristics.js';

const normalizeOverrides = (value = {}) => ({
  jobOverview: {
    companyName: typeof value?.jobOverview?.companyName === 'string' ? value.jobOverview.companyName : undefined,
  },
  sections: {
    responsibilities: ensureArray(value?.sections?.responsibilities).map(String),
    mustHaveRequirements: ensureArray(value?.sections?.mustHaveRequirements || value?.sections?.coreRequirements).map(String),
    niceToHaveRequirements: ensureArray(value?.sections?.niceToHaveRequirements || value?.sections?.bonusRequirements).map(String),
    benefits: ensureArray(value?.sections?.benefits).map(String),
    qualifications: ensureArray(value?.sections?.qualifications).map(String),
  },
});

const buildHeuristicOverrides = (rawJD = '') => {
  const extracted = extractSeekStyleSections(rawJD);
  return normalizeOverrides({
    jobOverview: { companyName: '' },
    sections: {
      responsibilities: extracted.responsibilities,
      mustHaveRequirements: extracted.coreRequirements,
      niceToHaveRequirements: extracted.bonusRequirements,
      benefits: extracted.benefits,
      qualifications: [],
    },
  });
};

const buildPrompt = ({ rawJD = '', previousParsedJD = {}, criticFeedback = {} }) => `You are a JD reparse agent.

The first parser output was blocked by a critic agent. Re-extract only the fields listed below using the original JD text.

Rules:
1. Use only the original JD text.
2. Do not invent a company name. If there is no explicit company name, return an empty string for jobOverview.companyName.
3. Extract responsibilities from duties/responsibilities style sections.
4. Extract core requirements from requirements, must-have, essential, or "we are seeking someone with" sections.
5. Extract bonus requirements from pluses, bonus, preferred, desirable, or nice-to-have sections.
6. Preserve complete phrases. Do not split around "or".
7. Keep wording close to the JD.
8. Return strict JSON only.

Return this JSON shape:
{
  "jobOverview": { "companyName": "string" },
  "sections": {
    "responsibilities": ["string"],
    "mustHaveRequirements": ["string"],
    "niceToHaveRequirements": ["string"],
    "benefits": ["string"]
  }
}

Critic feedback:
${JSON.stringify(criticFeedback, null, 2)}

Previous parsed JD:
${JSON.stringify(previousParsedJD, null, 2).slice(0, 9000)}

Original JD:
${rawJD.slice(0, 7000)}`;

export const buildJdReparseOverridesWithDeepSeek = async ({ rawJD = '', previousParsedJD = {}, criticFeedback = {} } = {}) => {
  const fallback = buildHeuristicOverrides(rawJD);
  if (isMockAiMode() || !process.env.DEEPSEEK_API_KEY) return fallback;

  const aiOverrides = await callDeepSeekJson({
    prompt: buildPrompt({ rawJD, previousParsedJD, criticFeedback }),
    systemInstruction: 'You are a strict JD reparse agent. Return valid JSON only. No prose.',
    fallback,
    maxRetries: 1,
  });

  const normalized = normalizeOverrides(aiOverrides);
  return {
    jobOverview: {
      ...fallback.jobOverview,
      ...normalized.jobOverview,
    },
    sections: {
      responsibilities: normalized.sections.responsibilities.length ? normalized.sections.responsibilities : fallback.sections.responsibilities,
      mustHaveRequirements: normalized.sections.mustHaveRequirements.length ? normalized.sections.mustHaveRequirements : fallback.sections.mustHaveRequirements,
      niceToHaveRequirements: normalized.sections.niceToHaveRequirements.length ? normalized.sections.niceToHaveRequirements : fallback.sections.niceToHaveRequirements,
      benefits: normalized.sections.benefits.length ? normalized.sections.benefits : fallback.sections.benefits,
      qualifications: normalized.sections.qualifications,
    },
  };
};
