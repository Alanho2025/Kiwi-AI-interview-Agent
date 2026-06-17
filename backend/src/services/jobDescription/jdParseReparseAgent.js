/**
 * File responsibility: DeepSeek-guided JD reparse agent.
 * Main responsibilities:
 * - Build section overrides after a critic blocks the first JD parse.
 * - Keep the original parser/output schema in control by returning only safe section-level overrides.
 */

import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { ensureArray, isMockAiMode } from '../agenticSafeguards/safeguardShared.js';
import { extractSeekStyleSections } from './jdSafeguardHeuristics.js';
import {
  buildJdSafeguardProviderMetadata,
  getJdSafeguardAiMaxRetries,
  getJdSafeguardAiTimeoutMs,
} from './jdSafeguardAiBudget.js';

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
  metadata: value?.metadata && typeof value.metadata === 'object' ? value.metadata : {},
});

const extractCompanyNameFromRaw = (rawJD = '') => {
  const text = String(rawJD || '');
  const patterns = [
    /\b(?:at|for)\s+([A-Z][A-Za-z0-9&.' -]{1,60}?)(?:,|\s+you(?:'|’)ll|\s+you will|\s+is\b|\s+are\b)/,
    /^([A-Z][A-Za-z0-9&.' -]{1,60}?)\s+is\s+one\s+of\b/im,
    /^([A-Z][A-Za-z0-9&.' -]{1,60}?)\s+is\s+(?:a|an)\b/im,
  ];
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim() || '';
    if (value && value.split(/\s+/).length <= 6) return value;
  }
  return '';
};

const buildHeuristicOverrides = (rawJD = '') => {
  const extracted = extractSeekStyleSections(rawJD);
  return normalizeOverrides({
    jobOverview: { companyName: extractCompanyNameFromRaw(rawJD) },
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
2. Do not invent a company name. Extract it only from explicit evidence such as "at CompanyName" or "CompanyName is ...". If there is no explicit company name, return an empty string for jobOverview.companyName.
3. Extract responsibilities from duties/responsibilities style sections.
4. Extract core requirements from requirements, must-have, essential, "what we are looking for", or "we are seeking someone with" sections.
5. Extract bonus requirements from pluses, bonus, preferred, desirable, or nice-to-have sections.
6. Preserve complete phrases. Do not split around "or", "e.g.", or parentheses.
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

  const timeoutMs = getJdSafeguardAiTimeoutMs();
  const aiOverrides = await callDeepSeekJson({
    prompt: buildPrompt({ rawJD, previousParsedJD, criticFeedback }),
    systemInstruction: 'You are a strict JD reparse agent. Return valid JSON only. No prose.',
    fallback,
    maxRetries: getJdSafeguardAiMaxRetries(),
    timeoutMs,
    usageMetadata: { stage: 'jd_parse', feature: 'jd_reparse' },
  });

  const normalized = normalizeOverrides(aiOverrides);
  const providerMetadata = buildJdSafeguardProviderMetadata({ result: aiOverrides, timeoutMs });
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
    metadata: {
      ...normalized.metadata,
      ...providerMetadata,
    },
  };
};
