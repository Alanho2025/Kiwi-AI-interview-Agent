#!/usr/bin/env node
/**
 * Browser smoke for the highest-risk demo flow:
 * authenticated entry -> voice interview screen -> text fallback -> end session -> report -> JSON download.
 *
 * Requires Playwright to be resolvable from the project or NODE_PATH.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const SESSION_ID = 'session-voice-1';
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4173);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for this browser flow. Install it in frontend or run with NODE_PATH pointing at an existing Playwright package. Original error: ${error.message}`);
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
  candidateName: 'Browser Candidate',
  targetRole: 'Data Analyst',
  totalQuestions: 2,
  currentQuestionIndex: 1,
  elapsedSeconds: 12,
  transcript: [{
    role: 'ai',
    text: 'Tell me about a reporting workflow you improved.',
    displayText: 'Tell me about a reporting workflow you improved.',
    timestamp: new Date().toISOString(),
    metadata: { questionType: 'technical_core' },
  }],
  interviewPlan: {
    questionPool: [{ text: 'Tell me about a reporting workflow you improved.', topic: 'reporting' }],
  },
  ...overrides,
});

const buildReport = () => ({
  sessionId: SESSION_ID,
  latestStatus: 'ready',
  commercialStressTest: {
    totalExecutionCost: 0.00042,
    totalLlmTokens: 420,
    speechAudioSeconds: 18,
    estimatedHumanMinutesReplaced: { min: 30, max: 45 },
    conclusion: 'Cost summary is included for the browser smoke.',
  },
  report: {
    schemaVersion: 'v3',
    sessionId: SESSION_ID,
    candidateName: 'Browser Candidate',
    jobTitle: 'Data Analyst',
    generatedAt: new Date().toISOString(),
    summary: 'The candidate gave grounded reporting evidence.',
    scores: { overall: 82, cvJdMatch: 78, interviewPerformance: 86, evidenceStrength: 3 },
    sections: [{ id: 'summary', title: 'Summary', content: 'Grounded report content.' }],
    recommendations: ['Keep using concrete examples.'],
    evidenceReferences: [{ label: 'transcript', sourceType: 'interview' }],
    interviewMetrics: { candidateTurnCount: 1, interviewerQuestionCount: 1, plannedQuestionCount: 2 },
    evidenceDiagnostics: { totals: { direct_past_experience: 1 }, averageStrength: 3 },
    candidateFeedback: {
      overallTakeaway: 'Strong evidence with one clear improvement path.',
      scoreBand: 'strong',
      plainEnglishMetrics: [],
      strengthHighlights: [{ title: 'Reporting evidence', description: 'Used a concrete workflow example.' }],
      improvementPriorities: [],
      coachingAdvice: [],
      answerRewriteExamples: [],
      quoteAnalyses: [],
      turnBreakdowns: [],
      communicationProfile: { summary: 'Clear and concise.', keyTraits: [], fillerWords: '' },
    },
  },
  qaResult: { passed: true, qualityFlags: [] },
});

const installApiMocks = async (page) => {
  let session = buildSession();
  const apiCalls = [];

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
      await route.fulfill(jsonResponse(success({ clientId: 'browser-flow-client' })));
      return;
    }

    if (method === 'GET' && url.pathname === '/api/auth/me') {
      await route.fulfill(jsonResponse(success({ user: { id: 'user-1', email: 'user@example.test' } })));
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
      await route.fulfill(jsonResponse(success({ sessions: [buildSession()] })));
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

    if (method === 'POST' && url.pathname === '/api/interview/reply') {
      session = buildSession({
        transcript: [
          ...session.transcript,
          { role: 'user', text: 'I built weekly SQL reporting and reduced manual reconciliation.', timestamp: new Date().toISOString() },
          { role: 'ai', text: 'What checks proved the reporting workflow worked?', timestamp: new Date().toISOString() },
        ],
        currentQuestionIndex: 2,
      });
      await route.fulfill(jsonResponse(success({
        nextQuestion: 'What checks proved the reporting workflow worked?',
        isComplete: false,
        session,
      })));
      return;
    }

    if (method === 'POST' && url.pathname === '/api/interview/end') {
      session = buildSession({ ...session, status: 'completed' });
      await route.fulfill(jsonResponse(success({ session, reportStatus: 'ready' })));
      return;
    }

    if (method === 'GET' && url.pathname === `/api/report/${SESSION_ID}`) {
      await route.fulfill(jsonResponse(success(buildReport())));
      return;
    }

    if (method === 'POST' && url.pathname === `/api/report/${SESSION_ID}/export`) {
      await route.fulfill(jsonResponse(success({ exportFileId: 'export-1', format: 'json' })));
      return;
    }

    if (method === 'GET' && url.pathname === `/api/recordings/session-audio/${SESSION_ID}/status`) {
      await route.fulfill(jsonResponse(success({ available: false, status: 'missing' })));
      return;
    }

    if (method === 'POST' && url.pathname === '/api/recordings/session-audio/uploads') {
      await route.fulfill(jsonResponse(success({ uploadId: 'upload-1', sessionId: SESSION_ID })));
      return;
    }

    if (method === 'PUT' && url.pathname.includes('/api/recordings/session-audio/uploads/')) {
      await route.fulfill(jsonResponse(success({ received: true })));
      return;
    }

    if (method === 'POST' && url.pathname.includes('/api/recordings/session-audio/uploads/') && url.pathname.endsWith('/finalize')) {
      await route.fulfill(jsonResponse(success({ available: true, status: 'completed' })));
      return;
    }

    await route.fulfill(jsonResponse({ success: false, message: `Unhandled mock route: ${method} ${url.pathname}` }, 404));
  });

  return apiCalls;
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
      acceptDownloads: true,
    });
    await context.addInitScript(() => {
      window.localStorage.setItem('kiwi_auth_token', 'browser-flow-token');
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('[browser pageerror]', error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) console.error(`[browser ${message.type()}]`, message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) console.error('[browser response]', response.status(), response.url());
    });
    const apiCalls = await installApiMocks(page);

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    await page.goto(`${BASE_URL}/interview/${SESSION_ID}`);
    try {
      await page.getByText('Voice practice mode').waitFor({ timeout: 10000 });
    } catch (error) {
      console.error('[browser-flow] current URL', page.url());
      console.error('[browser-flow] body', (await page.locator('body').innerText()).slice(0, 2000));
      throw error;
    }
    const needsMicPermission = await page.getByText('Mic permission needed').isVisible().catch(() => false);
    if (needsMicPermission) {
      await page.getByRole('button', { name: 'Mic' }).click();
    }
    await page.getByRole('button', { name: 'Expand' }).first().click();
    await page.getByPlaceholder('Draft your response here...').fill('I built weekly SQL reporting and reduced manual reconciliation.');
    await page.getByRole('button', { name: 'Submit Text' }).click();
    await page.getByText('What checks proved the reporting workflow worked?').first().waitFor({ timeout: 10000 });

    await page.getByRole('button', { name: 'End' }).click();
    await page.getByRole('button', { name: 'Confirm End' }).click();
    await page.getByText('Interview ended').first().waitFor({ timeout: 10000 });

    await page.goto(`${BASE_URL}/report/${SESSION_ID}`);
    await page.getByText('Commercial Stress Test').waitFor({ timeout: 10000 });
    await page.getByText('Cost summary is included for the browser smoke.').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Export/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('JSON Format').click();
    const download = await downloadPromise;
    if (!download.suggestedFilename().endsWith('.json')) {
      throw new Error(`Expected JSON report download, got ${download.suggestedFilename()}`);
    }

    const requiredCalls = [
      'GET /api/auth/me',
      `GET /api/session/${SESSION_ID}`,
      'POST /api/interview/reply',
      'POST /api/interview/end',
      `GET /api/report/${SESSION_ID}`,
      `POST /api/report/${SESSION_ID}/export`,
    ];
    const callSet = new Set(apiCalls.map((item) => `${item.method} ${item.path}`));
    const missing = requiredCalls.filter((item) => !callSet.has(item));
    if (missing.length) throw new Error(`Browser flow missed expected API calls: ${missing.join(', ')}`);

    console.log(JSON.stringify({ passed: true, requiredCalls }, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
