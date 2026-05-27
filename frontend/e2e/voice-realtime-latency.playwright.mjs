#!/usr/bin/env node
/**
 * Browser smoke for duplex Voice Mode latency:
 * authenticated interview screen -> start voice session -> mocked duplex WebSocket exchange
 * -> assistant audio starts -> mocked STT/turn_done -> latency summary observed.
 *
 * This is deterministic by design. It does not call Azure, use a real microphone, or depend on
 * a real backend WebSocket because those make CI and local smoke tests flaky.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const SESSION_ID = 'session-voice-latency-1';
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4173);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for this voice latency smoke. Original error: ${error.message}`);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHttp = async (url, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for frontend server at ${url}`);
};

const startFrontendServer = async () => {
  if (process.env.FRONTEND_BASE_URL) {
    await waitForHttp(BASE_URL);
    return null;
  }

  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_API_BASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(BASE_URL);
  return child;
};

const jsonResponse = (data, status = 200) => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
});

const success = (data = {}, message = 'ok') => ({
  success: true,
  message,
  data,
  error: null,
});

const buildSession = (overrides = {}) => ({
  id: SESSION_ID,
  status: 'in_progress',
  mode: 'voice',
  candidateName: 'Latency Candidate',
  targetRole: 'AI Engineer',
  totalQuestions: 2,
  currentQuestionIndex: 1,
  elapsedSeconds: 0,
  transcript: [{
    role: 'ai',
    text: 'Tell me about an AI interview agent you built.',
    displayText: 'Tell me about an AI interview agent you built.',
    timestamp: new Date().toISOString(),
    metadata: { questionType: 'technical_core' },
  }],
  interviewPlan: {
    questionPool: [{ text: 'Tell me about an AI interview agent you built.', topic: 'ai-agent' }],
  },
  ...overrides,
});

const buildTurnDoneSession = () => buildSession({
  currentQuestionIndex: 2,
  transcript: [
    {
      role: 'ai',
      text: 'Tell me about an AI interview agent you built.',
      displayText: 'Tell me about an AI interview agent you built.',
      timestamp: new Date().toISOString(),
      metadata: { questionType: 'technical_core' },
    },
    {
      role: 'user',
      text: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
      displayText: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
      timestamp: new Date().toISOString(),
      metadata: { asrSource: 'mock_playwright' },
    },
    {
      role: 'ai',
      text: 'What did you do to keep the latency acceptable?',
      displayText: 'What did you do to keep the latency acceptable?',
      timestamp: new Date().toISOString(),
      metadata: { questionType: 'technical_follow_up' },
    },
  ],
});

const installApiMocks = async (page) => {
  const apiCalls = [];
  let session = buildSession();

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    apiCalls.push({ method, path: url.pathname });

    if (method === 'GET' && url.pathname === '/api/auth/google/config') {
      await route.fulfill(jsonResponse(success({ clientId: 'voice-latency-client' })));
      return;
    }

    if (method === 'GET' && url.pathname === '/api/auth/me') {
      await route.fulfill(jsonResponse(success({ user: { id: 'user-voice-latency', email: 'voice@example.test' } })));
      return;
    }

    if (method === 'GET' && url.pathname === '/api/usage/summary') {
      await route.fulfill(jsonResponse(success({ totalCost: 0, totalTokens: 0, providerBreakdown: [] })));
      return;
    }

    if (method === 'GET' && url.pathname === '/api/usage/recent-sessions') {
      await route.fulfill(jsonResponse(success({ sessions: [] })));
      return;
    }

    if (method === 'GET' && url.pathname === '/api/session/history') {
      await route.fulfill(jsonResponse(success({ sessions: [session] })));
      return;
    }

    if (method === 'GET' && url.pathname === `/api/session/${SESSION_ID}`) {
      await route.fulfill(jsonResponse(success({ session })));
      return;
    }

    if (method === 'POST' && url.pathname === '/api/interview/warm-adaptive') {
      await route.fulfill(jsonResponse(success({ warmed: true })));
      return;
    }

    if (method === 'POST' && url.pathname === '/api/interview/pause') {
      await route.fulfill(jsonResponse(success({ session: { ...session, status: 'paused' } })));
      return;
    }

    if (method === 'POST' && url.pathname === '/api/interview/resume') {
      await route.fulfill(jsonResponse(success({ session }))); 
      return;
    }

    if (method === 'POST' && url.pathname === '/api/interview/end') {
      session = buildSession({ ...session, status: 'completed' });
      await route.fulfill(jsonResponse(success({ session, reportStatus: 'ready' })));
      return;
    }

    if (method === 'GET' && url.pathname === `/api/recordings/session-audio/${SESSION_ID}/status`) {
      await route.fulfill(jsonResponse(success({ available: false, status: 'missing' })));
      return;
    }

    await route.fulfill(jsonResponse({ success: false, message: `Unhandled mock route: ${method} ${url.pathname}` }, 404));
  });

  return apiCalls;
};

const installBrowserVoiceMocks = async (context) => {
  await context.addInitScript(({ sessionId }) => {
    const NativeWebSocket = window.WebSocket;
    window.__kiwiVoiceE2E = {
      events: [],
      wsSent: [],
      latencySummaries: [],
      assistantFirstAudioMs: null,
      turnDoneMs: null,
      sessionReady: false,
      assistantPromptSeen: false,
      turnDone: false,
    };

    const originalPlay = window.HTMLMediaElement?.prototype?.play;
    const originalPause = window.HTMLMediaElement?.prototype?.pause;
    if (window.HTMLMediaElement?.prototype) {
      window.HTMLMediaElement.prototype.play = function playMock() {
        window.__kiwiVoiceE2E.events.push({ type: 'audio_play_called', at: performance.now() });
        window.setTimeout(() => {
          this.dispatchEvent(new Event('ended'));
        }, 20);
        return Promise.resolve();
      };
      window.HTMLMediaElement.prototype.pause = function pauseMock() {
        window.__kiwiVoiceE2E.events.push({ type: 'audio_pause_called', at: performance.now() });
        return originalPause?.call?.(this);
      };
      window.__kiwiVoiceE2E.restoreAudio = () => {
        if (originalPlay) window.HTMLMediaElement.prototype.play = originalPlay;
      };
    }

    const buildTurnDoneSession = () => ({
      id: sessionId,
      status: 'in_progress',
      mode: 'voice',
      candidateName: 'Latency Candidate',
      targetRole: 'AI Engineer',
      totalQuestions: 2,
      currentQuestionIndex: 2,
      elapsedSeconds: 12,
      transcript: [
        {
          role: 'ai',
          text: 'Tell me about an AI interview agent you built.',
          displayText: 'Tell me about an AI interview agent you built.',
          timestamp: new Date().toISOString(),
          metadata: { questionType: 'technical_core' },
        },
        {
          role: 'user',
          text: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
          displayText: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
          timestamp: new Date().toISOString(),
          metadata: { asrSource: 'mock_playwright' },
        },
        {
          role: 'ai',
          text: 'What did you do to keep the latency acceptable?',
          displayText: 'What did you do to keep the latency acceptable?',
          timestamp: new Date().toISOString(),
          metadata: { questionType: 'technical_follow_up' },
        },
      ],
    });

    class MockVoiceWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = String(url);
        this.readyState = MockVoiceWebSocket.CONNECTING;
        this.binaryType = 'blob';
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this.createdAt = performance.now();
        window.__kiwiVoiceE2E.events.push({ type: 'ws_constructed', url: this.url, at: this.createdAt });
        window.setTimeout(() => {
          this.readyState = MockVoiceWebSocket.OPEN;
          this.onopen?.(new Event('open'));
        }, 5);
      }

      addEventListener(type, handler) {
        this[`on${type}`] = handler;
      }

      removeEventListener(type) {
        this[`on${type}`] = null;
      }

      dispatchServer(payload, delayMs = 0) {
        window.setTimeout(() => {
          window.__kiwiVoiceE2E.events.push({ type: `server_${payload.type}`, payload, at: performance.now() });
          this.onmessage?.({ data: JSON.stringify(payload) });
        }, delayMs);
      }

      send(data) {
        window.__kiwiVoiceE2E.wsSent.push(data);
        let payload = null;
        if (typeof data === 'string') {
          try { payload = JSON.parse(data); } catch {}
        }
        if (!payload) return;

        window.__kiwiVoiceE2E.events.push({ type: `client_${payload.type}`, payload, at: performance.now() });

        if (payload.type === 'session_start') {
          this.dispatchServer({
            type: 'session_ready',
            sessionId,
            language: payload.language || 'en-NZ',
            sampleRate: payload.sampleRate || 16000,
            timestamp: new Date().toISOString(),
          }, 10);
          window.__kiwiVoiceE2E.sessionReady = true;
          return;
        }

        if (payload.type === 'speak_text') {
          window.__kiwiVoiceE2E.assistantPromptSeen = true;
          this.dispatchServer({
            type: 'assistant_text_delta',
            text: payload.text,
            index: payload.index || 0,
            timestamp: new Date().toISOString(),
          }, 20);
          this.dispatchServer({
            type: 'tts_audio_chunk',
            base64: 'AAAA',
            contentType: 'audio/mpeg',
            index: 0,
            timestamp: new Date().toISOString(),
          }, 45);
          window.setTimeout(() => {
            window.__kiwiVoiceE2E.assistantFirstAudioMs = Math.round(performance.now() - this.createdAt);
          }, 45);
          this.dispatchServer({
            type: 'assistant_speech_done',
            timestamp: new Date().toISOString(),
          }, 80);
          this.dispatchServer({
            type: 'stt_final',
            displayText: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
            normalizedText: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
            rawText: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
            confidence: 0.91,
            provider: 'mock_playwright',
            timestamp: new Date().toISOString(),
          }, 140);
          this.dispatchServer({
            type: 'turn_done',
            transcription: {
              text: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
              displayText: 'I built a duplex voice interview agent and measured latency from speech end to first audio.',
              confidence: 0.91,
              asrSource: 'mock_playwright',
            },
            session: buildTurnDoneSession(),
            isComplete: false,
            latency: {
              name: 'mock_duplex_turn',
              totalMs: 420,
              steps: [
                { step: 'stt_final_received', msFromStart: 140 },
                { step: 'agent_decision_start', msFromStart: 210 },
                { step: 'tts_first_audio', msFromStart: 420 },
              ],
            },
            timestamp: new Date().toISOString(),
          }, 190);
          window.setTimeout(() => {
            window.__kiwiVoiceE2E.turnDone = true;
            window.__kiwiVoiceE2E.turnDoneMs = Math.round(performance.now() - this.createdAt);
          }, 190);
          return;
        }

        if (payload.type === 'ping') {
          this.dispatchServer({ type: 'pong', clientTimestamp: payload.clientTimestamp, timestamp: new Date().toISOString() }, 5);
        }
      }

      close() {
        this.readyState = MockVoiceWebSocket.CLOSED;
        this.onclose?.(new CloseEvent('close'));
      }
    }

    MockVoiceWebSocket.prototype.CONNECTING = MockVoiceWebSocket.CONNECTING;
    MockVoiceWebSocket.prototype.OPEN = MockVoiceWebSocket.OPEN;
    MockVoiceWebSocket.prototype.CLOSING = MockVoiceWebSocket.CLOSING;
    MockVoiceWebSocket.prototype.CLOSED = MockVoiceWebSocket.CLOSED;

    window.WebSocket = function WebSocketFactory(url, protocols) {
      if (String(url).includes('/voice/duplex')) return new MockVoiceWebSocket(url);
      return new NativeWebSocket(url, protocols);
    };
    window.WebSocket.CONNECTING = MockVoiceWebSocket.CONNECTING;
    window.WebSocket.OPEN = MockVoiceWebSocket.OPEN;
    window.WebSocket.CLOSING = MockVoiceWebSocket.CLOSING;
    window.WebSocket.CLOSED = MockVoiceWebSocket.CLOSED;
  }, { sessionId: SESSION_ID });
};

const run = async () => {
  const { chromium } = loadPlaywright();
  const server = await startFrontendServer();
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 920 },
      permissions: ['microphone'],
    });
    await context.addInitScript(() => {
      window.localStorage.setItem('kiwi_auth_token', 'voice-latency-token');
    });
    await installBrowserVoiceMocks(context);

    const page = await context.newPage();
    const latencyConsoleMessages = [];
    const errors = [];

    page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`));
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[voice-latency] target') || text.includes('[voice-latency:debug]')) {
        latencyConsoleMessages.push(text);
      }
      if (['error', 'warning'].includes(message.type())) errors.push(`[browser ${message.type()}] ${text}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`[browser response] ${response.status()} ${response.url()}`);
    });

    const apiCalls = await installApiMocks(page);

    await page.goto(`${BASE_URL}/interview/${SESSION_ID}`);
    await page.getByText('Voice practice mode').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Start voice interview/i }).click();

    await page.waitForFunction(() => window.__kiwiVoiceE2E?.sessionReady === true, null, { timeout: 10000 });
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.assistantPromptSeen === true, null, { timeout: 10000 });
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.turnDone === true, null, { timeout: 10000 });

    await page.getByText('What did you do to keep the latency acceptable?').waitFor({ timeout: 10000 });

    const result = await page.evaluate(() => ({
      events: window.__kiwiVoiceE2E.events.map((event) => ({ type: event.type, at: Math.round(event.at || 0) })),
      assistantFirstAudioMs: window.__kiwiVoiceE2E.assistantFirstAudioMs,
      turnDoneMs: window.__kiwiVoiceE2E.turnDoneMs,
      sentMessageTypes: window.__kiwiVoiceE2E.wsSent
        .map((item) => {
          if (typeof item !== 'string') return 'binary_audio';
          try { return JSON.parse(item).type; } catch { return 'unknown_json'; }
        })
        .filter(Boolean),
    }));

    if (!Number.isFinite(result.assistantFirstAudioMs) || result.assistantFirstAudioMs <= 0) {
      throw new Error(`Expected assistantFirstAudioMs to be measured, got ${result.assistantFirstAudioMs}`);
    }
    if (!Number.isFinite(result.turnDoneMs) || result.turnDoneMs <= result.assistantFirstAudioMs) {
      throw new Error(`Expected turnDoneMs > assistantFirstAudioMs, got ${JSON.stringify(result)}`);
    }
    if (!latencyConsoleMessages.length) {
      throw new Error('Expected frontend voice latency summary console output to be recorded.');
    }
    if (!result.sentMessageTypes.includes('session_start') || !result.sentMessageTypes.includes('speak_text')) {
      throw new Error(`Expected voice WebSocket session_start and speak_text, got ${result.sentMessageTypes.join(', ')}`);
    }

    const requiredCalls = [
      'GET /api/auth/me',
      `GET /api/session/${SESSION_ID}`,
      'POST /api/interview/warm-adaptive',
    ];
    const callSet = new Set(apiCalls.map((item) => `${item.method} ${item.path}`));
    const missing = requiredCalls.filter((item) => !callSet.has(item));
    if (missing.length) throw new Error(`Voice latency flow missed expected API calls: ${missing.join(', ')}`);

    console.log(JSON.stringify({
      passed: true,
      assistantFirstAudioMs: result.assistantFirstAudioMs,
      turnDoneMs: result.turnDoneMs,
      latencyConsoleMessages: latencyConsoleMessages.length,
      sentMessageTypes: result.sentMessageTypes,
      requiredCalls,
      browserWarningsOrErrors: errors,
    }, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
