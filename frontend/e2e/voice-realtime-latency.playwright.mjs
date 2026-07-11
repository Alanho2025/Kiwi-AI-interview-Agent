#!/usr/bin/env node
/**
 * Deterministic browser smoke for duplex Voice Mode latency.
 *
 * It verifies the browser orchestration path without Azure, a real backend WebSocket,
 * or a real microphone. This keeps the test stable while still checking that voice
 * mode can start, receive assistant speech, receive a transcript, process turn_done,
 * and emit latency instrumentation.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const SESSION_ID = 'session-voice-latency-1';
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4173);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;
const FIRST_QUESTION = 'Tell me about an AI interview agent you built.';
const USER_ANSWER = 'I built a duplex voice interview agent and measured latency from speech end to first audio.';
const FOLLOW_UP = 'What did you do to keep the latency acceptable?';
const OUTPUT_ROOT = path.resolve(process.cwd(), '../output/playwright');
const ARTIFACT_PATH = path.join(OUTPUT_ROOT, 'voice-realtime-latency.latest.json');

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
    env: { ...process.env, VITE_API_BASE_URL: '' },
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

const success = (data = {}, message = 'ok') => ({ success: true, message, data, error: null });

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
    text: FIRST_QUESTION,
    displayText: FIRST_QUESTION,
    timestamp: new Date().toISOString(),
    metadata: { questionType: 'technical_core' },
  }],
  interviewPlan: {
    questionPool: [{ text: FIRST_QUESTION, topic: 'ai-agent' }],
  },
  ...overrides,
});

const buildTurnDoneSession = () => buildSession({
  currentQuestionIndex: 2,
  elapsedSeconds: 12,
  transcript: [
    {
      role: 'ai',
      text: FIRST_QUESTION,
      displayText: FIRST_QUESTION,
      timestamp: new Date().toISOString(),
      metadata: { questionType: 'technical_core' },
    },
    {
      role: 'user',
      text: USER_ANSWER,
      displayText: USER_ANSWER,
      timestamp: new Date().toISOString(),
      metadata: { asrSource: 'mock_playwright' },
    },
    {
      role: 'ai',
      text: FOLLOW_UP,
      displayText: FOLLOW_UP,
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
    if (method === 'POST' && url.pathname === '/api/recordings/session-audio/uploads') {
      await route.fulfill(jsonResponse(success({ uploadId: 'voice-smoke-upload', state: 'receiving' })));
      return;
    }
    if (method === 'PUT' && url.pathname.startsWith('/api/recordings/session-audio/uploads/voice-smoke-upload/chunks/')) {
      await route.fulfill(jsonResponse(success({ uploadId: 'voice-smoke-upload', state: 'receiving' })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/recordings/session-audio/uploads/voice-smoke-upload/finalize') {
      await route.fulfill(jsonResponse(success({ uploadId: 'voice-smoke-upload', state: 'queued' })));
      return;
    }

    await route.fulfill(jsonResponse({ success: false, message: `Unhandled mock route: ${method} ${url.pathname}` }, 404));
  });

  return apiCalls;
};

const installBrowserVoiceMocks = async (context) => {
  await context.addInitScript(({ sessionId, userAnswer, followUp }) => {
    const NativeWebSocket = window.WebSocket;
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;

    window.__kiwiVoiceE2E = {
      events: [],
      wsSent: [],
      assistantFirstAudioMs: null,
      turnDoneMs: null,
      sessionReady: false,
      assistantPromptSeen: false,
      speechEndReceived: false,
      turnDone: false,
      vadSimStart: null,
    };

    // Override AudioContext to capture when VAD starts monitoring
    window.AudioContext = window.webkitAudioContext = function AudioContextMock(...args) {
      const ctx = new NativeAudioContext(...args);
      window.__kiwiVoiceE2E.events.push({ type: 'audio_context_created', at: performance.now() });
      window.__kiwiVoiceE2E.vadSimStart = performance.now();
      
      const originalResume = ctx.resume;
      ctx.resume = function resumeMock() {
        window.__kiwiVoiceE2E.vadSimStart = performance.now();
        return originalResume.apply(this, arguments);
      };
      return ctx;
    };

    // Override AnalyserNode.prototype.getByteTimeDomainData to simulate speech and silence
    if (window.AnalyserNode?.prototype) {
      window.AnalyserNode.prototype.getByteTimeDomainData = function getByteTimeDomainDataMock(array) {
        if (!window.__kiwiVoiceE2E.vadSimStart) {
          array.fill(128);
          return;
        }
        const elapsed = performance.now() - window.__kiwiVoiceE2E.vadSimStart;
        if (elapsed < 1500) {
          // 0.0s to 1.5s: Silence
          array.fill(128);
        } else if (elapsed < 5000) {
          // 1.5s to 5.0s: Speech (alternating values to produce RMS > 0.05)
          for (let i = 0; i < array.length; i++) {
            array[i] = i % 2 === 0 ? 116 : 140;
          }
        } else {
          // 5.0s onwards: Silence again to trigger speech_end
          array.fill(128);
        }
      };
    }

    if (window.HTMLMediaElement?.prototype) {
      const originalPause = window.HTMLMediaElement.prototype.pause;
      window.HTMLMediaElement.prototype.play = function playMock() {
        window.__kiwiVoiceE2E.events.push({ type: 'audio_play_called', at: performance.now() });
        window.setTimeout(() => this.dispatchEvent(new Event('ended')), 20);
        return Promise.resolve();
      };
      window.HTMLMediaElement.prototype.pause = function pauseMock() {
        window.__kiwiVoiceE2E.events.push({ type: 'audio_pause_called', at: performance.now() });
        return originalPause?.call?.(this);
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
        { role: 'ai', text: 'Tell me about an AI interview agent you built.', displayText: 'Tell me about an AI interview agent you built.', timestamp: new Date().toISOString() },
        { role: 'user', text: userAnswer, displayText: userAnswer, timestamp: new Date().toISOString(), metadata: { asrSource: 'mock_playwright' } },
        { role: 'ai', text: followUp, displayText: followUp, timestamp: new Date().toISOString(), metadata: { questionType: 'technical_follow_up' } },
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
        this.binaryType = 'arraybuffer';
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this.createdAt = performance.now();
        window.__kiwiVoiceE2E.voiceSocket = this;
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
          window.__kiwiVoiceE2E.events.push({ type: `server_${payload.type}`, at: performance.now() });
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

        window.__kiwiVoiceE2E.events.push({ type: `client_${payload.type}`, at: performance.now() });

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
          this.dispatchServer({ type: 'assistant_text_delta', text: payload.text, index: payload.index || 0, timestamp: new Date().toISOString() }, 20);
          this.dispatchServer({ type: 'tts_audio_chunk', base64: 'AAAA', contentType: 'audio/mpeg', index: 0, timestamp: new Date().toISOString() }, 45);
          this.dispatchServer({ type: 'assistant_speech_done', timestamp: new Date().toISOString() }, 80);
          return;
        }

        if (payload.type === 'speech_start') {
          // Registered client speech start
          return;
        }

        if (payload.type === 'speech_end') {
          const speechEndAt = performance.now();
          window.__kiwiVoiceE2E.speechEndReceived = true;

          // Dispatch AI responses dynamically after user finished speaking (duplex turn)
          this.dispatchServer({
            type: 'assistant_text_delta',
            text: followUp,
            index: 0,
            timestamp: new Date().toISOString()
          }, 100);

          this.dispatchServer({
            type: 'tts_audio_chunk',
            base64: 'AAAA',
            contentType: 'audio/mpeg',
            index: 0,
            timestamp: new Date().toISOString()
          }, 150);

          window.setTimeout(() => {
            window.__kiwiVoiceE2E.assistantFirstAudioMs = Math.round(performance.now() - speechEndAt);
          }, 150);

          this.dispatchServer({
            type: 'assistant_speech_done',
            timestamp: new Date().toISOString()
          }, 200);

          this.dispatchServer({
            type: 'stt_final',
            displayText: userAnswer,
            normalizedText: userAnswer,
            rawText: userAnswer,
            confidence: 0.91,
            provider: 'mock_playwright',
            timestamp: new Date().toISOString(),
          }, 250);

          this.dispatchServer({
            type: 'turn_done',
            transcription: { text: userAnswer, displayText: userAnswer, confidence: 0.91, asrSource: 'mock_playwright' },
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
          }, 300);

          window.setTimeout(() => {
            window.__kiwiVoiceE2E.turnDone = true;
            window.__kiwiVoiceE2E.turnDoneMs = Math.round(performance.now() - speechEndAt);
          }, 300);
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

    window.WebSocket = function WebSocketFactory(url, protocols) {
      if (String(url).includes('/voice/duplex')) return new MockVoiceWebSocket(url);
      return new NativeWebSocket(url, protocols);
    };
    window.WebSocket.CONNECTING = MockVoiceWebSocket.CONNECTING;
    window.WebSocket.OPEN = MockVoiceWebSocket.OPEN;
    window.WebSocket.CLOSING = MockVoiceWebSocket.CLOSING;
    window.WebSocket.CLOSED = MockVoiceWebSocket.CLOSED;
  }, { sessionId: SESSION_ID, userAnswer: USER_ANSWER, followUp: FOLLOW_UP });
};

const run = async () => {
  const { chromium } = loadPlaywright();
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const server = await startFrontendServer();
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, permissions: ['microphone'] });
    await context.addInitScript(() => window.localStorage.setItem('kiwi_auth_token', 'voice-latency-token'));
    await installBrowserVoiceMocks(context);

    const page = await context.newPage();
    const latencyConsoleMessages = [];
    const errors = [];

    page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`));
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[voice-latency]') || text.includes('[voice-latency:debug]')) latencyConsoleMessages.push(text);
      if (message.type() === 'error') errors.push(`[browser error] ${text}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`[browser response] ${response.status()} ${response.url()}`);
    });

    const apiCalls = await installApiMocks(page);

    await page.goto(`${BASE_URL}/interview/${SESSION_ID}`);
    await page.getByText('Voice practice mode').waitFor({ timeout: 10000 }).catch(async (error) => {
      console.error('[voice-smoke] body before start', (await page.locator('body').innerText()).slice(0, 2000));
      console.error('[voice-smoke] api calls before start', JSON.stringify(apiCalls, null, 2));
      console.error('[voice-smoke] browser errors before start', JSON.stringify(errors, null, 2));
      throw error;
    });
    await page.getByRole('button', { name: /Start voice interview/i }).click();

    await page.waitForFunction(() => window.__kiwiVoiceE2E?.sessionReady === true, null, { timeout: 10000 });
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.assistantPromptSeen === true, null, { timeout: 10000 });
    let driverMode = 'vad_browser_simulation';
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.speechEndReceived === true, null, { timeout: 25000 }).catch(async () => {
      driverMode = 'manual_socket_fallback';
      await page.evaluate(() => {
        const socket = window.__kiwiVoiceE2E?.voiceSocket;
        if (!socket) throw new Error('Voice mock socket was not available for manual speech fallback.');
        const clientTurnId = `voice-smoke-fallback-${Date.now()}`;
        socket.send(JSON.stringify({ type: 'speech_start', clientTurnId, clientTimestamp: Date.now() }));
        socket.send(JSON.stringify({
          type: 'speech_end',
          clientTurnId,
          reason: 'manual_socket_fallback',
          clientTimestamp: Date.now(),
          vad: {
            speechDurationMs: 3200,
            silenceDurationMs: 1900,
            sttSource: 'manual_socket_fallback',
          },
        }));
        window.__kiwiVoiceE2E.manualSocketFallback = true;
      });
      await page.waitForFunction(() => window.__kiwiVoiceE2E?.speechEndReceived === true, null, { timeout: 5000 });
    });
    await page.waitForFunction(() => window.__kiwiVoiceE2E?.turnDone === true, null, { timeout: 15000 });

    await page.getByText(FOLLOW_UP).first().waitFor({ timeout: 10000 }).catch(async (error) => {
      console.error('[voice-smoke] body after turn_done', (await page.locator('body').innerText()).slice(0, 3000));
      console.error('[voice-smoke] api calls after turn_done', JSON.stringify(apiCalls, null, 2));
      console.error('[voice-smoke] browser errors after turn_done', JSON.stringify(errors, null, 2));
      throw error;
    });

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
    if (!result.sentMessageTypes.includes('session_start') ||
        !result.sentMessageTypes.includes('speak_text') ||
        !result.sentMessageTypes.includes('speech_start') ||
        !result.sentMessageTypes.includes('speech_end')) {
      throw new Error(`Expected voice WebSocket session_start, speak_text, speech_start, and speech_end, got ${result.sentMessageTypes.join(', ')}`);
    }

    const requiredCalls = ['GET /api/auth/me', `GET /api/session/${SESSION_ID}`, 'POST /api/interview/warm-adaptive'];
    const callSet = new Set(apiCalls.map((item) => `${item.method} ${item.path}`));
    const missing = requiredCalls.filter((item) => !callSet.has(item));
    if (missing.length) throw new Error(`Voice latency flow missed expected API calls: ${missing.join(', ')}`);

    console.log("Recorded Voice Latency Console Messages:\n" + latencyConsoleMessages.join("\n"));

    const summary = {
      schemaVersion: 'voice_flow_e2e_report_v1',
      generatedAt: new Date().toISOString(),
      passed: true,
      resultType: 'mocked_browser_voice_latency_flow',
      driverMode,
      assistantFirstAudioMs: result.assistantFirstAudioMs,
      nextQuestionFirstAudioMs: result.assistantFirstAudioMs,
      turnDoneMs: result.turnDoneMs,
      nextQuestionThreeSecondSloMet: result.assistantFirstAudioMs <= 3000,
      latencyConsoleMessages: latencyConsoleMessages.length,
      sentMessageTypes: result.sentMessageTypes,
      requiredCalls,
      browserErrors: errors,
    };

    await fs.writeFile(ARTIFACT_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
