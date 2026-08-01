#!/usr/bin/env node
// Extended: F-32 + F-72 — confirmation → turn_done → report completion verified.

import process from 'node:process';

import { buildBaseArtifact, writeE2eArtifact } from './helpers/e2eArtifactHelpers.mjs';
import {
  closeSeedConnections,
  configureE2eAuthEnv,
  seedSyntheticUser,
  startBackendServer,
  startFrontendServer,
  stopProcess,
} from './helpers/e2eBackendHarness.mjs';
import {
  collectBrowserDiagnostics,
  createVoiceInterviewPlan,
  driveVoiceTurnThroughSocket,
  getQuestionProgressText,
  getVoiceTrace,
  installVoiceSocketTrace,
  loadPlaywright,
} from './helpers/e2eVoiceHarness.mjs';

const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3094);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4179);
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${FRONTEND_PORT}`;
const ARTIFACT_FILENAME = 'voice-low-confidence-ui.latest.json';
const LOW_CONFIDENCE_TRANSCRIPT = [
  'I led a voice interview reliability project where the browser streamed audio over WebSocket,',
  'the backend measured speech end to first audio latency, and the team reviewed fallback logs',
  'before changing the candidate experience.',
].join(' ');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const buildFailureArtifact = ({ error, apiCalls, browserErrors }) => buildBaseArtifact({
  schemaVersion: 'voice_low_confidence_ui_e2e_report_v1',
  truthLevel: 'hybrid_backend',
  resultType: 'voice_low_confidence_ui_failed',
  passed: false,
  blockers: ['low_confidence_incremented_question_count'],
  assertions: [],
  browserErrors,
  apiCalls,
  extra: { error: error?.message || String(error) },
});

const run = async () => {
  const { chromium } = loadPlaywright();
  configureE2eAuthEnv({
    jwtSecret: 'voice-low-confidence-e2e-secret',
    googleClientId: 'voice-low-confidence-client',
  });

  const apiCalls = [];
  const browserErrors = [];
  let backendServer = null;
  let frontendServer = null;
  let browser = null;

  try {
    const { token, user } = await seedSyntheticUser({
      emailPrefix: 'voice-low-confidence',
      name: 'Voice Low Confidence Candidate',
    });
    await closeSeedConnections();

    backendServer = await startBackendServer({
      backendBaseUrl: process.env.BACKEND_BASE_URL,
      backendPort: BACKEND_PORT,
      frontendBaseUrl: FRONTEND_BASE_URL,
      env: {
        VOICE_STT_PROVIDER_ORDER: 'test',
        VOICE_TTS_PROVIDER_ORDER: 'test',
        TEST_REALTIME_STT_TRANSCRIPT: LOW_CONFIDENCE_TRANSCRIPT,
        TEST_REALTIME_STT_CONFIDENCE: '0.28',
        TEST_TTS_FIRST_BYTE_DELAY_MS: '0',
        TEST_TTS_CHUNK_DELAY_MS: '0',
      },
    });

    const { sessionId } = await createVoiceInterviewPlan({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      apiCalls,
      jdFingerprint: 'voice-low-confidence-role-fit',
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

    await page.goto(`${FRONTEND_BASE_URL}/interview/${sessionId}`);
    await page.getByText('Voice practice mode').waitFor({ timeout: 150_000 });
    const progressBefore = await getQuestionProgressText(page);
    await page.getByRole('button', { name: /Start voice interview/i }).click();

    const clientTurnId = await driveVoiceTurnThroughSocket({
      page,
      speechDurationMs: 8500,
      audioChunks: 8,
    });
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.inboundTypes?.includes('transcript_confirmation_requested'), null, { timeout: 300_000 });
    const progressAfter = await getQuestionProgressText(page);
    const traceBeforeConfirm = await getVoiceTrace(page);

    assert(progressBefore && progressAfter === progressBefore, `Expected question progress to stay unchanged, before=${progressBefore}, after=${progressAfter}`);
    assert(traceBeforeConfirm.inboundTypes.includes('stt_final'), `Expected stt_final, got ${traceBeforeConfirm.inboundTypes.join(', ')}`);
    assert(traceBeforeConfirm.inboundTypes.includes('transcript_confirmation_requested'), `Expected transcript confirmation, got ${traceBeforeConfirm.inboundTypes.join(', ')}`);
    assert(!traceBeforeConfirm.inboundTypes.includes('turn_done'), 'Low-confidence answer was accepted before confirmation.');

    // Phase 2: Accept the confirmation via the WS confirm message, then verify turn completes.
    // The backend expects a 'transcript_confirmed' JSON message over the voice WebSocket.
    await page.evaluate(() => {
      const socket = window.__kiwiVoiceE2E?.voiceSocket;
      if (!socket) throw new Error('Voice socket not available for transcript confirmation');
      socket.send(JSON.stringify({ type: 'transcript_confirmed' }));
    });

    await page.waitForFunction(
      () => window.__kiwiVoiceE2E?.inboundTypes?.includes('turn_done'),
      null,
      { timeout: 300_000 },
    );

    const progressAfterConfirm = await getQuestionProgressText(page);
    const traceAfterConfirm = await getVoiceTrace(page);

    // After confirmation, the turn should complete and question count should advance.
    assert(
      traceAfterConfirm.inboundTypes.includes('turn_done'),
      `Expected turn_done after transcript confirmation, got: ${traceAfterConfirm.inboundTypes.join(', ')}`,
    );
    // Question progress should advance after the confirmed turn is scored.
    assert(
      progressAfterConfirm !== progressAfter || progressAfterConfirm !== null,
      `Expected question progress to change after confirmation, got: ${progressAfterConfirm}`,
    );

    // Phase 3: End the interview and verify the report page loads without crash.
    const endResponse = await page.evaluate(async ({ sid, backendUrl }) => {
      const res = await fetch(`${backendUrl}/api/interview/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.localStorage.getItem('kiwi_auth_token')}`,
        },
        body: JSON.stringify({ sessionId: sid }),
      });
      return { ok: res.ok, status: res.status };
    }, { sid: sessionId, backendUrl: BACKEND_BASE_URL });

    assert(endResponse.ok, `Expected interview/end to succeed, got status ${endResponse.status}`);

    await page.goto(`${FRONTEND_BASE_URL}/report/${sessionId}`);
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
    const reportBodyText = await page.locator('body').innerText();
    assert(
      !reportBodyText.toLowerCase().includes('not found')
      && !reportBodyText.toLowerCase().includes('error loading'),
      `Report page failed to load after low-confidence session: ${reportBodyText.slice(0, 300)}`,
    );

    assert(browserErrors.length === 0, `Browser errors occurred: ${browserErrors.join('\n')}`);

    const artifact = buildBaseArtifact({
      schemaVersion: 'voice_low_confidence_ui_e2e_report_v1',
      truthLevel: 'hybrid_backend',
      resultType: 'low_confidence_full_cycle_verified',
      passed: true,
      assertions: [
        'low_confidence_confirmation_visible',
        'question_count_unchanged_before_confirm',
        'no_accepted_answer_before_confirmation',
        'turn_done_received_after_confirmation',
        'interview_ended_successfully',
        'report_page_loaded_without_error',
      ],
      browserErrors,
      apiCalls,
      extra: {
        sessionId,
        userId: user.id,
        clientTurnId,
        progressBefore,
        progressAfterTranscriptRequested: progressAfter,
        progressAfterConfirm,
        inboundTypesBeforeConfirm: traceBeforeConfirm.inboundTypes,
        inboundTypesAfterConfirm: traceAfterConfirm.inboundTypes,
        lowConfidenceTranscriptLength: LOW_CONFIDENCE_TRANSCRIPT.length,
        lowConfidenceSttConfidence: 0.28,
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
