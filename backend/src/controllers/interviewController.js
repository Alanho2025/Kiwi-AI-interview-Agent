import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import {
  appendTranscriptTurn,
  createInterviewQuestion,
  createInterviewResponse,
  getLatestQuestionForSession,
  getSessionById,
  updateSession,
} from '../services/sessionService.js';
import { runTask } from '../services/masterAiService.js';
import { createAuditLog } from '../services/auditService.js';
import { getOpeningQuestionText, hasAskedOpeningQuestion } from '../services/interviewStateService.js';

const buildInterviewSystemInstruction = (session) => `
You are a Kiwi AI Interview Agent.

You act like a professional, approachable, and realistic New Zealand-style interviewer.
Your tone is calm, friendly, respectful, practical, and slightly informal in a professional way.
You should sound natural and grounded, not robotic, aggressive, overly formal, or overly talkative.

Your main goal is to help the user practise answering interview questions by speaking more themselves.
You should guide the interview, but you must not dominate it.

Interview context:
- Candidate target role: ${session.targetRole}
- Candidate seniority: ${session.settings?.seniorityLevel || 'Junior/Grad'}
- Candidate strengths from CV/JD match: ${session.analysisResult?.strengths?.join(', ') || 'Not provided'}
- Current gaps or focus areas: ${session.analysisResult?.interviewFocus?.join(', ') || 'Not provided'}
- Candidate CV text excerpt: ${(session.cvText || '').slice(0, 1600) || 'Not provided'}
- JD title: ${session.analysisResult?.matchingDetails?.rubric?.title || session.targetRole || 'Not provided'}
- JD role summary: ${session.analysisResult?.matchingDetails?.rubric?.roleSummary?.join('; ') || 'Not provided'}
- JD qualifications: ${session.analysisResult?.matchingDetails?.rubric?.qualifications?.join('; ') || 'Not provided'}
- JD technical skill requirements: ${session.analysisResult?.matchingDetails?.rubric?.technicalSkillRequirements?.join(', ') || 'Not provided'}
- JD soft skill requirements: ${session.analysisResult?.matchingDetails?.rubric?.softSkillRequirements?.join(', ') || 'Not provided'}

Interview flow rules:
- The first question must always be: "Please introduce yourself."
- After that, ask one question at a time.
- Always continue with relevant follow-up questions based on the user's previous answer.
- Do not rely only on generic question lists.
- Every follow-up question should feel connected, natural, and purposeful.

Question style:
- Keep questions clear, concise, and easy to understand.
- Use short wording.
- Avoid long, complex, or multi-part questions.
- Ask practical and realistic interview questions.
- Use follow-up questions to explore what the user did, why they did it, how they handled challenges, what result they achieved, and what they learned.

Handling weak or vague answers:
- If the user's answer is vague, general, or unclear, ask a short follow-up question to get more detail.
- Ask for a specific example when needed.
- Ask for actions, reasoning, or outcomes when these are missing.
- Politely challenge weak answers, but stay supportive and professional.

Support when the user is confused:
- If the user does not understand a question, you may rephrase it in a simpler way, briefly explain what the question means, or give one short example.
- Keep help brief.
- Do not answer for the user.
- After helping, quickly return the floor to the user.

Conversation balance:
- Keep your own turns short.
- Most of your responses should be 1 to 3 short sentences.
- Do not give long lectures or long coaching by default.
- Give the user space to think and answer.
- Remain primarily in interviewer mode unless the user explicitly asks for coaching or feedback.

New Zealand workplace style:
- Reflect humility, teamwork, accountability, honesty, practical thinking, respect, and willingness to learn where appropriate.
- Encourage genuine, direct, and evidence-based answers.

Cultural safety and factual limits:
- If the conversation touches on Maori culture, tikanga, Te Reo Maori, Te Tiriti o Waitangi, or other culturally specific topics, only provide information if you are certain from the available conversation context.
- If not certain, say exactly: "I'm not sure about that, so I'd rather not guess."
- Never invent cultural explanations, meanings, or facts.
- When uncertain about any factual or cultural topic, choose honesty over guessing.

What to avoid:
- Do not ask multiple unrelated questions at once.
- Do not over-explain simple questions.
- Do not speak more than the user.
- Do not turn the interview into a monologue.
- Do not make up facts about culture, employers, or job requirements.
- Do not give excessive praise after every answer.

Output rules:
- If this is not the first turn, ask exactly one short follow-up question or one brief clarification plus one follow-up question.
- Only output the interviewer text. No bullets. No labels. No metadata.
`;

const updateElapsedSeconds = (session) => {
  if (!session.lastResumedAt) {
    return;
  }

  const elapsedMs = Date.now() - new Date(session.lastResumedAt).getTime();
  if (elapsedMs > 0) {
    session.elapsedSeconds += Math.floor(elapsedMs / 1000);
  }
  session.lastResumedAt = null;
};

export const startInterview = async (req, res, next) => {
  console.log('ENTERING startInterview, sessionId:', req.body?.sessionId);
  try {
    const { sessionId } = req.body;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    const openingQuestion = getOpeningQuestionText(session);
    const nextState = {
      status: 'in_progress',
      lastResumedAt: new Date().toISOString(),
    };

    if (!hasAskedOpeningQuestion(session)) {
      const questionId = await createInterviewQuestion({
        sessionId,
        questionOrder: 1,
        questionType: 'self_intro',
        sourceType: 'template',
        questionText: openingQuestion,
        basedOnCv: false,
        basedOnJd: false,
      });
      await appendTranscriptTurn(sessionId, {
        role: 'ai',
        text: openingQuestion,
        timestamp: new Date().toISOString(),
        questionId,
      });
    }

    const updatedSession = await updateSession(sessionId, nextState);
    await createAuditLog({
      actorUserId: updatedSession.userId,
      targetUserId: updatedSession.userId,
      sessionId,
      actionType: 'start_interview',
      resourceType: 'interview_session',
      resourceId: sessionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log('EXITING startInterview successfully');
    res.json(formatSuccess('Interview started', { question: openingQuestion, session: updatedSession }));
  } catch (error) {
    console.error('ERROR in startInterview:', error.message, error.stack);
    next(error);
  }
};

export const replyInterview = async (req, res, next) => {
  console.log('ENTERING replyInterview, sessionId:', req.body?.sessionId);
  try {
    const { sessionId, answer } = req.body;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));
    if (session.status !== 'in_progress') {
      return res.status(400).json(formatError('Interview is not active', 'INVALID_STATE', 'Resume the interview before replying'));
    }
    if (!answer?.trim()) {
      return res.status(400).json(formatError('Missing answer', 'MISSING_PARAM', 'Please provide an interview answer'));
    }

    const latestQuestion = await getLatestQuestionForSession(sessionId);
    await appendTranscriptTurn(sessionId, { role: 'user', text: answer.trim(), timestamp: new Date().toISOString() });
    if (latestQuestion?.id) {
      await createInterviewResponse({
        sessionId,
        questionId: latestQuestion.id,
        transcriptText: answer.trim(),
      });
    }

    const agentResult = await runTask({
      taskType: 'interview_next_turn',
      sessionId,
      payload: { answer: answer.trim() },
    });

    const sessionPatch = agentResult.isComplete
      ? {
          status: 'completed',
          endedAt: new Date().toISOString(),
          lastResumedAt: null,
        }
      : {
          currentQuestionIndex: agentResult.nextQuestionOrder,
        };

    const updatedSession = await updateSession(sessionId, sessionPatch);

    console.log('EXITING replyInterview successfully');
    res.json(formatSuccess('Reply processed', {
      nextQuestion: agentResult.nextQuestion,
      rationale: agentResult.rationale,
      retrievalSnapshot: agentResult.retrievalSnapshot,
      isComplete: Boolean(agentResult.isComplete),
      completedBecause: agentResult.completedBecause || null,
      session: updatedSession,
    }));
  } catch (error) {
    console.error('ERROR in replyInterview:', error.message, error.stack);
    next(error);
  }
};

export const repeatQuestion = async (req, res, next) => {
  console.log('ENTERING repeatQuestion, sessionId:', req.body?.sessionId);
  try {
    const { sessionId } = req.body;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    const lastAiMessage = session.transcript.filter(m => m.role === 'ai').pop();
    console.log('EXITING repeatQuestion successfully');
    res.json(formatSuccess('Question repeated', { question: lastAiMessage?.text }));
  } catch (error) {
    console.error('ERROR in repeatQuestion:', error.message, error.stack);
    next(error);
  }
};

export const pauseInterview = async (req, res, next) => {
  console.log('ENTERING pauseInterview, sessionId:', req.body?.sessionId);
  try {
    const { sessionId } = req.body;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    updateElapsedSeconds(session);
    session.status = 'paused';
    const updatedSession = await updateSession(sessionId, session);
    console.log('EXITING pauseInterview successfully');
    res.json(formatSuccess('Interview paused', { session: updatedSession }));
  } catch (error) {
    console.error('ERROR in pauseInterview:', error.message, error.stack);
    next(error);
  }
};

export const resumeInterview = async (req, res, next) => {
  console.log('ENTERING resumeInterview, sessionId:', req.body?.sessionId);
  try {
    const { sessionId } = req.body;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    session.status = 'in_progress';
    session.lastResumedAt = new Date().toISOString();
    const updatedSession = await updateSession(sessionId, session);
    console.log('EXITING resumeInterview successfully');
    res.json(formatSuccess('Interview resumed', { session: updatedSession }));
  } catch (error) {
    console.error('ERROR in resumeInterview:', error.message, error.stack);
    next(error);
  }
};

export const endInterview = async (req, res, next) => {
  console.log('ENTERING endInterview, sessionId:', req.body?.sessionId);
  try {
    const { sessionId } = req.body;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    updateElapsedSeconds(session);
    session.status = 'completed';
    const updatedSession = await updateSession(sessionId, session);
    await createAuditLog({
      actorUserId: updatedSession.userId,
      targetUserId: updatedSession.userId,
      sessionId,
      actionType: 'end_interview',
      resourceType: 'interview_session',
      resourceId: sessionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    console.log('EXITING endInterview successfully');
    res.json(formatSuccess('Interview ended', { session: updatedSession }));
  } catch (error) {
    console.error('ERROR in endInterview:', error.message, error.stack);
    next(error);
  }
};
