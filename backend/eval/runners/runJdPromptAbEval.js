import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  attachJdReviewProviderTelemetry,
  buildJdSafeguardTrace,
  sanitizeTelemetryError,
  summarizeProviderResponse,
} from '../helpers/jdPromptAbTelemetry.js';

// Operational contract: this process runs one prompt variant only. Run the
// legacy process to completion before starting the XML process; never run
// both variants concurrently against the provider.
const providerCalls = [];
const nativeFetch = globalThis.fetch;

const sanitizeProviderCall = (call = {}) => ({
  ...call,
  error: call.error ? sanitizeTelemetryError(call.error) : call.error,
  providerError: call.providerError ? sanitizeTelemetryError(call.providerError) : call.providerError,
});

const sanitizeSafeguardTrace = (trace = {}) => ({
  ...trace,
  firstReview: trace.firstReview
    ? { ...trace.firstReview, providerError: sanitizeTelemetryError(trace.firstReview.providerError) }
    : trace.firstReview,
  secondReview: trace.secondReview
    ? { ...trace.secondReview, providerError: sanitizeTelemetryError(trace.secondReview.providerError) }
    : trace.secondReview,
  reparseProviderError: sanitizeTelemetryError(trace.reparseProviderError),
});

const parseRequest = (init = {}) => {
  try {
    return JSON.parse(init.body || '{}');
  } catch {
    return {};
  }
};

const identifyFlow = (request = {}) => {
  const system = String(request.messages?.[0]?.content || '');
  const user = String(request.messages?.[1]?.content || '');
  const xmlFlow = system.match(/flow="([^"]+)"/)?.[1];
  if (xmlFlow) return xmlFlow;
  if (/parse output controller|Parsed JD JSON:/i.test(`${system}\n${user}`)) return 'parse_critic';
  if (/reparse agent|Previous parsed JD:/i.test(`${system}\n${user}`)) return 'reparse';
  if (/universal JD parser|fallback parser profile/i.test(`${system}\n${user}`)) return 'universal_parser';
  if (/skill extraction|technicalSkills|softSkills/i.test(`${system}\n${user}`)) return 'skill_enhancement';
  return 'unknown';
};

globalThis.fetch = async (input, init = {}) => {
  const request = parseRequest(init);
  const flow = identifyFlow(request);
  const startedAt = Date.now();

  try {
    const response = await nativeFetch(input, init);
    const callRecord = {
      flow,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      responseBodyRead: null,
      responseJsonValid: null,
      responseHasContent: null,
      providerResponse: null,
    };
    providerCalls.push(callRecord);
    const originalResponseJson = response.json.bind(response);
    response.json = async (...args) => {
      try {
        const data = await originalResponseJson(...args);
        const providerContent = data?.choices?.[0]?.message?.content || '';
        Object.assign(callRecord, {
          responseBodyRead: true,
          responseJsonValid: Boolean(data && typeof data === 'object' && !Array.isArray(data)),
          responseHasContent: Boolean(providerContent),
          providerResponse: providerContent ? summarizeProviderResponse(providerContent) : null,
          durationMs: Date.now() - startedAt,
        });
        return data;
      } catch (error) {
        Object.assign(callRecord, {
          responseBodyRead: false,
          error: sanitizeTelemetryError(error),
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }
    };
    return response;
  } catch (error) {
    providerCalls.push({
      flow,
      status: null,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: sanitizeTelemetryError(error),
    });
    throw error;
  }
};

const importFromRepo = (relativePath) => import(pathToFileURL(path.resolve(process.cwd(), relativePath)).href);

process.env.AI_TEST_MODE = 'real';
delete process.env.DISABLE_AI_JD_ENHANCEMENT;
process.env.MATCH_ENGINE = 'semantic';
process.env.AGENTIC_SAFEGUARDS_ENABLED = 'true';
process.env.AGENTIC_SAFEGUARD_MAX_REPARSE_ATTEMPTS = '1';

const [
  { buildGuardedStructuredJobDescriptionRubric },
  { buildUniversalRoleProfile },
  { scoreJdParseCase },
] = await Promise.all([
  importFromRepo('src/services/jobDescription/guardedJobDescriptionService.js'),
  importFromRepo('src/services/jobDescription/jdUniversalParserService.js'),
  importFromRepo('eval/helpers/jdParseEvalScorer.js'),
]);

const label = process.env.JD_AB_LABEL || process.argv[2] || 'unknown';
const outputPath = process.env.JD_AB_OUTPUT_PATH || path.resolve('eval/reports', `jd-prompt-ab-${label}.latest.json`);
const datasetPath = path.resolve('eval/datasets/jd-parse-eval.json');
const fixtureRoot = path.resolve('tests/fixtures/jobDescription');
const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];

for (const item of dataset) {
  const rawJD = await fs.readFile(path.join(fixtureRoot, item.fixture), 'utf8');
  const startedAt = Date.now();
  const callStart = providerCalls.length;

  try {
    const guardedRubric = await buildGuardedStructuredJobDescriptionRubric(rawJD);
    const scored = scoreJdParseCase(guardedRubric, item.expected);
    const universalProfile = await buildUniversalRoleProfile({ rawJD, rubric: guardedRubric });
    const caseProviderCalls = providerCalls.slice(callStart).map(sanitizeProviderCall);
    const safeguardTrace = sanitizeSafeguardTrace(attachJdReviewProviderTelemetry(
      buildJdSafeguardTrace(guardedRubric),
      caseProviderCalls,
    ));

    results.push({
      id: item.id,
      fixture: item.fixture,
      score: scored.score,
      criticalScore: scored.criticalScore,
      fieldScores: scored.fieldScores,
      failedChecks: scored.failedChecks,
      safeguard: safeguardTrace,
      universalProfile: {
        provider: universalProfile?.parser?.provider || null,
        requirementCount: Array.isArray(universalProfile?.requirements) ? universalProfile.requirements.length : 0,
        fallback: universalProfile?.parser?.provider !== 'deepseek',
      },
      providerCalls: caseProviderCalls,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    results.push({
      id: item.id,
      fixture: item.fixture,
      error: sanitizeTelemetryError(error),
      providerCalls: providerCalls.slice(callStart).map(sanitizeProviderCall),
      durationMs: Date.now() - startedAt,
    });
  }
}

const completed = results.filter((item) => Number.isFinite(item.score));
const criticProviderCalls = providerCalls.filter((call) => call.flow === 'parse_critic');
const average = completed.length
  ? Number((completed.reduce((sum, item) => sum + item.score, 0) / completed.length).toFixed(3))
  : null;
const criticalAverage = completed.length
  ? Number((completed.reduce((sum, item) => sum + item.criticalScore, 0) / completed.length).toFixed(3))
  : null;
const summary = {
  evaluation: 'JD prompt A/B safeguard telemetry',
  label,
  source: process.env.JD_AB_SOURCE || 'working tree',
  provider: 'DeepSeek',
  model: 'deepseek-chat',
  generationConfig: { temperature: 0, top_p: 1 },
  executionProtocol: {
    processScope: 'single_prompt_variant',
    caseOrder: 'sequential',
    crossVariantConcurrency: 'caller_must_run_serially',
  },
  casesRun: dataset.length,
  casesCompleted: completed.length,
  average,
  criticalAverage,
  failedCases: results.filter((item) => item.error).map((item) => ({
    id: item.id,
    error: sanitizeTelemetryError(item.error),
  })),
  universalProviderFallbackCases: completed.filter((item) => item.universalProfile.fallback).length,
  safeguardReparseCases: completed.filter((item) => item.safeguard.parseAttempts > 1).length,
  providerTimeoutAttempts: providerCalls.filter((call) => /timeout|abort/i.test(call.error || '')).length,
  providerBodyReadErrors: providerCalls.filter((call) => call.responseBodyRead === false).length,
  criticSchemaValidResponses: criticProviderCalls.filter((call) => call.providerResponse?.schemaValid === true).length,
  criticSchemaInvalidResponses: criticProviderCalls.filter((call) => call.providerResponse?.schemaValid === false).length,
  providerFallbackReviews: completed.reduce((sum, item) => sum
    + Number(item.safeguard.firstReview.providerFallbackUsed)
    + Number(item.safeguard.secondReview.providerFallbackUsed), 0),
  providerTimeoutReviews: completed.reduce((sum, item) => sum
    + Number(item.safeguard.firstReview.providerTimedOut)
    + Number(item.safeguard.secondReview.providerTimedOut), 0),
  results,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(JSON.stringify({
  label: summary.label,
  source: summary.source,
  casesRun: summary.casesRun,
  casesCompleted: summary.casesCompleted,
  average: summary.average,
  criticalAverage: summary.criticalAverage,
  safeguardReparseCases: summary.safeguardReparseCases,
  providerTimeoutAttempts: summary.providerTimeoutAttempts,
  providerFallbackReviews: summary.providerFallbackReviews,
  providerTimeoutReviews: summary.providerTimeoutReviews,
  outputPath,
}, null, 2));
