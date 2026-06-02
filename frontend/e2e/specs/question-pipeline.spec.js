#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const SESSION_ID = 'session-question-pipeline';
const PORT = Number(process.env.E2E_FRONTEND_PORT || 4174);
const BASE_URL = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${PORT}`;

const loadPlaywright = () => {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(`Playwright is required for the question-pipeline spec. Original error: ${error.message}`, { cause: error });
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

const success = (data = {}, message = 'ok') => ({
  success: true,
  message,
  data,
  error: null,
});

const cvFile = {
  id: 'cv-question-pipeline',
  name: 'Question Pipeline CV.pdf',
  size: '92 KB',
  updated: '2026-06-02',
  type: 'application/pdf',
  parseStatus: 'completed',
  profileStatus: 'completed',
  parseConfidence: 0.93,
  candidateName: 'Pipeline Candidate',
  topSkills: ['React', 'testing', 'communication'],
};

const rawJD = 'Frontend Developer role requiring React, testing evidence, and communication.';

const jdRubric = {
  title: 'Frontend Developer',
  jobTitle: 'Frontend Developer',
  jobOverview: { title: 'Frontend Developer', companyName: 'Pipeline Ltd' },
  sections: {
    responsibilities: ['Build customer-facing React interfaces'],
    mustHaveRequirements: ['React ownership', 'testing evidence'],
    softSkills: ['communication'],
    technicalSkills: { softwareDevelopment: [{ label: 'React' }, { label: 'testing' }] },
  },
  metadata: { confidence: 0.95 },
  diagnostics: { confidence: 0.95 },
};

const structuredJD = '# Frontend Developer\n\nReact, testing evidence, and communication.';

const baseDiagnostics = {
  cvSeedsCount: 5,
  cvSeedSamples: [
    { seedId: 'seed-project', sourceType: 'cv_project', category: 'technical', topic: 'Forkcast Food AI Assistant', questionIntent: 'validate_ownership', projectTags: ['Forkcast Food AI Assistant'] },
    { seedId: 'seed-skill', sourceType: 'cv_skill', category: 'technical', topic: 'testing', questionIntent: 'validate_depth' },
    { seedId: 'seed-behavioural', sourceType: 'cv_behavioural', category: 'behavioural', topic: 'communication', questionIntent: 'behavioural_star' },
  ],
  jdPrioritySummary: {
    roleTitle: 'Frontend Developer',
    priorityTechnicalSkills: ['React', 'testing'],
    behaviouralPriorities: ['communication'],
    mustProbeRequirements: ['React ownership', 'testing evidence'],
    questionPlanningHints: { priorityTopics: ['React', 'testing evidence'] },
  },
  jdFilterReady: true,
  jdFilterDecisionCounts: { boost: 1, adapt: 1, keep: 2, suppress: 1 },
  preparedRootQuestionCount: 4,
  fallbackRootQuestionCount: 1,
  wrapUpQuestionCount: 1,
  matchGapQuestionCount: 1,
  poolDegraded: false,
  poolDegradedReason: null,
  sessionMemoryLoaded: false,
  warmContextHit: false,
  artifactCacheHit: false,
};

const diagnosticsForStage = (stage) => ({
  initial: {
    ...baseDiagnostics,
    askedPreparedRootCount: 0,
    latestTurnKind: 'root_question',
    latestScenario: 'root_cv_evidence',
    latestPreparedQuestionId: 'root-cv',
    latestParentQuestionId: null,
    latestFollowUpIntent: null,
  },
  followUp: {
    ...baseDiagnostics,
    askedPreparedRootCount: 1,
    latestTurnKind: 'follow_up',
    latestScenario: 'intro_follow_up',
    latestPreparedQuestionId: null,
    latestParentQuestionId: 'root-cv-question',
    latestFollowUpIntent: 'ownership',
  },
  nextRoot: {
    ...baseDiagnostics,
    askedPreparedRootCount: 2,
    latestTurnKind: 'root_question',
    latestScenario: 'root_match_gap',
    latestPreparedQuestionId: 'root-gap',
    latestParentQuestionId: null,
    latestFollowUpIntent: null,
  },
}[stage] || baseDiagnostics);

const buildSession = ({ stage = 'initial' } = {}) => {
  const transcriptByStage = {
    initial: [{
      role: 'ai',
      questionId: 'root-cv-question',
      text: 'Your CV says you used React in Forkcast Food AI Assistant. How did you apply it in the actual implementation?',
      displayText: 'Your CV says you used React in Forkcast Food AI Assistant. How did you apply it in the actual implementation?',
      metadata: {
        turnKind: 'root_question',
        scenario: 'root_cv_evidence',
        preparedQuestionId: 'root-cv',
        questionDecision: { turnKind: 'root_question', preparedQuestionId: 'root-cv' },
      },
    }],
    followUp: [
      {
        role: 'ai',
        questionId: 'root-cv-question',
        text: 'Your CV says you used React in Forkcast Food AI Assistant. How did you apply it in the actual implementation?',
        metadata: { turnKind: 'root_question', preparedQuestionId: 'root-cv' },
      },
      { role: 'user', text: 'I used React in Forkcast for the UI.' },
      {
        role: 'ai',
        questionId: 'follow-up-1',
        text: 'What part of the React work did you personally own?',
        displayText: 'What part of the React work did you personally own?',
        metadata: {
          turnKind: 'follow_up',
          scenario: 'intro_follow_up',
          parentQuestionId: 'root-cv-question',
          parentPreparedQuestionId: 'root-cv',
          preparedQuestionId: null,
        },
      },
    ],
    nextRoot: [
      {
        role: 'ai',
        questionId: 'root-cv-question',
        text: 'Your CV says you used React in Forkcast Food AI Assistant. How did you apply it in the actual implementation?',
        metadata: { turnKind: 'root_question', preparedQuestionId: 'root-cv' },
      },
      { role: 'user', text: 'I used React in Forkcast for the UI.' },
      {
        role: 'ai',
        questionId: 'follow-up-1',
        text: 'What part of the React work did you personally own?',
        metadata: { turnKind: 'follow_up', parentQuestionId: 'root-cv-question', preparedQuestionId: null },
      },
      { role: 'user', text: 'I owned the UI components and validated them with tests.' },
      {
        role: 'ai',
        questionId: 'root-gap-question',
        text: 'How did you validate the testing evidence for that React work?',
        displayText: 'How did you validate the testing evidence for that React work?',
        metadata: {
          turnKind: 'root_question',
          scenario: 'root_match_gap',
          preparedQuestionId: 'root-gap',
          questionDecision: { turnKind: 'root_question', preparedQuestionId: 'root-gap' },
        },
      },
    ],
  };

  return {
    id: SESSION_ID,
    status: 'in_progress',
    mode: 'text',
    candidateName: 'Pipeline Candidate',
    targetRole: 'Frontend Developer',
    currentQuestionIndex: stage === 'nextRoot' ? 3 : stage === 'followUp' ? 2 : 1,
    totalQuestions: 8,
    transcript: transcriptByStage[stage],
    analysisSetup: {
      selectedCV: cvFile,
      rawJD,
      structuredJD,
      structuredJDRubric: jdRubric,
      settings: { focusArea: 'technical', seniorityLevel: 'Junior/Grad', questionCount: 8, durationMinutes: 20 },
      sessionMode: 'text',
    },
    analysisResult: matchResult,
  };
};

const matchResult = {
  matchScore: 78,
  matchAnalysisId: 'match-question-pipeline',
  jobTitle: 'Frontend Developer',
  strengths: ['React project evidence'],
  gaps: ['testing evidence'],
  requirementChecks: [
    { requirement: 'React ownership', met: true, category: 'technical' },
    { requirement: 'testing evidence', met: false, category: 'technical' },
  ],
  matchingDetails: {
    questionPlanHints: {
      mustProbeSkills: ['React', 'testing'],
      mustProbeBehavioural: ['communication'],
      priorityTopics: ['React', 'testing evidence'],
    },
  },
  parsedJdProfile: jdRubric,
};

const installApiMocks = async (page) => {
  let sessionStage = 'initial';
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
      await route.fulfill(jsonResponse(success({ user: { id: 'user-1', email: 'pipeline@example.test' } })));
      return;
    }
    if (method === 'GET' && url.pathname === '/api/auth/google/config') {
      await route.fulfill(jsonResponse(success({ clientId: 'question-pipeline-client' })));
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
    if (method === 'POST' && url.pathname === '/api/upload/cv') {
      await route.fulfill(jsonResponse(success({
        ...cvFile,
        questionSeedSummary: { created: baseDiagnostics.cvSeedsCount },
      })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/analyze/match') {
      await route.fulfill(jsonResponse(success(matchResult)));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/analyze/interview-plan') {
      await route.fulfill(jsonResponse(success({
        sessionId: SESSION_ID,
        preparedRootQuestionCount: baseDiagnostics.preparedRootQuestionCount,
        matchGapQuestionCount: baseDiagnostics.matchGapQuestionCount,
      })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/session/${SESSION_ID}`) {
      await route.fulfill(jsonResponse(success({ session: buildSession({ stage: sessionStage }) })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/interview/warm-adaptive') {
      await route.fulfill(jsonResponse(success({ warmed: true })));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/interview/reply') {
      sessionStage = sessionStage === 'initial' ? 'followUp' : 'nextRoot';
      const session = buildSession({ stage: sessionStage });
      const latestAi = [...session.transcript].reverse().find((turn) => turn.role === 'ai');
      await route.fulfill(jsonResponse(success({
        nextQuestion: latestAi.text,
        isComplete: false,
        session,
      })));
      return;
    }
    if (method === 'GET' && url.pathname === `/api/interview/${SESSION_ID}/question-diagnostics`) {
      await route.fulfill(jsonResponse(success({ diagnostics: diagnosticsForStage(sessionStage) })));
      return;
    }

    await route.fulfill(jsonResponse({ success: false, message: `Unhandled mock route: ${method} ${url.pathname}` }, 404));
  });

  return apiCalls;
};

const loadDiagnostics = async (page) => page.evaluate(async (sessionId) => {
  const response = await fetch(`/api/interview/${sessionId}/question-diagnostics`, {
    headers: { Authorization: 'Bearer question-pipeline-token' },
  });
  const payload = await response.json();
  return payload.data.diagnostics;
}, SESSION_ID);

const assertPreparedArtifacts = (diagnostics) => {
  assert(diagnostics.cvSeedsCount > 0, 'CV upload/review should create seed questions.');
  assert(diagnostics.cvSeedSamples.some((seed) => seed.sourceType === 'cv_project'), 'CV seeds should include project-specific seeds.');
  assert(diagnostics.cvSeedSamples.some((seed) => seed.category === 'technical'), 'CV seeds should include technical seeds.');
  assert(diagnostics.cvSeedSamples.some((seed) => seed.category === 'behavioural'), 'CV seeds should include behavioural seeds.');
  assert(diagnostics.jdPrioritySummary.priorityTechnicalSkills.includes('React'), 'JD priorities should include technical requirements.');
  assert(diagnostics.jdPrioritySummary.behaviouralPriorities.includes('communication'), 'JD priorities should include behavioural requirements.');
  assert(diagnostics.jdFilterReady, 'Match should create JD filter decisions.');
  assert(diagnostics.jdFilterDecisionCounts.boost >= 1, 'Match should create boosted seed decisions.');
  assert(diagnostics.preparedRootQuestionCount >= 3, 'Interview plan should create a prepared root pool.');
  assert(diagnostics.matchGapQuestionCount >= 1, 'Prepared root pool should include match-gap root questions.');
};

const run = async () => {
  const { chromium } = loadPlaywright();
  const server = await startFrontendServer();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
    await context.addInitScript(() => {
      window.localStorage.setItem('kiwi_auth_token', 'question-pipeline-token');
    });

    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('[question-pipeline pageerror]', error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) console.error('[question-pipeline response]', response.status(), response.url());
    });

    const apiCalls = await installApiMocks(page);

    await page.goto(`${BASE_URL}/analysis`);
    await page.locator('#tour-analyze-actions').waitFor({ timeout: 10000 }).catch(async (error) => {
      console.error('[question-pipeline] current URL', page.url());
      console.error('[question-pipeline] body', (await page.locator('body').innerText()).slice(0, 2000));
      throw error;
    });

    const preparationResult = await page.evaluate(async ({ rawJDValue, rubric }) => {
      const authHeaders = { Authorization: 'Bearer question-pipeline-token' };
      const form = new FormData();
      form.append('cv', new Blob(['React CV'], { type: 'application/pdf' }), 'cv.pdf');
      const uploadResponse = await fetch('/api/upload/cv', {
        method: 'POST',
        headers: authHeaders,
        body: form,
      }).then((response) => response.json());
      const matchResponse = await fetch('/api/analyze/match', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvId: uploadResponse.data.id,
          rawJD: rawJDValue,
          jdRubric: rubric,
          settings: { focusArea: 'technical', seniorityLevel: 'Junior/Grad' },
        }),
      }).then((response) => response.json());
      const planResponse = await fetch('/api/analyze/interview-plan', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvId: uploadResponse.data.id,
          rawJD: rawJDValue,
          jdText: '# Frontend Developer',
          jdRubric: rubric,
          settings: { focusArea: 'technical', seniorityLevel: 'Junior/Grad' },
          sessionSetup: { mode: 'text' },
          mode: 'text',
          matchAnalysisId: matchResponse.data.matchAnalysisId,
        }),
      }).then((response) => response.json());
      return { uploadResponse, matchResponse, planResponse };
    }, { rawJDValue: rawJD, rubric: jdRubric });

    assert(preparationResult.uploadResponse.data.questionSeedSummary.created >= 3, 'Browser upload should expose created CV seed count.');
    assert(preparationResult.matchResponse.data.gaps.includes('testing evidence'), 'Browser match should expose strengths and gaps.');
    assert(preparationResult.planResponse.data.sessionId === SESSION_ID, 'Browser interview plan should create the prepared session.');

    await page.goto(`${BASE_URL}/interview/${SESSION_ID}`);
    await page.waitForURL(`**/interview/${SESSION_ID}`, { timeout: 10000 });

    const initialDiagnostics = await loadDiagnostics(page);
    assertPreparedArtifacts(initialDiagnostics);
    assert(initialDiagnostics.latestTurnKind === 'root_question', 'First meaningful interview question should be a root question.');
    assert(initialDiagnostics.latestPreparedQuestionId === 'root-cv', 'First root question should come from prepared pool when available.');

    await page.getByPlaceholder('Type your answer here...').fill('I used React in Forkcast for the UI.');
    await page.getByPlaceholder('Type your answer here...').press('Enter');
    await page.getByText('What part of the React work did you personally own?').first().waitFor({ timeout: 10000 });

    const followUpDiagnostics = await loadDiagnostics(page);
    assert(followUpDiagnostics.latestTurnKind === 'follow_up', 'Candidate introduction should trigger a follow-up when shallow.');
    assert(followUpDiagnostics.latestScenario === 'intro_follow_up', 'Follow-up should preserve the intro-follow-up scenario.');
    assert(followUpDiagnostics.latestPreparedQuestionId === null, 'Follow-up should not consume a prepared root item.');
    assert(followUpDiagnostics.latestParentQuestionId === 'root-cv-question', 'Follow-up should stay linked to the parent question.');
    assert(followUpDiagnostics.askedPreparedRootCount === 1, 'Follow-up should not increment asked prepared root count.');

    await page.getByPlaceholder('Type your answer here...').fill('I owned the UI components and validated them with tests.');
    await page.getByPlaceholder('Type your answer here...').press('Enter');
    await page.getByText('How did you validate the testing evidence for that React work?').first().waitFor({ timeout: 10000 });

    const nextRootDiagnostics = await loadDiagnostics(page);
    assert(nextRootDiagnostics.latestTurnKind === 'root_question', 'After enough depth, the next question should return to root selection.');
    assert(nextRootDiagnostics.latestScenario === 'root_match_gap', 'Match-gap question should be available and selectable.');
    assert(nextRootDiagnostics.latestPreparedQuestionId === 'root-gap', 'The selected match-gap question should consume a prepared root item.');
    assert(nextRootDiagnostics.askedPreparedRootCount === 2, 'Root turns should increment asked prepared root count.');

    const requiredCalls = [
      'GET /api/auth/me',
      'POST /api/analyze/match',
      'POST /api/analyze/interview-plan',
      `GET /api/session/${SESSION_ID}`,
      `GET /api/interview/${SESSION_ID}/question-diagnostics`,
      'POST /api/upload/cv',
      'POST /api/interview/reply',
    ];
    const callSet = new Set(apiCalls.map((item) => `${item.method} ${item.path}`));
    const missing = requiredCalls.filter((item) => !callSet.has(item));
    assert(!missing.length, `Browser flow missed expected API calls: ${missing.join(', ')}`);

    console.log(JSON.stringify({
      passed: true,
      scenarios: [
        'cv_seeds',
        'jd_priorities',
        'match_filter_decisions',
        'prepared_root_pool',
        'prepared_root_first_question',
        'intro_follow_up',
        'follow_up_parent_no_consumption',
        'return_to_match_gap_root',
      ],
    }, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
};

if (process.env.VITEST) {
  const { describe, expect, it } = await import('vitest');

  describe('question pipeline Playwright script', () => {
    it('is executed by the dedicated e2e script', () => {
      expect(typeof run).toBe('function');
      expect(SESSION_ID).toBe('session-question-pipeline');
    });
  });
} else {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
