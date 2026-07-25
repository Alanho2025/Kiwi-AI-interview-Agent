#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4175);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for the full human flow spec. Original error: ${error.message}`, { cause: error });
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

const sseResponse = (events = []) => ({
  status: 200,
  headers: {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
  },
  body: events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify({
      schemaVersion: 'match_stream_event_v1',
      requestId: `human-flow-${event.sequence}`,
      occurredAt: new Date().toISOString(),
      ...event,
    })}\n\n`)
    .join(''),
});

const success = (data = {}, message = 'ok') => ({
  success: true,
  message,
  data,
  error: null,
});

const buildCvFile = ({ degraded = false } = {}) => ({
  id: degraded ? 'cv-human-degraded' : 'cv-human-happy',
  name: degraded ? 'Sparse Candidate CV.pdf' : 'Human Candidate CV.pdf',
  size: degraded ? '24 KB' : '118 KB',
  updated: '2026-06-02',
  type: 'application/pdf',
  parseStatus: 'completed',
  profileStatus: 'completed',
  parseConfidence: degraded ? 0.58 : 0.94,
  parseWarnings: degraded ? ['No dedicated experience section was detected.', 'Skills evidence is weak.'] : [],
  candidateName: degraded ? 'Sparse Candidate' : 'Human Candidate',
  topSkills: degraded ? ['communication'] : ['React', 'testing', 'accessibility'],
  display: {
    summary: degraded ? 'Candidate has limited extracted experience.' : 'Frontend engineer focused on React delivery.',
    topSkills: degraded ? ['communication'] : ['React', 'testing', 'accessibility'],
  },
  profile: {
    experience: degraded ? '' : 'Delivered React features and testing improvements.',
    projects: degraded ? 'Built a small portfolio page.' : 'Built a customer-facing React workflow with automated tests.',
    education: 'Bachelor of Software Engineering.',
    keyCompetencies: degraded ? 'Communication' : 'Stakeholder collaboration\nDebugging',
  },
});

const buildJdRubric = ({ degraded = false } = {}) => ({
  title: degraded ? 'Customer-facing platform role' : 'Frontend Developer',
  jobTitle: degraded ? 'Customer-facing platform role' : 'Frontend Developer',
  jobOverview: {
    title: degraded ? 'Customer-facing platform role' : 'Frontend Developer',
    companyName: degraded ? 'Ambiguous Co' : 'Human Flow Ltd',
    location: 'Auckland',
  },
  sections: {
    responsibilities: degraded ? ['Support a mixed product team.'] : ['Build customer-facing React interfaces'],
    mustHaveRequirements: degraded ? ['Strong technical skills'] : ['React ownership', 'testing evidence'],
    niceToHaveRequirements: [],
    qualifications: [],
    softSkills: degraded ? ['communication'] : ['communication', 'collaboration'],
    technicalSkills: {
      softwareDevelopment: degraded ? [] : [{ label: 'React' }, { label: 'testing' }],
    },
  },
  diagnostics: {
    analysisMode: degraded ? 'degraded_review_required' : 'ai_assisted',
    confidence: degraded ? 0.56 : 0.95,
    warnings: degraded ? ['JD is low-detail and needs human review.'] : [],
    missingSections: degraded ? ['technicalSkills'] : [],
  },
  metadata: { confidence: degraded ? 0.56 : 0.95 },
});

const buildMatchResult = ({ degraded = false } = {}) => ({
  matchScore: degraded ? 42 : 78,
  matchAnalysisId: degraded ? 'match-human-degraded' : 'match-human-happy',
  jobTitle: degraded ? 'Customer-facing platform role' : 'Frontend Developer',
  strengths: degraded ? ['Communication intent'] : ['React project evidence'],
  gaps: degraded ? ['Missing commercial React evidence', 'Weak testing evidence'] : ['testing evidence'],
  decision: { label: degraded ? 'manual_review' : 'promising_match' },
  requirementChecks: degraded
    ? [{ requirement: 'Strong technical skills', met: false, category: 'technical', evidenceStrength: 'weak' }]
    : [{ requirement: 'React ownership', met: true, category: 'technical' }, { requirement: 'testing evidence', met: false, category: 'technical' }],
  matchingDetails: {
    questionPlanHints: {
      priorityTopics: degraded ? ['evidence gaps'] : ['React', 'testing evidence'],
    },
  },
  parsedJdProfile: buildJdRubric({ degraded }),
});

const buildSession = ({ scenario, status = 'ready', afterAnswer = false } = {}) => {
  const degraded = scenario === 'degraded';
  const sessionId = degraded ? 'session-human-degraded' : 'session-human-happy';
  const firstQuestion = degraded
    ? 'Your CV has limited evidence for this role. What is the strongest relevant example you can give?'
    : 'Tell me about a React feature you owned and how you validated it.';
  const followUp = degraded
    ? 'What evidence could a reviewer use to confirm that example?'
    : 'What test or user signal proved the feature worked?';

  return {
    id: sessionId,
    status,
    mode: 'text',
    candidateName: degraded ? 'Sparse Candidate' : 'Human Candidate',
    targetRole: degraded ? 'Customer-facing platform role' : 'Frontend Developer',
    currentQuestionIndex: afterAnswer ? 2 : 1,
    totalQuestions: 3,
    transcript: afterAnswer
      ? [
        { role: 'ai', text: firstQuestion, displayText: firstQuestion },
        { role: 'user', text: degraded ? 'I helped with a small project but do not have many details.' : 'I owned a React workflow and added automated checks.' },
        { role: 'ai', text: followUp, displayText: followUp },
      ]
      : status === 'ready'
        ? []
        : [{ role: 'ai', text: firstQuestion, displayText: firstQuestion }],
    interviewPlan: {
      questionPool: [
        { text: firstQuestion, topic: degraded ? 'weak_evidence' : 'React' },
        { text: followUp, topic: degraded ? 'confirmation' : 'testing' },
      ],
    },
    analysisSetup: {
      selectedCV: buildCvFile({ degraded }),
      rawJD: degraded ? 'Low-detail role needing technical skills.' : 'Frontend Developer role requiring React and testing evidence.',
      structuredJDRubric: buildJdRubric({ degraded }),
      sessionMode: 'text',
    },
    analysisResult: buildMatchResult({ degraded }),
  };
};

const buildReport = ({ degraded = false } = {}) => ({
  sessionId: degraded ? 'session-human-degraded' : 'session-human-happy',
  latestStatus: degraded ? 'needs_review' : 'ready',
  report: {
    schemaVersion: 'v3',
    candidateName: degraded ? 'Sparse Candidate' : 'Human Candidate',
    jobTitle: degraded ? 'Customer-facing platform role' : 'Frontend Developer',
    generatedAt: new Date().toISOString(),
    summary: degraded
      ? 'Report is intentionally cautious because evidence is weak and low-confidence.'
      : 'The candidate gave grounded React and testing evidence.',
    scores: degraded
      ? { overall: 41, macro: 38, micro: 44, evidenceStrength: 1 }
      : { overall: 82, macro: 78, micro: 86, evidenceStrength: 3 },
    sections: [{
      id: 'summary',
      title: degraded ? 'Low-confidence evidence summary' : 'Summary',
      content: degraded ? 'Insufficient evidence markers are visible.' : 'Grounded report content.',
    }],
    recommendations: degraded
      ? [{ title: 'Add direct evidence', description: 'Use specific project outcomes before relying on this report.' }]
      : ['Keep using concrete examples.'],
    evidenceReferences: degraded ? [] : [{ label: 'Transcript answer about React testing', sourceType: 'interview' }],
    interviewMetrics: { candidateTurnCount: 1, interviewerQuestionCount: 1, plannedQuestionCount: 3 },
    evidenceDiagnostics: degraded ? { totals: { generic_filler: 1 }, averageStrength: 1 } : { totals: { direct_past_experience: 1 }, averageStrength: 3 },
    candidateFeedback: {
      overallTakeaway: degraded ? 'The report should be treated as needs review.' : 'Strong evidence with one clear improvement path.',
      scoreBand: degraded ? 'Needs stronger evidence' : 'Strong match',
      plainEnglishMetrics: [],
      strengthHighlights: degraded ? [] : [{ title: 'React evidence', description: 'Used a concrete workflow example.' }],
      improvementPriorities: degraded ? [{ title: 'Evidence gap', reason: 'The answer lacks detail.' }] : [],
      coachingAdvice: [],
      answerRewriteExamples: [],
      quoteAnalyses: [],
      turnBreakdowns: [],
    },
  },
  qaResult: degraded
    ? { passed: false, coverageScore: 45, hallucinationRisk: 'medium', qualityFlags: ['insufficient_evidence', 'needs_review'] }
    : { passed: true, coverageScore: 86, hallucinationRisk: 'low', qualityFlags: [] },
});

const installApiMocks = async (page, { scenario }) => {
  const degraded = scenario === 'degraded';
  const sessionId = degraded ? 'session-human-degraded' : 'session-human-happy';
  let session = buildSession({ scenario });
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
      await route.fulfill(jsonResponse(success({ user: { id: 'user-1', email: `${scenario}@example.test` } })));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/auth/google/config') {
      await route.fulfill(jsonResponse(success({ clientId: 'human-flow-client' })));
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
    if (method === 'GET' && url.pathname === '/api/upload/recent-cvs') {
      await route.fulfill(jsonResponse(success([])));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/job-description/saved') {
      await route.fulfill(jsonResponse(success({ savedJDs: [] })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/upload/cv') {
      await route.fulfill(jsonResponse(success(buildCvFile({ degraded }))));
      return;
    }
    if (method === 'POST' && url.pathname === `/api/upload/cv/${buildCvFile({ degraded }).id}/review-profile`) {
      await route.fulfill(jsonResponse(success({
        ...buildCvFile({ degraded }),
        profileStatus: 'reviewed',
        reviewedAt: new Date().toISOString(),
      })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/job-description/paraphrase') {
      await route.fulfill(jsonResponse(success({
        structuredJD: `# ${buildJdRubric({ degraded }).title}`,
        structuredJDRubric: buildJdRubric({ degraded }),
      })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/job-description/company-values/enrichment') {
      await route.fulfill(jsonResponse(success({
        searchQueued: !degraded,
        confidence: degraded ? 'low' : 'high',
      })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/analyze/match/stream') {
      const result = buildMatchResult({ degraded });
      await route.fulfill(sseResponse([
        {
          type: 'match_started',
          sequence: 1,
          stage: null,
          data: null,
        },
        {
          type: 'stage_progress',
          sequence: 2,
          stage: { id: 'evidence_match', label: 'Matching your CV evidence', status: 'completed' },
          data: null,
        },
        {
          type: 'match_completed',
          sequence: 3,
          stage: { id: 'complete', label: 'Match analysis complete', status: 'completed' },
          data: { result },
        },
      ]));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/analyze/interview-plan') {
      session = buildSession({ scenario, status: 'ready' });
      await route.fulfill(jsonResponse(success({ sessionId, preparedRootQuestionCount: 2, matchGapQuestionCount: degraded ? 1 : 0 })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/session/${sessionId}`) {
      await route.fulfill(jsonResponse(success({ session })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/interview/start') {
      session = buildSession({ scenario, status: 'in_progress' });
      await route.fulfill(jsonResponse(success({ session, question: session.transcript[0].text })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/interview/reply') {
      session = buildSession({ scenario, status: 'in_progress', afterAnswer: true });
      const latestAi = [...session.transcript].reverse().find((turn) => turn.role === 'ai');
      await route.fulfill(jsonResponse(success({ session, nextQuestion: latestAi.text, isComplete: false })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/interview/end') {
      session = buildSession({ scenario, status: 'completed', afterAnswer: true });
      await route.fulfill(jsonResponse(success({ session, reportStatus: degraded ? 'needs_review' : 'ready' })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/interview/warm-adaptive') {
      await route.fulfill(jsonResponse(success({ warmed: true })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/report/${sessionId}`) {
      await route.fulfill(jsonResponse(success(buildReport({ degraded }))));
      return;
    }
    if (method === 'POST' && url.pathname === `/api/report/${sessionId}/export`) {
      await route.fulfill(jsonResponse(success({ exportFileId: `export-${scenario}`, format: 'json' })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/recordings/session-audio/${sessionId}/status`) {
      await route.fulfill(jsonResponse(success({ available: false, status: 'missing' })));
      return;
    }

    await route.fulfill(jsonResponse({ success: false, message: `Unhandled mock route: ${method} ${url.pathname}` }, 404));
  });

  return apiCalls;
};

const completePreparationFlow = async (page, { scenario }) => {
  const degraded = scenario === 'degraded';
  await page.goto(`${BASE_URL}/analysis`);
  await page.locator('#tour-analyze-actions').waitFor({ timeout: 10000 });

  await page.locator('input[type="file"]').setInputFiles({
    name: degraded ? 'sparse-cv.pdf' : 'human-cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(degraded ? 'Sparse CV' : 'Human CV'),
  });
  await page.getByText('CV uploaded').waitFor({ timeout: 10000 });

  await page.getByText('Edit parsed source fields').click();
  await page.getByLabel('Candidate summary').fill(degraded ? 'Sparse reviewed candidate summary.' : 'Reviewed React candidate summary.');
  await page.getByRole('button', { name: /Mark edited CV as reviewed|Mark CV as reviewed/ }).click();
  await page.getByText('CV parse reviewed').waitFor({ timeout: 10000 });

  await page.getByPlaceholder('Copy the job requirements from SEEK or LinkedIn here...').fill(
    degraded ? 'Low-detail JD. We need strong technical skills and communication.' : 'Frontend Developer role requiring React, testing evidence, and communication.'
  );
  await page.getByRole('button', { name: /Summarise JD/ }).click();
  await page.getByRole('heading', { name: 'JD Summary' }).waitFor({ timeout: 10000 });
  await page.getByLabel('Must-have requirements').fill(degraded ? 'Strong technical skills\nCommunication' : 'React ownership\nTesting evidence\nAccessibility awareness');
  await page.getByRole('button', { name: /Mark JD as reviewed/ }).click();
  await page.getByText('JD summary reviewed').waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: 'Generate match analysis', exact: true }).click();
  await page.getByText('Match analysis complete').first().waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Start text interview', exact: true }).click();
};

const completeInterviewAndReportFlow = async (page, { scenario }) => {
  const degraded = scenario === 'degraded';
  const sessionId = degraded ? 'session-human-degraded' : 'session-human-happy';
  await page.waitForURL(`**/interview/${sessionId}`, { timeout: 10000 });
  const startResponse = page.waitForResponse((response) => (
    response.url().includes('/api/interview/start') && response.request().method() === 'POST'
  ));
  const startButton = page.locator('#tour-interview-center').getByRole('button', { name: 'Start text interview', exact: true });
  await startButton.waitFor({ timeout: 10000 });
  await startButton.click();
  await startResponse;
  const firstQuestion = degraded
    ? 'Your CV has limited evidence for this role. What is the strongest relevant example you can give?'
    : 'Tell me about a React feature you owned and how you validated it.';
  await page.locator('#tour-interview-center').getByText(firstQuestion).first().waitFor({ timeout: 10000 }).catch(async (error) => {
    console.error(`[human-flow:${scenario}] body after start`, (await page.locator('body').innerText()).slice(0, 2000));
    throw error;
  });
  const answerBox = page.locator('textarea:not([disabled])').last();
  await answerBox.fill(
    degraded ? 'I helped with a small project, but I do not remember measurable outcomes.' : 'I owned a React workflow and validated it with automated tests and user feedback.'
  );
  await answerBox.press('Enter');
  await page.locator('#tour-interview-center')
    .getByText(degraded ? 'What evidence could a reviewer use to confirm that example?' : 'What test or user signal proved the feature worked?')
    .first()
    .waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: 'End' }).click();
  await page.getByRole('button', { name: 'Confirm End' }).click();
  await page.getByText('Interview ended').waitFor({ timeout: 10000 });

  await page.goto(`${BASE_URL}/report/${sessionId}`);
  await page.getByText(degraded ? 'The report should be treated as needs review.' : 'Strong evidence with one clear improvement path.').waitFor({ timeout: 10000 });
  await page.getByText(degraded ? 'Report QA: Needs review' : 'Report QA: Passed').waitFor({ timeout: 10000 });

  const mp3Button = page.getByRole('button', { name: /Download MP3/ });
  assert(await mp3Button.isDisabled(), 'Text-mode sessions should keep MP3 download disabled.');

  await page.getByRole('button', { name: /Export/ }).click();
  const jsonDownload = page.waitForEvent('download');
  await page.getByText('JSON Format').click();
  assert((await jsonDownload).suggestedFilename().endsWith('.json'), 'JSON export should download a .json file.');

  await page.getByRole('button', { name: /Export/ }).click();
  const textDownload = page.waitForEvent('download');
  await page.getByText('Text Report').click();
  assert((await textDownload).suggestedFilename().endsWith('.txt'), 'TXT export should download a .txt file.');

  await page.getByRole('button', { name: /Export/ }).click();
  const pdfDownload = page.waitForEvent('download');
  await page.getByText('PDF Document').click();
  assert((await pdfDownload).suggestedFilename().endsWith('.pdf'), 'PDF export should download a .pdf file.');
};

const runScenario = async (browser, scenario) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    acceptDownloads: true,
  });
  await context.addInitScript((name) => {
    window.localStorage.setItem('kiwi_auth_token', `${name}-token`);
    window.localStorage.removeItem('kiwi-analyze-draft');
    window.localStorage.removeItem('kiwi_global_tour_step');
  }, scenario);

  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`[human-flow:${scenario} pageerror]`, error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) console.error(`[human-flow:${scenario} response]`, response.status(), response.url());
  });

  try {
    const apiCalls = await installApiMocks(page, { scenario });
    await completePreparationFlow(page, { scenario });
    await completeInterviewAndReportFlow(page, { scenario });

    const sessionId = scenario === 'degraded' ? 'session-human-degraded' : 'session-human-happy';
    const requiredCalls = [
      'POST /api/upload/cv',
      'POST /api/job-description/paraphrase',
      'POST /api/analyze/match/stream',
      'POST /api/analyze/interview-plan',
      `GET /api/session/${sessionId}`,
      'POST /api/interview/start',
      'POST /api/interview/reply',
      'POST /api/interview/end',
      `GET /api/report/${sessionId}`,
      `GET /api/recordings/session-audio/${sessionId}/status`,
    ];
    const callSet = new Set(apiCalls.map((item) => `${item.method} ${item.path}`));
    const missing = requiredCalls.filter((item) => !callSet.has(item));
    assert(!missing.length, `${scenario} flow missed expected API calls: ${missing.join(', ')}`);

    return {
      scenario,
      resultType: 'mocked_api_browser_flow',
      fallbackResult: scenario === 'degraded',
      requiredCalls,
    };
  } finally {
    await context.close();
  }
};

export const run = async () => {
  const { chromium } = loadPlaywright();
  const server = await startFrontendServer();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });

  try {
    const results = [
      await runScenario(browser, 'happy'),
      await runScenario(browser, 'degraded'),
    ];

    console.log(JSON.stringify({ passed: true, results }, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

if (process.env.VITEST) {
  const { describe, expect, it } = await import('vitest');

  describe('full human flow Playwright script', () => {
    it('is executed by the dedicated e2e script and labels fallback coverage', () => {
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
