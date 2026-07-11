#!/usr/bin/env node

import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4177);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;
const SESSION_ID = 'role-fit-visual-session';
const OUTPUT_ROOT = path.resolve(process.cwd(), '../output/playwright');
const ARTIFACT_PATH = path.join(OUTPUT_ROOT, 'role-fit-browser-visual.latest.json');

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for the Role-Fit visual spec. Original error: ${error.message}`, { cause: error });
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
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

const buildRoleFitReport = () => ({
  sessionId: SESSION_ID,
  latestStatus: 'ready',
  report: {
    schemaVersion: 'v7',
    candidateName: 'Role Fit Candidate',
    jobTitle: 'Product Data Analyst',
    generatedAt: new Date().toISOString(),
    summary: 'The candidate gave grounded examples for workflow automation and stakeholder reporting.',
    scores: {
      overall: 84,
      cvJdMatch: 81,
      interviewPerformance: 86,
      evidenceStrength: 3,
    },
    sections: [{
      id: 'summary',
      title: 'Role-fit summary',
      content: 'The strongest answers connected operational data work to measurable team outcomes.',
    }],
    recommendations: ['Keep leading with the workflow automation example.'],
    evidenceReferences: [{
      claim: 'The candidate improved manual reporting workflows.',
      evidenceSnippet: 'They described replacing spreadsheet handoffs with an automated dashboard and weekly QA checks.',
      sourceType: 'interview',
    }],
    interviewMetrics: {
      candidateTurnCount: 2,
      interviewerQuestionCount: 2,
      plannedQuestionCount: 4,
    },
    evidenceDiagnostics: {
      totals: { direct_past_experience: 2 },
      averageStrength: 3,
    },
    candidateFeedback: {
      overallTakeaway: 'Strong role fit when the answer links workflow changes to business impact.',
      scoreBand: 'Strong match',
      plainEnglishMetrics: [],
      strengthHighlights: [{
        title: 'Workflow automation evidence',
        description: 'Used a concrete reporting workflow example with measurable impact.',
      }],
      improvementPriorities: [{
        title: 'State impact earlier',
        reason: 'Open with the metric before describing implementation details.',
      }],
      coachingAdvice: [],
      answerRewriteExamples: [],
      quoteAnalyses: [],
      turnBreakdowns: [],
    },
    roleFit: {
      schemaVersion: 'role_fit_report_v1',
      status: 'ready',
      roleIntentCoverage: {
        total: 2,
        covered: 2,
        partial: 0,
        missing: 0,
        unavailable: 0,
        items: [
          { label: 'Explain workflow automation impact', status: 'covered' },
          { label: 'Translate data quality risk for stakeholders', status: 'covered' },
        ],
      },
      evidenceUsageMap: {
        totalUses: 2,
        items: [
          { label: 'Automated dashboard rollout', useCount: 1, angles: ['workflow impact'] },
          { label: 'Weekly QA review with stakeholders', useCount: 1, angles: ['data quality'] },
        ],
      },
      answerAlignments: [{
        turnId: 'turn-1',
        question: 'Tell me about a workflow you improved for a stakeholder team.',
        label: 'strong',
        score: 86,
        scoreBreakdown: {
          questionAlignment: 18,
          evidenceFit: 18,
          evidenceClarity: 17,
          roleIntentFit: 18,
          naturalness: 8,
          concision: 7,
        },
        groundingStatus: 'grounded',
        diagnosis: {
          mainIssue: 'The example matched the intended workflow risk and named a measurable reporting outcome.',
        },
        betterAnswerPlan: {
          direction: 'Keep this example and mention the weekly time saved before the implementation detail.',
        },
      }],
      questionReasoning: [{
        topic: 'workflow automation',
        reason: 'This question checked whether the candidate can reduce manual reporting risk for stakeholders.',
      }],
    },
  },
  qaResult: {
    passed: true,
    coverageScore: 88,
    hallucinationRisk: 'low',
    qualityFlags: [],
  },
});

const installApiMocks = async (page) => {
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

    if (method === 'GET' && url.pathname === '/api/auth/me') {
      await route.fulfill(jsonResponse(success({ user: { id: 'role-fit-user', email: 'role-fit@example.test' } })));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/auth/google/config') {
      await route.fulfill(jsonResponse(success({ clientId: 'role-fit-visual-client' })));
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
      await route.fulfill(jsonResponse(success({ sessions: [] })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/report/${SESSION_ID}`) {
      await route.fulfill(jsonResponse(success(buildRoleFitReport())));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/recordings/session-audio/${SESSION_ID}/status`) {
      await route.fulfill(jsonResponse(success({ available: false, state: 'missing', status: 'missing' })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/recordings/session-audio/uploads') {
      await route.fulfill(jsonResponse(success({ uploadId: 'visual-recording-upload', state: 'receiving' })));
      return;
    }

    await route.fulfill(jsonResponse({ success: false, message: `Unhandled mock route: ${method} ${url.pathname}` }, 404));
  });

  return apiCalls;
};

const captureReport = async (page, suffix, viewport) => {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE_URL}/report/${SESSION_ID}`);
  await page.getByText('How your answers matched this role').waitFor({ timeout: 10000 });
  await page.getByText('Answer-by-answer role fit').waitFor({ timeout: 10000 });
  await page.getByText(/Question alignment: 18/i).waitFor({ timeout: 10000 });
  await page.getByText('Why we asked about workflow automation').waitFor({ timeout: 10000 });

  const roleFitSection = page.locator('section[aria-labelledby="role-fit-report-title"]');
  await roleFitSection.waitFor({ timeout: 10000 });
  const box = await roleFitSection.boundingBox();
  assert(box?.width > 300 && box?.height > 300, `Expected Role-Fit section to render at a stable size, got ${JSON.stringify(box)}`);

  const screenshotPath = path.join(OUTPUT_ROOT, `role-fit-report-${suffix}.png`);
  await roleFitSection.screenshot({ path: screenshotPath });
  const screenshotStat = await fs.stat(screenshotPath);
  assert(screenshotStat.size > 10_000, `Expected non-empty ${suffix} screenshot, got ${screenshotStat.size} bytes`);
  return { suffix, path: screenshotPath, bytes: screenshotStat.size, viewport };
};

export const run = async () => {
  const { chromium } = loadPlaywright();
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const server = await startFrontendServer();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 920 },
      acceptDownloads: true,
    });
    await context.addInitScript(() => {
      window.localStorage.setItem('kiwi_auth_token', 'role-fit-visual-token');
      window.localStorage.removeItem('kiwi_global_tour_step');
    });
    const page = await context.newPage();
    const browserErrors = [];

    page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`[browser error] ${message.text()}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) browserErrors.push(`[browser response] ${response.status()} ${response.url()}`);
    });

    const apiCalls = await installApiMocks(page);
    const screenshots = [
      await captureReport(page, 'desktop', { width: 1440, height: 920 }),
      await captureReport(page, 'mobile', { width: 390, height: 844 }),
    ];
    const requiredCalls = [
      'GET /api/auth/me',
      `GET /api/report/${SESSION_ID}`,
      `GET /api/recordings/session-audio/${SESSION_ID}/status`,
    ];
    const callSet = new Set(apiCalls.map((item) => `${item.method} ${item.path}`));
    const missing = requiredCalls.filter((item) => !callSet.has(item));
    assert(!missing.length, `Role-Fit visual flow missed expected API calls: ${missing.join(', ')}`);
    assert(browserErrors.length === 0, `Unexpected browser errors: ${browserErrors.join('\n')}`);

    const summary = {
      schemaVersion: 'role_fit_browser_visual_report_v1',
      generatedAt: new Date().toISOString(),
      passed: true,
      resultType: 'mocked_role_fit_report_browser_visual',
      sessionId: SESSION_ID,
      screenshotCount: screenshots.length,
      screenshots,
      assertions: [
        'role_fit_section_visible',
        'answer_alignment_visible',
        'question_reasoning_visible',
        'desktop_screenshot_non_empty',
        'mobile_screenshot_non_empty',
      ],
      requiredCalls,
    };
    await fs.writeFile(ARTIFACT_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
    await context.close();
    return summary;
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

if (process.env.VITEST) {
  const { describe, expect, it } = await import('vitest');

  describe('Role-Fit browser visual Playwright script', () => {
    it('is executed by the dedicated e2e script and writes a visual artifact', () => {
      expect(typeof run).toBe('function');
      expect(ARTIFACT_PATH).toContain('role-fit-browser-visual.latest.json');
    });
  });
} else {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
