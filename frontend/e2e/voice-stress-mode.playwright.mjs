#!/usr/bin/env node
/**
 * E2E gate: F-73 Interview Stress Level Mode — real backend.
 *
 * Product requirements verified:
 * 1. Creating a session with stressLevel='high_pressure' stores the setting
 *    correctly in the session record (verifiable via GET /api/session/:id).
 * 2. Creating a session with stressLevel='supportive' stores the setting correctly.
 * 3. Both sessions complete a full voice turn without errors (duplex flow works
 *    regardless of stress mode setting).
 * 4. The stressLevel is correctly preserved across the session lifecycle
 *    (not silently dropped to 'standard' by normalization bugs).
 *
 * The test uses the real backend with test STT/TTS providers.
 * High-pressure mode's deeper behavioral effect (PROBE_STRESS action type)
 * is validated at the unit-test level (interviewTurnOrchestratorService.test.js).
 * This E2E gate validates that the setting flows end-to-end through the API.
 */

import process from 'node:process';

import { buildBaseArtifact, writeE2eArtifact } from './helpers/e2eArtifactHelpers.mjs';
import {
  apiRequest,
  buildRoleFitRubric,
  closeSeedConnections,
  configureE2eAuthEnv,
  seedSyntheticUser,
  startBackendServer,
  startFrontendServer,
  stopProcess,
} from './helpers/e2eBackendHarness.mjs';
import {
  collectBrowserDiagnostics,
  driveVoiceTurnThroughSocket,
  getVoiceTrace,
  installVoiceSocketTrace,
  loadPlaywright,
} from './helpers/e2eVoiceHarness.mjs';

const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3097);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4186);
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${FRONTEND_PORT}`;
const ARTIFACT_FILENAME = 'voice-stress-mode.latest.json';
const TEST_TRANSCRIPT = 'I designed a scalable microservice architecture and owned the service mesh migration.';

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

const buildStressModePlanBody = ({ jdRubric, stressLevel }) => ({
  rawJD: 'Senior Systems Engineer role requiring distributed systems design and service mesh experience.',
  jdText: 'Senior Systems Engineer role requiring distributed systems design and service mesh experience.',
  jdRubric,
  settings: {
    seniorityLevel: 'Senior',
    focusArea: 'Technical',
    questionType: 'Technical',
    controlMode: 'question',
    questionLimit: 2,
    timeLimitMinutes: 20,
    stressLevel,
  },
  sessionSetup: {
    deliveryMode: 'voice',
    controlMode: 'question',
    questionLimit: 2,
    timeLimitMinutes: 20,
    questionType: 'Technical',
    stressLevel,
  },
  analysisResult: {
    candidateName: 'Stress Mode Candidate',
    jobTitle: jdRubric.title,
    matchScore: 82,
    decision: { label: 'qualified', reasonCodes: ['role_fit_verified'] },
    strengths: ['distributed systems', 'service mesh'],
    gaps: [],
    requirementChecks: [],
    matchingDetails: { questionPlanHints: { priorityTopics: ['service mesh', 'distributed systems'] } },
    parsedJdProfile: jdRubric,
  },
  mode: 'voice',
});

const createStressModeSession = async ({ backendBaseUrl, token, stressLevel, apiCalls }) => {
  const jdRubric = buildRoleFitRubric({
    reviewStatus: 'verified',
    jdFingerprint: `voice-stress-${stressLevel}-role-fit`,
  });

  const plan = await apiRequest({
    backendBaseUrl,
    token,
    method: 'POST',
    endpoint: '/analyze/interview-plan',
    body: buildStressModePlanBody({ jdRubric, stressLevel }),
  });

  apiCalls?.push({ method: 'POST', path: '/api/analyze/interview-plan', status: plan.status });

  if (!plan.ok || !plan.data?.sessionId) {
    throw new Error(`Expected sessionId from interview-plan, got: ${JSON.stringify(plan.data)}`);
  }
  return { sessionId: plan.data.sessionId, jdRubric };
};

const fetchSession = async ({ backendBaseUrl, token, sessionId }) => {
  const result = await apiRequest({
    backendBaseUrl,
    token,
    endpoint: `/session/${sessionId}`,
  });
  return result.data?.session || result.data;
};

const runStressModeScenario = async ({ page, backendBaseUrl, token, stressLevel, apiCalls, browserErrors }) => {
  const { sessionId } = await createStressModeSession({ backendBaseUrl, token, stressLevel, apiCalls });

  // Verify session created with correct stressLevel before doing the voice turn
  const sessionBefore = await fetchSession({ backendBaseUrl, token, sessionId });
  assert(
    sessionBefore?.settings?.stressLevel === stressLevel,
    `Expected session settings.stressLevel='${stressLevel}', got: ${sessionBefore?.settings?.stressLevel}`,
  );

  await page.goto(`${FRONTEND_BASE_URL}/interview/${sessionId}`);
  await page.getByText('Voice practice mode').waitFor({ timeout: 150_000 });
  await page.getByRole('button', { name: /Start voice interview/i }).click();

  const clientTurnId = await driveVoiceTurnThroughSocket({
    page,
    speechDurationMs: 3500,
    audioChunks: 8,
  });

  await page.waitForFunction(
    () => window.__kiwiVoiceE2E?.inboundTypes?.includes('stt_final'),
    null,
    { timeout: 180_000 },
  );
  await page.waitForFunction(
    () => window.__kiwiVoiceE2E?.inboundTypes?.includes('turn_done'),
    null,
    { timeout: 180_000 },
  );

  const trace = await getVoiceTrace(page);
  assert(trace.inboundTypes.includes('stt_final'), `Expected stt_final for stressLevel=${stressLevel}`);
  assert(trace.inboundTypes.includes('turn_done'), `Expected turn_done for stressLevel=${stressLevel}`);
  assert(browserErrors.length === 0, `Browser errors during ${stressLevel}: ${browserErrors.join(', ')}`);

  // Re-fetch session after turn to confirm stressLevel persisted
  const sessionAfter = await fetchSession({ backendBaseUrl, token, sessionId });
  assert(
    sessionAfter?.settings?.stressLevel === stressLevel,
    `Expected stressLevel='${stressLevel}' to persist after turn, got: ${sessionAfter?.settings?.stressLevel}`,
  );

  return { stressLevel, sessionId, clientTurnId, inboundTypes: trace.inboundTypes };
};

const buildFailureArtifact = ({ error, apiCalls, browserErrors }) => buildBaseArtifact({
  schemaVersion: 'voice_stress_mode_e2e_report_v1',
  truthLevel: 'hybrid_backend',
  resultType: 'voice_stress_mode_failed',
  passed: false,
  blockers: ['stress_mode_flow_failed'],
  assertions: [],
  browserErrors,
  apiCalls,
  extra: { error: error?.message || String(error) },
});

const run = async () => {
  const { chromium } = loadPlaywright();
  configureE2eAuthEnv({
    jwtSecret: 'voice-stress-mode-e2e-secret',
    googleClientId: 'voice-stress-mode-client',
  });

  const apiCalls = [];
  const browserErrors = [];
  let backendServer = null;
  let frontendServer = null;
  let browser = null;

  try {
    const { token, user } = await seedSyntheticUser({
      emailPrefix: 'voice-stress-mode',
      name: 'Stress Mode Candidate',
    });
    await closeSeedConnections();

    backendServer = await startBackendServer({
      backendBaseUrl: process.env.BACKEND_BASE_URL,
      backendPort: BACKEND_PORT,
      frontendBaseUrl: FRONTEND_BASE_URL,
      env: {
        VOICE_STT_PROVIDER_ORDER: 'test',
        VOICE_TTS_PROVIDER_ORDER: 'test',
        TEST_REALTIME_STT_TRANSCRIPT: TEST_TRANSCRIPT,
        TEST_REALTIME_STT_CONFIDENCE: '0.91',
        TEST_TTS_FIRST_BYTE_DELAY_MS: '0',
        TEST_TTS_CHUNK_DELAY_MS: '0',
      },
    });

    frontendServer = await startFrontendServer({
      frontendBaseUrl: process.env.FRONTEND_BASE_URL,
      frontendPort: FRONTEND_PORT,
      backendBaseUrl: BACKEND_BASE_URL,
    });

    browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 920 },
      permissions: ['microphone'],
    });
    await context.addInitScript((authToken) => window.localStorage.setItem('kiwi_auth_token', authToken), token);
    await installVoiceSocketTrace(context);

    const page = await context.newPage();
    collectBrowserDiagnostics({ page, apiCalls, browserErrors });

    // Run high_pressure scenario
    const highPressureResult = await runStressModeScenario({
      page, backendBaseUrl: BACKEND_BASE_URL, token, stressLevel: 'high_pressure', apiCalls, browserErrors,
    });

    // Reset browser errors and socket trace for supportive scenario
    browserErrors.length = 0;
    await page.evaluate(() => {
      window.__kiwiVoiceE2E = { voiceSocket: null, events: [], outboundTypes: [], inboundTypes: [] };
    });

    // Run supportive scenario
    const supportiveResult = await runStressModeScenario({
      page, backendBaseUrl: BACKEND_BASE_URL, token, stressLevel: 'supportive', apiCalls, browserErrors,
    });

    const artifact = buildBaseArtifact({
      schemaVersion: 'voice_stress_mode_e2e_report_v1',
      truthLevel: 'hybrid_backend',
      resultType: 'voice_stress_mode_verified',
      passed: true,
      assertions: [
        'high_pressure_stressLevel_persisted_in_session',
        'supportive_stressLevel_persisted_in_session',
        'high_pressure_voice_turn_completed',
        'supportive_voice_turn_completed',
        'no_browser_errors',
      ],
      browserErrors,
      apiCalls,
      extra: {
        userId: user.id,
        highPressure: highPressureResult,
        supportive: supportiveResult,
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
    await browser?.close?.();
    await closeSeedConnections().catch(() => {});
    await stopProcess(frontendServer);
    await stopProcess(backendServer);
  }
};

await run();
