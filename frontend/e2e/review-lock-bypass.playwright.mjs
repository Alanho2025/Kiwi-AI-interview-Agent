#!/usr/bin/env node

import process from 'node:process';

import { buildBaseArtifact, writeE2eArtifact } from './helpers/e2eArtifactHelpers.mjs';
import {
  apiRequest,
  buildRoleFitRubric,
  closeSeedConnections,
  configureE2eAuthEnv,
  createSyntheticCv,
  seedSyntheticUser,
  seedVerifiedRoleFitReview,
  startBackendServer,
  stopProcess,
} from './helpers/e2eBackendHarness.mjs';

const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3092);
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:4173';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const ARTIFACT_FILENAME = 'review-lock-bypass.latest.json';
const RAW_JD = 'Frontend Voice Systems Engineer role requiring React voice UX, WebSocket debugging, Playwright E2E, and latency instrumentation.';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isUsableMatch = (data = {}) =>
  Boolean(data.matchAnalysisId)
  && String(data?.decision?.label || '').toLowerCase() !== 'manual_review';

const createPlanBody = ({ cvId, jdRubric, matchData, matchAnalysisId }) => ({
  cvId,
  rawJD: RAW_JD,
  jdText: RAW_JD,
  jdRubric,
  matchAnalysisId,
  analysisResult: matchData,
  mode: 'text',
  settings: {
    seniorityLevel: 'Mid-level',
    focusArea: 'Technical',
    questionType: 'Technical',
    controlMode: 'question',
    questionLimit: 3,
    timeLimitMinutes: 30,
  },
  sessionSetup: {
    deliveryMode: 'text',
    controlMode: 'question',
    questionLimit: 3,
    timeLimitMinutes: 30,
    questionType: 'Technical',
  },
});

const buildFailureArtifact = ({ error, apiCalls }) => buildBaseArtifact({
  schemaVersion: 'review_lock_bypass_e2e_report_v1',
  truthLevel: 'hybrid_backend',
  resultType: 'review_lock_bypass_failed',
  passed: false,
  blockers: ['review_lock_bypass_allowed_usable_match'],
  assertions: [],
  apiCalls,
  extra: { error: error?.message || String(error) },
});

const run = async () => {
  configureE2eAuthEnv({
    jwtSecret: 'review-lock-bypass-e2e-secret',
    googleClientId: 'review-lock-bypass-client',
  });

  const apiCalls = [];
  let backendServer = null;

  try {
    const { user, token } = await seedSyntheticUser({
      emailPrefix: 'review-lock-bypass',
      name: 'Review Lock Bypass Candidate',
    });
    const { cvId } = await createSyntheticCv({ userId: user.id, filename: 'review-lock-bypass-cv.txt' });
    const verifiedRubric = buildRoleFitRubric({ reviewStatus: 'verified' });
    await seedVerifiedRoleFitReview({ userId: user.id, jdRubric: verifiedRubric });
    await closeSeedConnections();
    backendServer = await startBackendServer({
      backendBaseUrl: process.env.BACKEND_BASE_URL,
      backendPort: BACKEND_PORT,
      frontendBaseUrl: FRONTEND_BASE_URL,
    });

    const unverifiedRubric = buildRoleFitRubric({ reviewStatus: 'edited' });
    const unverifiedMatch = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'POST',
      endpoint: '/analyze/match',
      body: { cvId, rawJD: RAW_JD, jdRubric: unverifiedRubric, settings: { focusArea: 'Technical' } },
    });
    apiCalls.push({ method: 'POST', path: '/api/analyze/match', status: unverifiedMatch.status });
    const unverifiedMatchData = unverifiedMatch.data || {};
    assert(
      !unverifiedMatch.ok || !isUsableMatch(unverifiedMatchData),
      `Unverified match unexpectedly usable: ${JSON.stringify(unverifiedMatchData)}`
    );

    const manualReviewAnalysis = {
      schemaVersion: 'v3',
      candidateName: 'Review Lock Candidate',
      jobTitle: 'Frontend Voice Systems Engineer',
      matchScore: 0,
      overallScore: 0,
      confidence: 0,
      decision: { label: 'manual_review', reasonCodes: ['role_fit_review_required'] },
      roleFitDiagnostics: { degradedReasons: ['role_fit_review_required'] },
      strengths: [],
      gaps: [],
      riskFlags: ['Review company and role understanding before matching.'],
    };
    const blockedPlan = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'POST',
      endpoint: '/analyze/interview-plan',
      body: createPlanBody({
        cvId,
        jdRubric: unverifiedRubric,
        matchData: manualReviewAnalysis,
        matchAnalysisId: null,
      }),
    });
    apiCalls.push({ method: 'POST', path: '/api/analyze/interview-plan', status: blockedPlan.status });
    assert(!blockedPlan.ok, `Unverified manual-review match created an interview plan: ${JSON.stringify(blockedPlan.data)}`);
    assert(!blockedPlan.data?.sessionId, 'Blocked plan response must not include a sessionId.');

    const verifiedMatch = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'POST',
      endpoint: '/analyze/match',
      body: { cvId, rawJD: RAW_JD, jdRubric: verifiedRubric, settings: { focusArea: 'Technical' } },
    });
    apiCalls.push({ method: 'POST', path: '/api/analyze/match', status: verifiedMatch.status });
    const verifiedMatchData = verifiedMatch.data || {};
    assert(verifiedMatch.ok, `Verified match failed with ${verifiedMatch.status}: ${JSON.stringify(verifiedMatchData)}`);
    assert(isUsableMatch(verifiedMatchData), `Verified match was not usable: ${JSON.stringify(verifiedMatchData)}`);

    const verifiedPlan = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'POST',
      endpoint: '/analyze/interview-plan',
      body: createPlanBody({
        cvId,
        jdRubric: verifiedRubric,
        matchData: verifiedMatchData,
        matchAnalysisId: verifiedMatchData.matchAnalysisId,
      }),
    });
    apiCalls.push({ method: 'POST', path: '/api/analyze/interview-plan', status: verifiedPlan.status });
    assert(verifiedPlan.ok && verifiedPlan.data?.sessionId, `Verified plan did not create a session: ${JSON.stringify(verifiedPlan.data)}`);

    const artifact = buildBaseArtifact({
      schemaVersion: 'review_lock_bypass_e2e_report_v1',
      truthLevel: 'hybrid_backend',
      resultType: 'review_lock_bypass_blocked',
      passed: true,
      assertions: [
        'review_lock_bypass_blocked',
        'manual_review_match_not_usable',
        'verified_match_still_creates_plan',
      ],
      apiCalls,
      extra: {
        unsafeMatchStatus: unverifiedMatch.status,
        unsafePlanStatus: blockedPlan.status,
        verifiedMatchStatus: verifiedMatch.status,
        verifiedPlanStatus: verifiedPlan.status,
      },
    });

    await writeE2eArtifact(ARTIFACT_FILENAME, artifact);
    console.log(JSON.stringify(artifact, null, 2));
  } catch (error) {
    const artifact = buildFailureArtifact({ error, apiCalls });
    await writeE2eArtifact(ARTIFACT_FILENAME, artifact);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeSeedConnections().catch(() => {});
    await stopProcess(backendServer);
  }
};

await run();
