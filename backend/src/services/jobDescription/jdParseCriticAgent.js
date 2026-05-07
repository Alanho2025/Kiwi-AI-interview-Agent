/**
 * File responsibility: DeepSeek critic agent for JD parse output control.
 * Main responsibilities:
 * - Review parsed JD fields against the original JD text.
 * - Return pass/revise/reject plus field-level reparse instructions for the Master controller.
 */

import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { assertSafeguardProviderConfigured, isMockAiMode, normalizeSafeguardReview } from '../agenticSafeguards/safeguardShared.js';
import { buildHeuristicJdParseReview } from './jdSafeguardHeuristics.js';

const buildPrompt = ({ rawJD = '', parsedJD = {} }) => `You are a strict JD parse output controller for an interview preparation system.

You will receive:
1. The original job description text.
2. The parsed JD JSON.

Your task is to check whether each parsed field is faithful to the original JD.

Rules:
1. Do not accept a company field unless the company name is explicitly stated.
2. Extract responsibilities from sections such as "duties", "responsibilities", "what you will do", or "the position includes".
3. Extract core requirements from sections such as "we are seeking someone with", "requirements", "must-have", or "essential".
4. Extract bonus requirements from sections such as "pluses", "nice to have", "preferred", or "bonus".
5. Do not move bonus requirements into core requirements.
6. Do not split phrases incorrectly around "or".
7. Preserve technical terms exactly, including Python, SQL, Linux, C++, Elasticsearch, Kibana, Grafana, and version control.
8. If qualifications and core requirements duplicate each other, mark the duplication as low or medium severity.
9. Return strict JSON only.

Return this JSON shape:
{
  "verdict": "pass | revise | reject",
  "confidence": 0.0,
  "blockOutput": true,
  "blockMatch": true,
  "issues": [
    { "field": "string", "severity": "low | medium | high", "problem": "string", "action": "string" }
  ],
  "reparseInstructions": ["string"],
  "reasoning": "string"
}

Original JD:
${rawJD.slice(0, 7000)}

Parsed JD JSON:
${JSON.stringify(parsedJD, null, 2).slice(0, 12000)}`;

export const reviewJdParseWithDeepSeek = async ({ rawJD = '', parsedJD = {} } = {}) => {
  const heuristicFallback = buildHeuristicJdParseReview({ rawJD, parsedJD });
  if (isMockAiMode()) {
    return normalizeSafeguardReview(heuristicFallback, heuristicFallback);
  }
  assertSafeguardProviderConfigured();

  const aiReview = await callDeepSeekJson({
    prompt: buildPrompt({ rawJD, parsedJD }),
    systemInstruction: 'You are a strict output controller. Return valid JSON only. No prose.',
    fallback: heuristicFallback,
    maxRetries: 1,
  });

  return normalizeSafeguardReview(aiReview, heuristicFallback);
};
