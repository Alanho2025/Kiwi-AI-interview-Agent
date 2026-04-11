/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: masterAiService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { agentRegistry } from './agentRegistryService.js';
import { getSessionById, appendTranscriptTurn, createInterviewQuestion } from './sessionService.js';
import { getNextQuestionOrder, hasReachedQuestionLimit } from './interviewStateService.js';
import { indexSessionArtifacts } from './ragIndexService.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { SessionReport } from '../db/models/sessionReportModel.js';

/**
 * Purpose: Execute the main responsibility for persistReportArtifact.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const persistReportArtifact = async ({ sessionId, report, qaResult }) => {
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: {
        reportArtifacts: {
          createdAt: new Date(),
          report,
          qaResult,
        },
      },
    },
    { upsert: true }
  );

  return SessionReport.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      report,
      qaResult,
      latestStatus: qaResult?.passed ? 'ready' : 'needs_review',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Purpose: Execute the main responsibility for runTask.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const runTask = async ({ taskType, sessionId, payload = {} } = {}) => {
  if (!taskType) {
    throw new Error('taskType is required');
  }

  if (taskType === 'interview_next_turn') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (hasReachedQuestionLimit(session)) {
      return {
        isComplete: true,
        completedBecause: 'question_limit_reached',
        nextQuestion: null,
        nextQuestionOrder: session.currentQuestionIndex,
        rationale: 'Interview completed after the planned question limit.',
        retrievalSnapshot: null,
      };
    }

    await indexSessionArtifacts(sessionId);
    const retrievalBundle = await agentRegistry.retrieval({
      query: `${session.targetRole} ${session.analysisResult?.matchingDetails?.questionPlanHints?.roleCanonical || ''} ${(session.analysisResult?.interviewFocus || []).join(' ')} ${(payload.answer || '').slice(0, 300)}`,
      sessionId,
      sourceTypes: ['question_bank', 'behavioural_bank', 'interview_plan', 'jd_rubric', 'cv_profile', 'transcript'],
      topK: 5,
    });
    const interviewerOutput = await agentRegistry.interviewer({ session, retrievalBundle });

    if (interviewerOutput?.isComplete || !interviewerOutput?.nextQuestion) {
      return {
        ...interviewerOutput,
        isComplete: true,
        completedBecause: interviewerOutput?.completedBecause || 'question_limit_reached',
        nextQuestion: null,
        nextQuestionOrder: session.currentQuestionIndex,
      };
    }

    const nextQuestionOrder = getNextQuestionOrder(session);
    const questionId = await createInterviewQuestion({
      sessionId,
      questionOrder: nextQuestionOrder,
      questionType: interviewerOutput.questionType || 'follow_up',
      sourceType: interviewerOutput.sourceType || 'agent_generated',
      questionText: interviewerOutput.nextQuestion,
      basedOnCv: true,
      basedOnJd: true,
    });

    await appendTranscriptTurn(sessionId, {
      role: 'ai',
      text: interviewerOutput.nextQuestion,
      timestamp: new Date().toISOString(),
      questionId,
      metadata: {
        stage: interviewerOutput.stage,
        topic: interviewerOutput.topic,
        evidenceTypeHint: interviewerOutput.evidenceTypeHint || null,
      },
    });

    return { ...interviewerOutput, nextQuestionOrder, isComplete: false };
  }

  if (taskType === 'generate_report') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    await indexSessionArtifacts(sessionId);
    const retrievalBundle = await agentRegistry.retrieval({
      query: `${session.targetRole} report summary evidence`,
      sessionId,
      sourceTypes: ['cv_profile', 'jd_rubric', 'interview_plan', 'transcript'],
      topK: 8,
    });

    const report = await agentRegistry.reportGenerator({
      session,
      analysisResult: session.analysisResult || {},
      interviewPlan: session.interviewPlan || {},
      retrievalBundle,
    });

    const qaResult = await agentRegistry.reportQa({
      report,
      analysisResult: session.analysisResult || {},
      retrievalBundle,
    });

    const stored = await persistReportArtifact({ sessionId, report, qaResult });
    return { report, qaResult, stored };
  }

  if (taskType === 'qa_report') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const stored = await SessionReport.findOne({ sessionId }).lean();
    if (!stored?.report) {
      throw new Error('Report not found');
    }

    await indexSessionArtifacts(sessionId);
    const retrievalBundle = await agentRegistry.retrieval({
      query: `${session.targetRole} report qa evidence`,
      sessionId,
      sourceTypes: ['cv_profile', 'jd_rubric', 'interview_plan', 'transcript'],
      topK: 8,
    });

    const qaResult = await agentRegistry.reportQa({
      report: stored.report,
      analysisResult: session.analysisResult || {},
      retrievalBundle,
    });
    const updated = await persistReportArtifact({ sessionId, report: stored.report, qaResult });
    return { report: stored.report, qaResult, stored: updated };
  }

  throw new Error(`Unsupported task type: ${taskType}`);
};
