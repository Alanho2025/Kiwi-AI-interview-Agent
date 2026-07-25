#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4181);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;
const SCREENSHOT_PATH = path.resolve('../docs/assets/ui/match-interview-preparation-implemented.png');

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for the Match-to-voice human flow. Original error: ${error.message}`, { cause: error });
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const waitForHttp = async (url, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
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

const success = (data = {}) => ({
  success: true,
  message: 'ok',
  data,
  error: null,
});

const jsonResponse = (data, status = 200) => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
});

const rawJD = [
  'Frontend Developer at Human Flow Ltd.',
  'Build accessible React interfaces and own automated testing.',
  'Work with product partners and support production delivery.',
].join(' ');

const jdRubric = {
  title: 'Frontend Developer',
  jobTitle: 'Frontend Developer',
  jobOverview: {
    title: 'Frontend Developer',
    companyName: 'Human Flow Ltd',
  },
  sections: {
    responsibilities: ['Build accessible React interfaces', 'Own automated testing'],
    mustHaveRequirements: ['React delivery', 'Testing evidence'],
    technicalSkills: {
      softwareDevelopment: [{ label: 'React' }, { label: 'Playwright' }],
    },
  },
  diagnostics: {
    confidence: 0.96,
    humanReviewStatus: 'verified',
  },
  metadata: {
    confidence: 0.96,
    humanReviewStatus: 'verified',
    inputTrustLevel: 'human_reviewed',
  },
  roleFit: {
    id: 'role-fit-human-voice',
    jdFingerprint: 'jd-human-voice',
    companyContext: { status: 'ready' },
    review: { status: 'verified', version: 2 },
    roleIntent: {
      items: [
        { id: 'intent-react', statement: 'React delivery', priority: 'high' },
        { id: 'intent-testing', statement: 'Testing evidence', priority: 'high' },
      ],
    },
  },
};

const selectedCV = {
  id: 'cv-human-voice',
  name: 'Human Candidate CV.pdf',
  size: '118 KB',
  updated: '2026-07-26',
  type: 'application/pdf',
  parseStatus: 'completed',
  profileStatus: 'reviewed',
  parseConfidence: 0.95,
  candidateName: 'Human Candidate',
  topSkills: ['React', 'Playwright', 'Accessibility'],
};

const matchResult = {
  schemaVersion: 'v3',
  matchScore: 78,
  overallScore: 78,
  confidence: 0.87,
  matchAnalysisId: 'match-human-voice',
  candidateName: 'Human Candidate',
  jobTitle: 'Frontend Developer',
  decision: {
    label: 'promising_match',
    reasonCodes: ['strong_role_evidence'],
  },
  scoreBreakdown: {
    macro: 80,
    micro: 76,
    requirements: 78,
  },
  explanation: {
    summary: 'Your React delivery evidence is relevant; testing outcomes need a more specific example.',
    strengths: [{
      label: 'React delivery',
      detail: 'The CV shows ownership of a customer-facing workflow.',
      evidence: ['Owned a customer-facing React workflow.'],
    }],
    gaps: [{
      label: 'Testing outcomes',
      detail: 'Prepare one measurable example of how automated tests reduced risk.',
    }],
    risks: [],
  },
  requirementChecks: [
    {
      id: 'react',
      label: 'React delivery',
      status: 'met',
      type: 'hard',
      importance: 'high',
      evidence: ['Owned a customer-facing React workflow.'],
    },
    {
      id: 'testing',
      label: 'Testing evidence',
      status: 'partial',
      type: 'hard',
      importance: 'high',
      notes: 'Testing is named but outcomes need confirmation.',
    },
  ],
  matchingDetails: {},
  parsedJdProfile: jdRubric,
  roleEvidenceMap: {
    intentCoverage: { highPriorityTotal: 2, strong: 1, partial: 1, missing: 0 },
    items: [],
  },
};

const questionPoolSummary = {
  count: 8,
  readiness: 'ready',
  proofStrategy: {
    status: 'ready',
    focusAreaCount: 3,
    gapCount: 1,
    unresolvedCount: 0,
    focusAreas: [
      {
        label: 'React delivery ownership',
        kind: 'experience',
        preparationHint: 'Prepare one example that shows the decision you owned and the result.',
      },
      {
        label: 'Automated testing outcomes',
        kind: 'gap',
        preparationHint: 'Bring one measurable example of how testing reduced delivery risk.',
        risk: 'Do not claim production impact unless you can explain the evidence.',
      },
      {
        label: 'Stakeholder communication',
        kind: 'experience',
        preparationHint: 'Explain how you translated a product need into an implementation choice.',
      },
    ],
  },
};

const buildSseBody = () => {
  const events = [
    {
      type: 'match_started',
      sequence: 1,
      stage: null,
      data: null,
    },
    {
      type: 'stage_progress',
      sequence: 2,
      stage: { id: 'input_validation', label: 'Checking your inputs', status: 'completed' },
      data: null,
    },
    {
      type: 'stage_progress',
      sequence: 3,
      stage: { id: 'evidence_match', label: 'Matching your CV evidence', status: 'completed' },
      data: null,
    },
    {
      type: 'stage_progress',
      sequence: 4,
      stage: { id: 'quality_review', label: 'Quality-checking the match', status: 'completed' },
      data: null,
    },
    {
      type: 'match_completed',
      sequence: 5,
      stage: { id: 'complete', label: 'Match analysis complete', status: 'completed' },
      data: { result: matchResult },
    },
  ];

  return events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify({
      schemaVersion: 'match_stream_event_v1',
      requestId: 'request-human-voice',
      occurredAt: new Date().toISOString(),
      ...event,
    })}\n\n`)
    .join('');
};

const buildDraft = () => ({
  selectedCV,
  structuredCVProfile: {
    candidateSummary: 'Frontend engineer focused on accessible React delivery.',
    coreSkills: ['React', 'Playwright', 'Accessibility'],
    experienceEvidence: 'Owned a customer-facing React workflow.',
    projectEvidence: 'Added automated browser checks.',
    educationCredentials: 'Bachelor of Software Engineering.',
    keyCompetencies: ['Delivery ownership', 'Stakeholder communication'],
  },
  rawJD,
  companyWebsiteUrl: 'https://example.test',
  userCompanyContext: 'Human Flow Ltd builds customer-facing workflow products.',
  structuredJD: '# Frontend Developer\n\nReviewed role summary',
  structuredJDRubric: jdRubric,
  summarizedRawJD: rawJD,
  cvHumanReviewedFileId: selectedCV.id,
  cvReviewStatus: 'verified',
  jdHumanReviewedRawJD: rawJD,
  jdReviewStatus: 'verified',
  settings: {
    seniorityLevel: 'Intermediate',
    enableNZCultureFit: false,
    focusArea: 'Combined',
    controlMode: 'question_limited',
    questionLimit: 8,
    timeLimitMinutes: 15,
  },
  sessionMode: 'voice',
});

const readyVoiceSession = {
  id: 'session-human-voice',
  status: 'ready',
  mode: 'voice',
  candidateName: 'Human Candidate',
  targetRole: 'Frontend Developer',
  currentQuestionIndex: 0,
  totalQuestions: 8,
  transcript: [],
  interviewPlan: {
    questionPool: [],
  },
  analysisSetup: {
    selectedCV,
    rawJD,
    structuredJD: '# Frontend Developer\n\nReviewed role summary',
    structuredJDRubric: jdRubric,
    summarizedRawJD: rawJD,
    cvHumanReviewedFileId: selectedCV.id,
    cvReviewStatus: 'verified',
    jdHumanReviewedRawJD: rawJD,
    jdReviewStatus: 'verified',
    settings: buildDraft().settings,
    sessionMode: 'voice',
  },
  analysisResult: matchResult,
};

const installAudioFakes = () => {
  class FakeAudioNode {
    connect() {}
    disconnect() {}
  }

  class FakeAnalyser extends FakeAudioNode {
    constructor() {
      super();
      this.fftSize = 1024;
      this.frequencyBinCount = 512;
    }

    getByteTimeDomainData(data) {
      data.forEach((_, index) => {
        data[index] = index % 2 === 0 ? 144 : 112;
      });
    }
  }

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.destination = {};
    }

    createAnalyser() {
      return new FakeAnalyser();
    }

    createMediaStreamSource() {
      return new FakeAudioNode();
    }

    createOscillator() {
      return Object.assign(new FakeAudioNode(), {
        type: 'sine',
        frequency: { value: 0 },
        start() {},
        stop() {},
      });
    }

    createGain() {
      return Object.assign(new FakeAudioNode(), {
        gain: { value: 0 },
      });
    }

    async resume() {}
    async close() {}
  }

  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: async () => ({
      getTracks: () => [{ stop() {} }],
    }),
  });
  Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
    configurable: true,
    value: async () => [{ kind: 'audioinput', label: 'Human test microphone' }],
  });
};

export const run = async () => {
  const { chromium } = loadPlaywright();
  const server = await startFrontendServer();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    permissions: ['microphone'],
  });

  const apiCalls = [];
  let submittedMatch = null;
  let submittedPlan = null;

  await context.addInitScript(({ draft }) => {
    window.localStorage.setItem('kiwi_auth_token', 'human-voice-token');
    window.localStorage.setItem('kiwi-analyze-draft', JSON.stringify(draft));
    window.localStorage.removeItem('kiwi_global_tour_step');
  }, { draft: buildDraft() });
  await context.addInitScript(installAudioFakes);

  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('[match-voice pageerror]', error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    apiCalls.push(`${method} ${url.pathname}`);

    if (method === 'GET' && url.pathname === '/api/auth/me') {
      await route.fulfill(jsonResponse(success({ user: { id: 'user-human-voice', email: 'human.voice@example.test' } })));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/auth/google/config') {
      await route.fulfill(jsonResponse(success({ clientId: 'human-voice-client' })));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/upload/recent-cvs') {
      await route.fulfill(jsonResponse(success([])));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/job-description/saved') {
      await route.fulfill(jsonResponse(success({ savedJDs: [] })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/analyze/match/stream') {
      submittedMatch = request.postDataJSON();
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        },
        body: buildSseBody(),
      });
      return;
    }
    if (method === 'POST' && url.pathname === '/api/analyze/interview-plan') {
      submittedPlan = request.postDataJSON();
      await route.fulfill(jsonResponse(success({
        sessionId: readyVoiceSession.id,
        questionPool: questionPoolSummary,
      })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/session/${readyVoiceSession.id}`) {
      await route.fulfill(jsonResponse(success({ session: readyVoiceSession })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/recordings/session-audio/uploads') {
      await route.fulfill(jsonResponse(success({
        uploadId: 'match-voice-upload',
        state: 'receiving',
      })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/recordings/session-audio/${readyVoiceSession.id}/status`) {
      await route.fulfill(jsonResponse(success({ available: false, status: 'missing' })));
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

    await route.fulfill(jsonResponse({ success: false, message: `Unhandled mock route: ${method} ${url.pathname}` }, 404));
  });

  try {
    await page.goto(`${BASE_URL}/analysis?sessionId=${readyVoiceSession.id}`);
    await page.getByText('Match analysis complete').first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /^(Device Check|Session Setup)/ }).click();
    await page.getByRole('heading', { name: 'Session setup' }).waitFor({ timeout: 10000 }).catch(async (error) => {
      console.error('[match-voice] URL before setup', page.url());
      console.error('[match-voice] body before setup', (await page.locator('body').innerText()).slice(0, 4000));
      console.error('[match-voice] API calls before setup', apiCalls);
      throw error;
    });
    await page.getByText('Question limit').locator('..').getByRole('combobox').selectOption('12');

    await page.getByRole('button', { name: 'Check microphone', exact: true }).click();
    await page.getByText('Human test microphone').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Play speaker test' }).click();
    await page.getByRole('button', { name: 'I heard it' }).click();
    await page.getByText('Voice devices ready').waitFor({ timeout: 5000 });

    await page.getByRole('button', { name: 'Generate match analysis', exact: true }).click();
    await page.getByText('Your interview preparation priorities').waitFor({ timeout: 10000 });
    await page.getByText('Match analysis complete').first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Continue to voice interview' }).waitFor({ timeout: 10000 });

    assert(!await page.getByText(/Improve your CV for this role/i).count(), 'The preparation UI must not add a CV rewrite branch.');
    assert(!await page.getByText(/ATS keywords/i).count(), 'The preparation UI must not add ATS output.');
    assert(submittedMatch?.settings?.matchMode === undefined, 'The canonical Match request must not select a fast mode.');
    assert(submittedPlan?.matchAnalysisId === matchResult.matchAnalysisId, 'Interview preparation must use the persisted canonical Match.');

    await fs.mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

    await page.getByRole('button', { name: 'Continue to voice interview' }).click();
    await page.waitForURL(`**/interview/${readyVoiceSession.id}`, { timeout: 10000 });
    await page.getByRole('button', { name: /Start voice interview/i }).waitFor({ timeout: 10000 }).catch(async (error) => {
      console.error('[match-voice] body after voice navigation', (await page.locator('body').innerText()).slice(0, 4000));
      console.error('[match-voice] API calls after voice navigation', apiCalls);
      throw error;
    });

    assert(apiCalls.includes('POST /api/analyze/match/stream'), 'The human flow must use the streaming Match endpoint.');
    assert(apiCalls.includes('POST /api/analyze/interview-plan'), 'The human flow must prepare an interview from the Match.');

    console.log(JSON.stringify({
      passed: true,
      resultType: 'mocked_api_human_browser_flow',
      screenshot: SCREENSHOT_PATH,
      enteredVoiceInterview: true,
      apiCalls,
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

if (process.env.VITEST) {
  const { describe, expect, it } = await import('vitest');

  describe('Match preparation to Voice Interview Playwright script', () => {
    it('is executed by the dedicated e2e script', () => {
      expect(typeof run).toBe('function');
      expect(BASE_URL).toContain(String(PORT));
    });
  });
} else {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
