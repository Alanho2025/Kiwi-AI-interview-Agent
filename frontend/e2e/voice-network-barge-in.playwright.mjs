#!/usr/bin/env node

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
  findFirstAudioAfterSpeechEnd,
  findTurnDoneAfterSpeechEnd,
  getLatencyStepMs,
  getVoiceTrace,
  installVoiceSocketTrace,
  loadPlaywright,
  sendBargeInDuringAssistantSpeech,
} from './helpers/e2eVoiceHarness.mjs';

const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3095);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4180);
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${FRONTEND_PORT}`;
const ARTIFACT_FILENAME = 'voice-network-barge-in.latest.json';
const TEST_TRANSCRIPT = 'I built the browser voice workflow, verified WebSocket timing under slower network conditions, and captured latency telemetry for each interview turn.';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const enableBoundedSlowNetwork = async ({ context, page }) => {
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 320,
    downloadThroughput: 96 * 1024,
    uploadThroughput: 48 * 1024,
  });
  return {
    tool: 'CDP Network.emulateNetworkConditions',
    latencyMs: 320,
    downloadThroughputBytesPerSecond: 96 * 1024,
    uploadThroughputBytesPerSecond: 48 * 1024,
    packetLoss: 'not_emulated_in_default_gate',
  };
};

const buildFailureArtifact = ({ error, apiCalls, browserErrors }) => buildBaseArtifact({
  schemaVersion: 'voice_network_barge_in_e2e_report_v1',
  truthLevel: 'hybrid_backend',
  resultType: 'voice_network_barge_in_failed',
  passed: false,
  blockers: ['voice_flow_failed'],
  assertions: [],
  browserErrors,
  apiCalls,
  extra: { error: error?.message || String(error) },
});

const run = async () => {
  const { chromium } = loadPlaywright();
  configureE2eAuthEnv({
    jwtSecret: 'voice-network-barge-in-e2e-secret',
    googleClientId: 'voice-network-barge-in-client',
  });

  const apiCalls = [];
  const browserErrors = [];
  let backendServer = null;
  let frontendServer = null;
  let browser = null;

  try {
    const { token, user } = await seedSyntheticUser({
      emailPrefix: 'voice-network-barge-in',
      name: 'Voice Network Candidate',
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
        TEST_REALTIME_STT_CONFIDENCE: '0.93',
        TEST_TTS_FIRST_BYTE_DELAY_MS: '5000',
        TEST_TTS_CHUNK_DELAY_MS: '350',
      },
    });

    const { sessionId } = await createVoiceInterviewPlan({
      backendBaseUrl: BACKEND_BASE_URL,
      token,
      apiCalls,
      jdFingerprint: 'voice-network-barge-in-role-fit',
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
    const networkProfile = await enableBoundedSlowNetwork({ context, page });
    await page.getByRole('button', { name: /Start voice interview/i }).click();

    await sendBargeInDuringAssistantSpeech({ page });
    const traceAfterBargeIn = await getVoiceTrace(page);
    const bargeInAck = traceAfterBargeIn.events.find((event) => event.type === 'barge_in_ack');
    assert(bargeInAck?.interrupted === true, `Expected interrupted barge_in_ack, got ${JSON.stringify(bargeInAck)}`);

    const clientTurnId = await driveVoiceTurnThroughSocket({ page, speechDurationMs: 4200, audioChunks: 8 });
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.inboundTypes?.includes('stt_final'), null, { timeout: 300_000 });
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.inboundTypes?.includes('turn_done'), null, { timeout: 300_000 });
    await page.getByText(TEST_TRANSCRIPT).first().waitFor({ timeout: 30_000 });

    const trace = await getVoiceTrace(page);
    const audioTiming = findFirstAudioAfterSpeechEnd(trace.events);
    const turnDoneMs = findTurnDoneAfterSpeechEnd(trace.events, audioTiming.speechEndEvent);
    const turnDoneEvent = [...trace.events].reverse().find((event) => event.type === 'turn_done');
    const backendNextQuestionFirstAudioMs = getLatencyStepMs(turnDoneEvent?.latency, 'first_audio_sent');
    const nextQuestionFirstAudioMs = Number.isFinite(backendNextQuestionFirstAudioMs)
      ? backendNextQuestionFirstAudioMs
      : audioTiming.nextQuestionFirstAudioMs;
    const knownIssues = Number.isFinite(nextQuestionFirstAudioMs) && nextQuestionFirstAudioMs > 3000
      ? ['voice_next_question_3s_slo_exceeded']
      : [];

    assert(trace.inboundTypes.includes('barge_in_ack'), `Expected barge_in_ack, got ${trace.inboundTypes.join(', ')}`);
    assert(trace.inboundTypes.includes('turn_done'), `Expected turn_done, got ${trace.inboundTypes.join(', ')}`);
    assert(Number.isFinite(turnDoneMs), 'Expected measured turn_done latency after speech_end.');
    assert(browserErrors.length === 0, `Browser errors occurred: ${browserErrors.join('\n')}`);

    const artifact = buildBaseArtifact({
      schemaVersion: 'voice_network_barge_in_e2e_report_v1',
      truthLevel: 'hybrid_backend',
      resultType: 'voice_network_barge_in_recoverable',
      passed: true,
      assertions: [
        'bounded_slow_network_completed',
        'barge_in_acknowledged',
        'voice_turn_completed_after_barge_in',
      ],
      knownIssues,
      browserErrors,
      apiCalls,
      extra: {
        sessionId,
        userId: user.id,
        clientTurnId,
        networkProfile,
        bargeInAck,
        nextQuestionFirstAudioMs: Number.isFinite(nextQuestionFirstAudioMs) ? nextQuestionFirstAudioMs : null,
        turnDoneMs,
        nextQuestionThreeSecondSloMet: Number.isFinite(nextQuestionFirstAudioMs) ? nextQuestionFirstAudioMs <= 3000 : null,
        inboundTypes: trace.inboundTypes,
        outboundTypes: trace.outboundTypes,
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
