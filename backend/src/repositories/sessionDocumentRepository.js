import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { InterviewPlan } from '../db/models/interviewPlanModel.js';
import { SessionTranscript } from '../db/models/sessionTranscriptModel.js';

const retentionDate = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

export const upsertSessionAnalysis = async ({
  sessionId,
  userId,
  cvDocumentId,
  jdStructuredText,
  jdRubric,
  analysisResult,
}) =>
  SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      cvDocumentId,
      jdStructuredText,
      jdRubric,
      matchSummary: {
        candidateName: analysisResult?.candidateName,
        jobTitle: analysisResult?.jobTitle,
        matchScore: analysisResult?.matchScore,
        strengths: analysisResult?.strengths || [],
        gaps: analysisResult?.gaps || [],
        interviewFocus: analysisResult?.interviewFocus || [],
      },
      matchingDetails: analysisResult?.matchingDetails || {},
      analysisStatus: 'completed',
      retentionUntil: retentionDate(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

export const upsertInterviewPlanDocument = async ({
  sessionId,
  userId,
  settings,
  candidateName,
  targetRole,
  analysisResult,
}) =>
  InterviewPlan.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      settingsSnapshot: settings,
      candidateName,
      jobTitle: targetRole,
      matchScore: analysisResult?.matchScore || 0,
      strengths: analysisResult?.strengths || [],
      gaps: analysisResult?.gaps || [],
      interviewFocus: analysisResult?.interviewFocus || [],
      planPreview: analysisResult?.planPreview || '',
      strategy: {
        opening: 1,
        followUp: 3,
        technical: 2,
        behavioural: 2,
      },
      questionPool: [
        { type: 'self_intro', text: 'Please introduce yourself.', reason: 'default opener', priority: 1 },
        ...(analysisResult?.interviewFocus || []).slice(0, 3).map((item, index) => ({
          type: 'follow_up',
          text: `Can you share a specific example related to ${item}?`,
          reason: 'Generated from match gaps/focus',
          priority: index + 2,
          basedOnSkills: [item],
        })),
      ],
      fallbackRules: {
        short_answer: 'ask_probe',
        time_low: 'end_early',
      },
      retentionUntil: retentionDate(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

export const ensureTranscriptDocument = async ({ sessionId, userId }) =>
  SessionTranscript.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      turns: [],
      fullTranscript: '',
      redactedTranscript: '',
      lastTurnOrder: 0,
      retentionUntil: retentionDate(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

export const findSessionDocuments = async ({ sessionId, cvFileId }) => {
  const [plan, transcript, analysis] = await Promise.all([
    InterviewPlan.findOne({ sessionId }).lean(),
    SessionTranscript.findOne({ sessionId }).lean(),
    SessionAnalysis.findOne({ sessionId }).lean(),
  ]);

  return { plan, transcript, analysis, cvFileId };
};

const buildFullTranscript = (turns) => turns.map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`).join('\n\n');

export const appendTranscriptTurnDocument = async (sessionId, turn) => {
  const transcript = await SessionTranscript.findOne({ sessionId });
  if (!transcript) {
    return null;
  }

  const nextTurn = {
    role: turn.role,
    text: turn.text,
    timestamp: new Date(turn.timestamp || new Date()),
    questionId: turn.questionId,
    source: turn.source || 'app',
    durationSeconds: turn.durationSeconds,
    metadata: turn.metadata || {},
  };

  transcript.turns.push(nextTurn);
  transcript.lastTurnOrder = transcript.turns.length;
  transcript.fullTranscript = buildFullTranscript(transcript.turns);
  transcript.redactedTranscript = transcript.fullTranscript;
  await transcript.save();

  return {
    role: nextTurn.role,
    text: nextTurn.text,
    timestamp: nextTurn.timestamp.toISOString(),
    questionId: nextTurn.questionId,
  };
};

export const updateInterviewPlanSnapshot = async ({ sessionId, settings, analysisResult, current }) => {
  await InterviewPlan.findOneAndUpdate(
    { sessionId },
    {
      ...(settings ? { settingsSnapshot: settings } : {}),
      ...(analysisResult
        ? {
            candidateName: analysisResult.candidateName ?? current.analysisResult?.candidateName ?? current.candidateName,
            jobTitle: analysisResult.jobTitle ?? current.analysisResult?.jobTitle ?? current.targetRole,
            matchScore: analysisResult.matchScore ?? current.analysisResult?.matchScore ?? 0,
            strengths: analysisResult.strengths ?? current.analysisResult?.strengths ?? [],
            gaps: analysisResult.gaps ?? current.analysisResult?.gaps ?? [],
            interviewFocus: analysisResult.interviewFocus ?? current.analysisResult?.interviewFocus ?? [],
            planPreview: analysisResult.planPreview ?? current.analysisResult?.planPreview ?? '',
          }
        : {}),
    },
    { returnDocument: 'after' }
  );
};
