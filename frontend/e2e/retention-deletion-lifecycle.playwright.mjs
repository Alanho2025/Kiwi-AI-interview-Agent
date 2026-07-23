#!/usr/bin/env node

import { createRequire } from 'node:module';
import process from 'node:process';

import { buildBaseArtifact, toBrowserErrorMessage, writeE2eArtifact } from './helpers/e2eArtifactHelpers.mjs';
import {
  apiRequest,
  buildRoleFitRubric,
  closeSeedConnections,
  configureE2eAuthEnv,
  createSyntheticCv,
  seedSyntheticUser,
  seedVerifiedRoleFitReview,
  startBackendServer,
  startFrontendServer,
  stopProcess,
} from './helpers/e2eBackendHarness.mjs';

const require = createRequire(import.meta.url);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3093);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4178);
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${FRONTEND_PORT}`;
const ARTIFACT_FILENAME = 'retention-deletion-lifecycle.latest.json';
const RAW_JD = 'Frontend Voice Systems Engineer role requiring React, WebSocket, Playwright, and latency instrumentation.';

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for retention deletion E2E: ${error.message}`, { cause: error });
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isExpectedDeletedResourceConsoleError = (message) =>
  message.type() === 'error' && message.text().includes('the server responded with a status of 404');

const createPlanBody = ({ cvId, jdRubric, matchData }) => ({
  cvId,
  rawJD: RAW_JD,
  jdText: RAW_JD,
  jdRubric,
  matchAnalysisId: matchData.matchAnalysisId,
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

const createVerifiedSession = async ({ token, cvId, jdRubric, apiCalls }) => {
  const match = await apiRequest({
    backendBaseUrl: BACKEND_BASE_URL,
    token,
    method: 'POST',
    endpoint: '/analyze/match',
    body: { cvId, rawJD: RAW_JD, jdRubric, settings: { focusArea: 'Technical' } },
  });
  apiCalls.push({ method: 'POST', path: '/api/analyze/match', status: match.status });
  assert(match.ok && match.data?.matchAnalysisId, `Expected verified matchAnalysisId, got ${JSON.stringify(match.data)}`);

  const plan = await apiRequest({
    backendBaseUrl: BACKEND_BASE_URL,
    token,
    method: 'POST',
    endpoint: '/analyze/interview-plan',
    body: createPlanBody({ cvId, jdRubric, matchData: match.data }),
  });
  apiCalls.push({ method: 'POST', path: '/api/analyze/interview-plan', status: plan.status });
  assert(plan.ok && plan.data?.sessionId, `Expected sessionId, got ${JSON.stringify(plan.data)}`);
  return { matchData: match.data, sessionId: plan.data.sessionId };
};

const assertCvNotInRecentList = async ({ token, cvId, apiCalls }) => {
  const recent = await apiRequest({
    backendBaseUrl: BACKEND_BASE_URL,
    token,
    method: 'GET',
    endpoint: '/upload/recent-cvs',
  });
  apiCalls.push({ method: 'GET', path: '/api/upload/recent-cvs', status: recent.status });
  assert(recent.ok, `Recent CV request failed: ${JSON.stringify(recent.data)}`);
  const recentItems = Array.isArray(recent.data) ? recent.data : recent.data?.recentCVs || [];
  assert(!recentItems.some((item) => item?.id === cvId), 'Deleted CV still appeared in recent CVs.');
};

const runBrowserDeletedSessionCheck = async ({ token, sessionId, browserErrors }) => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await context.addInitScript((authToken) => window.localStorage.setItem('kiwi_auth_token', authToken), token);
    const page = await context.newPage();
    page.on('pageerror', (error) => browserErrors.push(toBrowserErrorMessage('pageerror', error)));
    page.on('console', (message) => {
      if (isExpectedDeletedResourceConsoleError(message)) return;
      if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
    });
    await page.goto(`${FRONTEND_BASE_URL}/interview/${sessionId}`);
    return Promise.race([
      page.getByText('Session not found.').waitFor({ timeout: 60_000 }).then(() => 'session_not_found_view'),
      page.waitForURL(/\/analysis(?:$|[?#])/, { timeout: 60_000 }).then(() => 'redirected_to_analysis'),
      page.getByText('Could not load interview').waitFor({ timeout: 60_000 }).then(() => 'load_error_status'),
    ]);
  } finally {
    await browser.close();
  }
};

const buildFailureArtifact = ({ error, apiCalls, browserErrors }) => buildBaseArtifact({
  schemaVersion: 'retention_deletion_lifecycle_e2e_report_v1',
  truthLevel: 'hybrid_backend',
  resultType: 'retention_deletion_failed',
  passed: false,
  blockers: ['retention_deleted_artifact_readable'],
  assertions: [],
  browserErrors,
  apiCalls,
  extra: { error: error?.message || String(error) },
});

const run = async () => {
  configureE2eAuthEnv({
    jwtSecret: 'retention-deletion-e2e-secret',
    googleClientId: 'retention-deletion-client',
  });

  const apiCalls = [];
  const browserErrors = [];
  let backendServer = null;
  let frontendServer = null;

  try {
    const { user, token } = await seedSyntheticUser({
      emailPrefix: 'retention-deletion',
      name: 'Retention Deletion Candidate',
    });
    const { cvId } = await createSyntheticCv({ userId: user.id, filename: 'retention-deletion-cv.txt' });
    const jdRubric = buildRoleFitRubric({ reviewStatus: 'verified' });
    await seedVerifiedRoleFitReview({ userId: user.id, jdRubric });
    await closeSeedConnections();

    backendServer = await startBackendServer({
      backendBaseUrl: process.env.BACKEND_BASE_URL,
      backendPort: BACKEND_PORT,
      frontendBaseUrl: FRONTEND_BASE_URL,
    });
    frontendServer = await startFrontendServer({
      frontendBaseUrl: process.env.FRONTEND_BASE_URL,
      frontendPort: FRONTEND_PORT,
      backendBaseUrl: BACKEND_BASE_URL,
    });

    const { sessionId } = await createVerifiedSession({ token, cvId, jdRubric, apiCalls });

    const sessionBeforeDelete = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'GET',
      endpoint: `/session/${sessionId}`,
    });
    apiCalls.push({ method: 'GET', path: `/api/session/${sessionId}`, status: sessionBeforeDelete.status });
    assert(sessionBeforeDelete.ok, `Expected session readable before delete: ${JSON.stringify(sessionBeforeDelete.data)}`);

    const deleteSession = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'DELETE',
      endpoint: `/session/${sessionId}`,
    });
    apiCalls.push({ method: 'DELETE', path: `/api/session/${sessionId}`, status: deleteSession.status });
    assert(deleteSession.ok, `Session delete failed: ${JSON.stringify(deleteSession.data)}`);

    const sessionAfterDelete = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'GET',
      endpoint: `/session/${sessionId}`,
    });
    apiCalls.push({ method: 'GET', path: `/api/session/${sessionId}`, status: sessionAfterDelete.status });
    assert(!sessionAfterDelete.ok, 'Deleted session remained readable through API.');

    const reportAfterDelete = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'GET',
      endpoint: `/report/${sessionId}`,
    });
    apiCalls.push({ method: 'GET', path: `/api/report/${sessionId}`, status: reportAfterDelete.status });
    assert(!reportAfterDelete.ok, 'Deleted session report remained readable through API.');

    const browserDeletedSessionResult = await runBrowserDeletedSessionCheck({ token, sessionId, browserErrors });

    const deleteCv = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'DELETE',
      endpoint: `/upload/cv/${cvId}`,
    });
    apiCalls.push({ method: 'DELETE', path: `/api/upload/cv/${cvId}`, status: deleteCv.status });
    assert(deleteCv.ok, `CV delete failed: ${JSON.stringify(deleteCv.data)}`);

    await assertCvNotInRecentList({ token, cvId, apiCalls });

    const exportDeletedCv = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'GET',
      endpoint: `/upload/cv/${cvId}/export`,
    });
    apiCalls.push({ method: 'GET', path: `/api/upload/cv/${cvId}/export`, status: exportDeletedCv.status });
    assert(!exportDeletedCv.ok, 'Deleted CV export remained available.');

    const matchDeletedCv = await apiRequest({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      method: 'POST',
      endpoint: '/analyze/match',
      body: { cvId, rawJD: RAW_JD, jdRubric, settings: { focusArea: 'Technical' } },
    });
    apiCalls.push({ method: 'POST', path: '/api/analyze/match', status: matchDeletedCv.status });
    assert(!matchDeletedCv.ok, 'Deleted CV could still be used for match analysis.');
    assert(browserErrors.length === 0, `Browser errors occurred: ${browserErrors.join('\n')}`);

    const artifact = buildBaseArtifact({
      schemaVersion: 'retention_deletion_lifecycle_e2e_report_v1',
      truthLevel: 'hybrid_backend',
      resultType: 'retention_deletion_access_denied',
      passed: true,
      assertions: [
        'deleted_session_not_readable',
        'deleted_session_report_not_readable',
        'deleted_session_browser_not_found',
        'deleted_session_browser_denied',
        'deleted_cv_not_listed',
        'deleted_cv_export_rejected',
        'deleted_cv_not_reusable',
      ],
      apiCalls,
      browserErrors,
      extra: {
        sessionId,
        cvId,
        deletedSessionStatus: sessionAfterDelete.status,
        deletedReportStatus: reportAfterDelete.status,
        browserDeletedSessionResult,
        deletedCvExportStatus: exportDeletedCv.status,
        deletedCvMatchStatus: matchDeletedCv.status,
      },
    });
    await writeE2eArtifact(ARTIFACT_FILENAME, artifact);
    console.log(JSON.stringify(artifact, null, 2));
  } catch (error) {
    const artifact = buildFailureArtifact({ error, apiCalls, browserErrors });
    await writeE2eArtifact(ARTIFACT_FILENAME, artifact);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeSeedConnections().catch(() => {});
    await stopProcess(frontendServer);
    await stopProcess(backendServer);
  }
};

await run();
