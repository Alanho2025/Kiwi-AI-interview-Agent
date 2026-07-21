import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  resolveUserFromRequest: vi.fn(),
  loadOwnedSessionOrThrow: vi.fn(),
  ensureInterviewInProgress: vi.fn(),
  normalizeInterviewAnswer: vi.fn(),
  saveInterviewAnswer: vi.fn(),
  applyElapsedSeconds: vi.fn(),
  pauseInterviewSession: vi.fn(),
  reconcileInterviewQuestionPool: vi.fn(),
  resumeInterviewSession: vi.fn(),
  completeInterviewSession: vi.fn(),
  createInterviewQuestion: vi.fn(),
  appendTranscriptTurn: vi.fn(),
  updateSession: vi.fn(),
  getOwnedSessionById: vi.fn(),
  runTask: vi.fn(),
  warmAdaptiveSession: vi.fn(),
  createInterviewLifecycleAuditLog: vi.fn(),
  getSessionExecutionCost: vi.fn(),
}));

vi.mock('../../../src/services/authService.js', () => ({
  CURRENT_PRIVACY_POLICY_VERSION: 'privacy_act_2020_v1',
  getUserById: serviceMocks.getUserById,
  findOrCreateGoogleUser: vi.fn(),
  resolveUserFromRequest: serviceMocks.resolveUserFromRequest,
}));

vi.mock('../../../src/services/interview/interviewSessionService.js', () => ({
  requireSessionId: (sessionId) => {
    if (!sessionId) {
      const error = new Error('Missing sessionId');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.expose = true;
      throw error;
    }
  },
  loadOwnedSessionOrThrow: serviceMocks.loadOwnedSessionOrThrow,
  ensureInterviewInProgress: serviceMocks.ensureInterviewInProgress,
  normalizeInterviewAnswer: serviceMocks.normalizeInterviewAnswer,
  saveInterviewAnswer: serviceMocks.saveInterviewAnswer,
  applyElapsedSeconds: serviceMocks.applyElapsedSeconds,
  pauseInterviewSession: serviceMocks.pauseInterviewSession,
  reconcileInterviewQuestionPool: serviceMocks.reconcileInterviewQuestionPool,
  resumeInterviewSession: serviceMocks.resumeInterviewSession,
  completeInterviewSession: serviceMocks.completeInterviewSession,
  saveInterviewAnswerWithDetails: vi.fn(),
}));

vi.mock('../../../src/services/sessionService.js', () => ({
  createInterviewQuestion: serviceMocks.createInterviewQuestion,
  appendTranscriptTurn: serviceMocks.appendTranscriptTurn,
  updateSession: serviceMocks.updateSession,
  getOwnedSessionById: serviceMocks.getOwnedSessionById,
}));

vi.mock('../../../src/services/masterAiService.js', () => ({
  runTask: serviceMocks.runTask,
  warmAdaptiveSession: serviceMocks.warmAdaptiveSession,
}));

vi.mock('../../../src/services/interview/interviewAuditService.js', () => ({
  createInterviewLifecycleAuditLog: serviceMocks.createInterviewLifecycleAuditLog,
}));

vi.mock('../../../src/services/aiUsageTrackingService.js', () => ({
  getSessionExecutionCost: serviceMocks.getSessionExecutionCost,
}));

const listen = (server) => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const closeServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

const postJson = async ({ baseUrl, path, token, body }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
};

describe('interview/report route integration', () => {
  let server;
  let baseUrl;
  let token;
  let session;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'integration-test-secret';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client';
    token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    session = {
      id: 'session-1',
      userId: 'user-1',
      status: 'ready',
      mode: 'text',
      candidateName: 'Candidate',
      targetRole: 'Data Analyst',
      totalQuestions: 2,
      elapsedSeconds: 0,
      lastResumedAt: null,
      transcript: [],
      interviewPlan: {
        questionPool: [{
          text: 'Please introduce yourself for this Data Analyst interview.',
          type: 'self_intro',
          category: 'opening',
          topic: 'self_intro',
        }],
      },
    };

    serviceMocks.getUserById.mockResolvedValue({ id: 'user-1', email: 'user@example.test', full_name: 'Test User' });
    serviceMocks.resolveUserFromRequest.mockImplementation(async (req) => ({ id: req.user?.id || 'user-1', email: 'user@example.test' }));
    serviceMocks.loadOwnedSessionOrThrow.mockImplementation(async () => session);
    serviceMocks.getOwnedSessionById.mockImplementation(async (sessionId, userId) => (
      sessionId === session.id && userId === session.userId ? session : null
    ));
    serviceMocks.ensureInterviewInProgress.mockImplementation((value) => {
      if (value.status !== 'in_progress') throw new Error('Interview is not active');
    });
    serviceMocks.normalizeInterviewAnswer.mockImplementation((answer) => {
      const clean = String(answer || '').trim();
      if (!clean) throw new Error('Missing answer');
      return clean;
    });
    serviceMocks.createInterviewQuestion.mockResolvedValue('question-1');
    serviceMocks.appendTranscriptTurn.mockImplementation(async (_sessionId, turn) => {
      session = { ...session, transcript: [...session.transcript, turn] };
    });
    serviceMocks.updateSession.mockImplementation(async (_sessionId, _userId, patch) => {
      session = { ...session, ...patch };
      return session;
    });
    serviceMocks.saveInterviewAnswer.mockImplementation(async (_sessionId, answerText) => {
      session = {
        ...session,
        transcript: [...session.transcript, { role: 'user', text: answerText }],
      };
    });
    serviceMocks.applyElapsedSeconds.mockImplementation((value) => ({ ...value, elapsedSeconds: value.elapsedSeconds || 0 }));
    serviceMocks.runTask.mockImplementation(async ({ taskType }) => {
      if (taskType === 'interview_next_turn') {
        return {
          nextQuestion: 'Tell me about a reporting workflow you improved.',
          interviewerTurn: { text: 'Tell me about a reporting workflow you improved.' },
          rationale: 'private-proof-point-reason',
          retrievalSnapshot: { items: [{ evidenceId: 'private-evidence-live' }] },
          isComplete: false,
          nextQuestionOrder: 2,
          evaluatorOutput: { score: 0.8, proofPointId: 'private-proof-point-live' },
          reactTrace: { tools: ['ask_interview_question'], thoughtSummary: 'private-thought-live' },
        };
      }
      if (taskType === 'generate_report') {
        const roleFit = {
          schemaVersion: 'role_fit_report_v1',
          status: 'ready',
          roleIntentCoverage: { total: 1, covered: 1, partial: 0, missing: 0, items: [] },
          answerAlignments: [{ question: 'Reporting workflow', score: 82, label: 'strong' }],
          evidenceUsageMap: { totalUses: 1, items: [] },
          questionReasoning: [],
        };
        return {
          report: { sessionId: session.id, scores: { overall: 82 }, summary: 'Grounded report.', roleFit },
          qaResult: { passed: true },
          stored: { latestStatus: 'ready', report: { summary: 'Grounded report.', roleFit } },
        };
      }
      return {};
    });
    serviceMocks.getSessionExecutionCost.mockResolvedValue({
      sessionId: session.id,
      summary: { totalCost: 0.00042, totalTokens: 120 },
      commercialStressTest: { totalExecutionCost: 0.00042, totalLlmTokens: 120 },
    });

    const api = (await import('../../../src/api.js')).default;
    const app = express();
    app.use('/api', api);
    server = http.createServer(app);
    const port = await listen(server);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (server?.listening) await closeServer(server);
  });

  it('runs start interview, submit answer, and generate report through HTTP routes', async () => {
    const started = await postJson({
      baseUrl,
      path: '/api/interview/start',
      token,
      body: { sessionId: session.id },
    });

    expect(started.response.status).toBe(200);
    expect(started.payload.data.question).toContain('introduce yourself');
    expect(started.payload.data.session.status).toBe('in_progress');
    expect(serviceMocks.createInterviewQuestion).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: session.id,
      questionOrder: 1,
      questionType: 'self_intro',
    }));
    expect(serviceMocks.appendTranscriptTurn).toHaveBeenCalledWith(session.id, expect.objectContaining({
      role: 'ai',
      questionId: 'question-1',
    }));

    const replied = await postJson({
      baseUrl,
      path: '/api/interview/reply',
      token,
      body: { sessionId: session.id, answer: 'I built weekly SQL reports and reduced manual reconciliation.' },
    });

    expect(replied.response.status).toBe(200);
    expect(replied.payload.data.nextQuestion).toContain('reporting workflow');
    expect(replied.payload.data.session.currentQuestionIndex).toBe(2);
    expect(JSON.stringify(replied.payload.data)).not.toMatch(/private-proof-point|private-evidence-live|private-thought-live/);
    expect(serviceMocks.saveInterviewAnswer).toHaveBeenCalledWith(session.id, 'I built weekly SQL reports and reduced manual reconciliation.');
    expect(serviceMocks.runTask).toHaveBeenCalledWith(expect.objectContaining({
      taskType: 'interview_next_turn',
      sessionId: session.id,
    }));

    const report = await postJson({
      baseUrl,
      path: '/api/report/generate',
      token,
      body: { sessionId: session.id },
    });

    expect(report.response.status).toBe(200);
    expect(report.payload.data.report.summary).toBe('Grounded report.');
    expect(report.payload.data.report.roleFit).toMatchObject({
      schemaVersion: 'role_fit_report_v1',
      status: 'ready',
      roleIntentCoverage: { total: 1, covered: 1 },
    });
    expect(report.payload.data.executionCost.summary.totalCost).toBe(0.00042);
    expect(report.payload.data.commercialStressTest.totalLlmTokens).toBe(120);
    expect(serviceMocks.getOwnedSessionById).toHaveBeenCalledWith(session.id, 'user-1');
    expect(serviceMocks.getSessionExecutionCost).toHaveBeenCalledWith({ userId: 'user-1', sessionId: session.id });
  });
});
