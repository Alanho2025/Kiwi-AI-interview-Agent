#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 4176);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3091);
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const BACKEND_API_BASE_URL = `${BACKEND_BASE_URL}/api`;
const USER_EMAIL = `voice-real-backend-${Date.now()}@example.test`;
const USER_NAME = 'Voice Real Backend Candidate';
const TEST_TRANSCRIPT = 'I built a duplex voice interview agent and measured latency from speech end to first audio.';
const E2E_JWT_SECRET = process.env.JWT_SECRET || 'voice-real-backend-e2e-secret';
const E2E_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'voice-real-backend-client';
const OUTPUT_ROOT = path.resolve(process.cwd(), '../output/playwright');
const ARTIFACT_PATH = path.join(OUTPUT_ROOT, 'voice-real-backend.latest.json');

process.env.JWT_SECRET = E2E_JWT_SECRET;
process.env.GOOGLE_CLIENT_ID = E2E_GOOGLE_CLIENT_ID;

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for the real-backend voice E2E. Original error: ${error.message}`, { cause: error });
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHttp = async (url, timeoutMs = 300_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const createPcmToneChunk = ({ sampleRate = 16000, durationMs = 80, amplitude = 0.28 } = {}) => {
  const sampleCount = Math.max(1, Math.round((sampleRate * durationMs) / 1000));
  const buffer = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const phase = (index / sampleRate) * Math.PI * 2 *  440;
    const value = Math.round(Math.sin(phase) * amplitude * 32767);
    buffer.writeInt16LE(value, index * 2);
  }
  return buffer;
};

const findFirstAudioAfterSpeechEnd = (events = []) => {
  const speechEndEvent = events.find((event) => event.direction === 'out' && event.type === 'speech_end');
  if (!speechEndEvent) return { speechEndEvent: null, firstAudioEvent: null, assistantFirstAudioMs: null };
  const audioEvents = events.filter((event) => (
    event.direction === 'in'
    && event.at >= speechEndEvent.at
    && ['tts_audio_chunk', 'audio_chunk'].includes(event.type)
  ));
  const firstAudioEvent = audioEvents[0] || null;
  return {
    speechEndEvent,
    firstAudioEvent,
    nextQuestionAudioEvent: audioEvents[1] || firstAudioEvent,
    assistantFirstAudioMs: firstAudioEvent ? Math.max(0, firstAudioEvent.at - speechEndEvent.at) : null,
    nextQuestionFirstAudioMs: audioEvents.length
      ? Math.max(0, (audioEvents[1] || firstAudioEvent).at - speechEndEvent.at)
      : null,
  };
};

const findTurnDoneAfterSpeechEnd = (events = [], speechEndEvent = null) => {
  if (!speechEndEvent) return null;
  const turnDoneEvent = events.find((event) => (
    event.direction === 'in'
    && event.type === 'turn_done'
    && event.at >= speechEndEvent.at
  ));
  return turnDoneEvent ? Math.max(0, turnDoneEvent.at - speechEndEvent.at) : null;
};

const getLatencyStepMs = (latency = null, stepName = '') => {
  const step = latency?.steps?.find((item) => item?.step === stepName || item?.name === stepName);
  if (Number.isFinite(Number(step?.msFromStart))) return Number(step.msFromStart);
  return null;
};

const dynamicImport = async (absolutePath) => import(pathToFileURL(absolutePath).href);

const seedBackendUser = async () => {
  const backendRoot = path.resolve(process.cwd(), '../backend');
  const { bootstrapPostgres } = await dynamicImport(path.join(backendRoot, 'src/db/bootstrap.js'));
  const { closePostgres } = await dynamicImport(path.join(backendRoot, 'src/db/postgres.js'));
  const { findOrCreateGoogleUser, CURRENT_PRIVACY_POLICY_VERSION } = await dynamicImport(path.join(backendRoot, 'src/services/authService.js'));
  const { generateAuthToken } = await dynamicImport(path.join(backendRoot, 'src/services/authTokenService.js'));

  await bootstrapPostgres({ required: true });
  const user = await findOrCreateGoogleUser({
    email: USER_EMAIL,
    name: USER_NAME,
    googleSub: `voice-real-backend-${Date.now()}`,
    termsAccepted: true,
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
  });
  const token = generateAuthToken(user.id);
  await closePostgres();
  return { user, token };
};

const startBackendServer = async () => {
  if (process.env.BACKEND_BASE_URL) {
    await waitForHttp(`${BACKEND_API_BASE_URL}/health`);
    return null;
  }

  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve(process.cwd(), '../backend'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      AI_TEST_MODE: 'mock',
      JWT_SECRET: E2E_JWT_SECRET,
      GOOGLE_CLIENT_ID: E2E_GOOGLE_CLIENT_ID,
      PORT: String(BACKEND_PORT),
      FRONTEND_ORIGIN: FRONTEND_BASE_URL,
      VOICE_STT_PROVIDER_ORDER: 'test',
      VOICE_TTS_PROVIDER_ORDER: 'test',
      TEST_REALTIME_STT_TRANSCRIPT: TEST_TRANSCRIPT,
      TEST_REALTIME_STT_CONFIDENCE: '0.93',
      TEST_TTS_FIRST_BYTE_DELAY_MS: '0',
      TEST_TTS_CHUNK_DELAY_MS: '0',
      POSTGRES_REQUIRED: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(`${BACKEND_API_BASE_URL}/health`);
  return child;
};

const startFrontendServer = async () => {
  if (process.env.FRONTEND_BASE_URL) {
    await waitForHttp(FRONTEND_BASE_URL);
    return null;
  }

  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(FRONTEND_PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_API_BASE_URL: BACKEND_BASE_URL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(FRONTEND_BASE_URL);
  return child;
};

const apiPost = async ({ endpoint, token, body }) => {
  const response = await fetch(`${BACKEND_API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`POST ${endpoint} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload.data || payload;
};

const createVoicePlan = async ({ token }) => {
  const jdRubric = {
    title: 'Frontend Voice Systems Engineer',
    jobOverview: {
      title: 'Frontend Voice Systems Engineer',
      companyName: 'Kiwi Voice E2E Ltd',
      location: 'Auckland',
    },
    sections: {
      responsibilities: ['Build realtime browser voice interview workflows'],
      mustHaveRequirements: ['React voice UX', 'WebSocket debugging', 'latency instrumentation'],
      niceToHaveRequirements: ['speech provider integration'],
      qualifications: [],
      softSkills: ['clear communication'],
      technicalSkills: {
        softwareDevelopment: [
          { label: 'React' },
          { label: 'WebSocket' },
          { label: 'Playwright' },
        ],
      },
    },
    diagnostics: {
      analysisMode: 'human_reviewed',
      confidence: 0.96,
      warnings: [],
      missingSections: [],
    },
    metadata: { inputTrustLevel: 'reviewed', confidence: 0.96 },
  };

  const analysisResult = {
    candidateName: USER_NAME,
    jobTitle: jdRubric.title,
    matchScore: 86,
    strengths: ['React voice UX', 'WebSocket instrumentation'],
    gaps: ['Azure Speech production hardening'],
    requirementChecks: [
      { requirement: 'React voice UX', met: true, category: 'technical', evidenceStrength: 'strong' },
      { requirement: 'latency instrumentation', met: true, category: 'technical', evidenceStrength: 'strong' },
    ],
    matchingDetails: {
      questionPlanHints: {
        priorityTopics: ['duplex voice orchestration', 'latency debugging'],
      },
    },
    parsedJdProfile: jdRubric,
  };

  const data = await apiPost({
    endpoint: '/analyze/interview-plan',
    token,
    body: {
      rawJD: 'Frontend Voice Systems Engineer role requiring React, WebSocket debugging, and voice latency instrumentation.',
      jdText: 'Frontend Voice Systems Engineer role requiring React, WebSocket debugging, and voice latency instrumentation.',
      jdRubric,
      settings: {
        seniorityLevel: 'Mid-level',
        focusArea: 'Technical',
        questionType: 'Technical',
        controlMode: 'question',
        questionLimit: 3,
        timeLimitMinutes: 30,
      },
      sessionSetup: {
        deliveryMode: 'voice',
        controlMode: 'question',
        questionLimit: 3,
        timeLimitMinutes: 30,
        questionType: 'Technical',
      },
      analysisResult,
      mode: 'voice',
    },
  });

  const sessionId = data.sessionId || data.session?.id;
  assert(sessionId, `Expected interview-plan to return a sessionId, got ${JSON.stringify(data)}`);
  return { sessionId, planResponse: data };
};

const installRealBackendVoiceDriver = async (context) => {
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__kiwiVoiceRealBackendE2E = {
      voiceSocket: null,
      events: [],
      outboundTypes: [],
      inboundTypes: [],
    };

    window.WebSocket = function WebSocketWithTrace(url, protocols) {
      const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
      if (String(url).includes('/voice/duplex')) {
        window.__kiwiVoiceRealBackendE2E.voiceSocket = socket;
        window.__kiwiVoiceRealBackendE2E.events.push({ direction: 'socket', type: 'constructed', url: String(url), at: performance.now() });
      }

      const recordInboundMessage = (event) => {
        let payloadType = 'unknown';
        try {
          const payload = JSON.parse(String(event.data || '{}'));
          payloadType = payload.type || 'json_without_type';
          window.__kiwiVoiceRealBackendE2E.events.push({
            direction: 'in',
            type: payloadType,
            text: payload.text || payload.displayText || payload.normalizedText || null,
            provider: payload.provider || payload.transcription?.asrSource || null,
            latency: payload.latency || null,
            at: performance.now(),
          });
        } catch {
          payloadType = 'unparseable_message';
        }
        window.__kiwiVoiceRealBackendE2E.inboundTypes.push(payloadType);
      };

      const nativeSend = socket.send.bind(socket);
      socket.send = (data) => {
        let type = 'binary_audio';
        if (typeof data === 'string') {
          try {
            type = JSON.parse(data).type || 'json_without_type';
          } catch {
            type = 'unparseable_json';
          }
        }
        window.__kiwiVoiceRealBackendE2E.outboundTypes.push(type);
        window.__kiwiVoiceRealBackendE2E.events.push({ direction: 'out', type, at: performance.now() });
        return nativeSend(data);
      };

      const nativeAddEventListener = socket.addEventListener.bind(socket);
      socket.addEventListener = (type, handler, options) => nativeAddEventListener(type, (event) => {
        if (type === 'message') {
          recordInboundMessage(event);
        }
        return handler(event);
      }, options);

      nativeAddEventListener('message', recordInboundMessage);

      return socket;
    };

    window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    window.WebSocket.OPEN = NativeWebSocket.OPEN;
    window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
    window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
  });
};

const driveVoiceTurnThroughRealSocket = async (page) => {
  const clientTurnId = `voice-real-backend-e2e-${Date.now()}`;
  const pcmChunk = createPcmToneChunk();
  await page.waitForFunction(() => window.__kiwiVoiceRealBackendE2E?.voiceSocket?.readyState === WebSocket.OPEN, null, { timeout: 15000 });
  await page.waitForFunction(() => window.__kiwiVoiceRealBackendE2E?.inboundTypes?.includes('session_ready'), null, { timeout: 15000 });
  await page.evaluate(({ clientTurnId: turnId, audioBytes }) => {
    const socket = window.__kiwiVoiceRealBackendE2E.voiceSocket;
    socket.send(JSON.stringify({ type: 'speech_start', clientTurnId: turnId, clientTimestamp: Date.now() }));
    for (let index = 0; index < 8; index += 1) {
      socket.send(Uint8Array.from(audioBytes).buffer);
    }
    socket.send(JSON.stringify({
      type: 'speech_end',
      clientTurnId: turnId,
      reason: 'voice_real_backend_e2e',
      vad: {
        speechDurationMs: 3200,
        silenceDurationMs: 1900,
        sttSource: 'e2e_real_backend_pcm',
      },
    }));
  }, { clientTurnId, audioBytes: [...pcmChunk] });
  return clientTurnId;
};

const run = async () => {
  const { chromium } = loadPlaywright();
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  let backendServer = null;
  let frontendServer = null;
  let browser = null;
  const apiCalls = [];
  const browserErrors = [];

  try {
    const { token, user } = await seedBackendUser();
    backendServer = await startBackendServer();
    const { sessionId } = await createVoicePlan({ token });
    frontendServer = await startFrontendServer();

    browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 920 },
      permissions: ['microphone'],
    });
    await context.addInitScript((authToken) => window.localStorage.setItem('kiwi_auth_token', authToken), token);
    await installRealBackendVoiceDriver(context);

    const page = await context.newPage();
    page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error') browserErrors.push(`[console.error] ${text}`);
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        apiCalls.push({ method: request.method(), path: url.pathname, phase: 'request' });
      }
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/')) {
        apiCalls.push({ method: response.request().method(), path: url.pathname, phase: 'response', status: response.status() });
      }
      if (response.status() >= 400) {
        browserErrors.push(`[response] ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`${FRONTEND_BASE_URL}/interview/${sessionId}`);
    await page.getByText('Voice practice mode').waitFor({ timeout: 150_000 });
    await page.getByRole('button', { name: /Start voice interview/i }).click();

    const clientTurnId = await driveVoiceTurnThroughRealSocket(page);
    await page.waitForFunction(() => window.__kiwiVoiceRealBackendE2E?.inboundTypes?.includes('stt_final'), null, { timeout: 300_000 });
    await page.waitForFunction(() => window.__kiwiVoiceRealBackendE2E?.inboundTypes?.includes('turn_done'), null, { timeout: 300_000 });
    await page.getByText(TEST_TRANSCRIPT).first().waitFor({ timeout: 30_000 });

    const result = await page.evaluate(() => {
      const state = window.__kiwiVoiceRealBackendE2E || {};
      const turnDoneEvent = [...(state.events || [])].reverse().find((event) => event.type === 'turn_done');
      return {
        outboundTypes: state.outboundTypes || [],
        inboundTypes: state.inboundTypes || [],
        events: (state.events || []).map((event) => ({
          direction: event.direction,
          type: event.type,
          provider: event.provider || null,
          text: event.text || null,
          latency: event.latency || null,
          at: Math.round(event.at || 0),
        })),
        turnDoneEvent,
      };
    });

    assert(result.outboundTypes.includes('session_start'), `Expected frontend to send session_start, got ${result.outboundTypes.join(', ')}`);
    assert(result.outboundTypes.includes('speak_text'), `Expected frontend to send speak_text, got ${result.outboundTypes.join(', ')}`);
    assert(result.outboundTypes.includes('speech_start'), `Expected voice driver to send speech_start, got ${result.outboundTypes.join(', ')}`);
    assert(result.outboundTypes.includes('speech_end'), `Expected voice driver to send speech_end, got ${result.outboundTypes.join(', ')}`);
    assert(result.outboundTypes.includes('binary_audio'), `Expected voice driver to send PCM audio chunks, got ${result.outboundTypes.join(', ')}`);
    assert(result.inboundTypes.includes('stt_final'), `Expected real backend STT final event, got ${result.inboundTypes.join(', ')}`);
    assert(result.inboundTypes.includes('turn_done'), `Expected real backend turn_done event, got ${result.inboundTypes.join(', ')}`);
    assert(!result.events.some((event) => event.provider && String(event.provider).includes('fallback')), 'Voice real-backend E2E unexpectedly used a fallback STT provider.');

    const requiredCalls = [
      'GET /api/auth/me',
      `GET /api/session/${sessionId}`,
      'POST /api/interview/start',
      'POST /api/interview/warm-adaptive',
    ];
    const callSet = new Set(apiCalls.map((call) => `${call.method} ${call.path}`));
    const missingCalls = requiredCalls.filter((call) => !callSet.has(call));
    assert(missingCalls.length === 0, `Missing real backend API calls: ${missingCalls.join(', ')}`);

    const audioTiming = findFirstAudioAfterSpeechEnd(result.events);
    const turnDoneMs = findTurnDoneAfterSpeechEnd(result.events, audioTiming.speechEndEvent);
    const backendNextQuestionFirstAudioMs = getLatencyStepMs(result.turnDoneEvent?.latency, 'first_audio_sent');
    const nextQuestionFirstAudioMs = Number.isFinite(backendNextQuestionFirstAudioMs)
      ? backendNextQuestionFirstAudioMs
      : audioTiming.nextQuestionFirstAudioMs;
    const summary = {
      schemaVersion: 'voice_flow_e2e_report_v1',
      generatedAt: new Date().toISOString(),
      passed: true,
      resultType: 'real_backend_voice_browser_flow',
      fallbackResult: false,
      aiMode: 'mock',
      speechProviders: ['test_realtime_stt', 'test_tts'],
      backendBaseUrl: BACKEND_BASE_URL,
      frontendBaseUrl: FRONTEND_BASE_URL,
      sessionId,
      userId: user.id,
      clientTurnId,
      assistantFirstAudioMs: Number.isFinite(audioTiming.assistantFirstAudioMs) ? audioTiming.assistantFirstAudioMs : null,
      nextQuestionFirstAudioMs: Number.isFinite(nextQuestionFirstAudioMs) ? nextQuestionFirstAudioMs : null,
      turnDoneMs: Number.isFinite(turnDoneMs) ? turnDoneMs : null,
      nextQuestionThreeSecondSloMet: Number.isFinite(nextQuestionFirstAudioMs)
        ? nextQuestionFirstAudioMs <= 3000
        : null,
      requiredCalls,
      outboundTypes: result.outboundTypes,
      inboundTypes: result.inboundTypes,
      apiCallCount: apiCalls.length,
      browserErrors,
    };

    await fs.writeFile(ARTIFACT_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser?.close?.();
    frontendServer?.kill?.('SIGTERM');
    backendServer?.kill?.('SIGTERM');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
