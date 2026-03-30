import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { getSessionById, updateSession } from '../services/sessionService.js';

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
  try {
    const { sessionId } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    const firstQuestion = "Please introduce yourself.";
    
    session.status = 'in_progress';
    session.lastResumedAt = new Date().toISOString();
    
    // Prevent duplicate opening questions (e.g. from React Strict Mode double-firing)
    if (session.transcript.length === 0) {
      session.transcript.push({ role: 'ai', text: firstQuestion, timestamp: new Date().toISOString() });
    }
    
    updateSession(sessionId, session);

    res.json(formatSuccess('Interview started', { question: firstQuestion, session }));
  } catch (error) {
    next(error);
  }
};

export const replyInterview = async (req, res, next) => {
  try {
    const { sessionId, answer } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));
    if (session.status !== 'in_progress') {
      return res.status(400).json(formatError('Interview is not active', 'INVALID_STATE', 'Resume the interview before replying'));
    }
    if (!answer?.trim()) {
      return res.status(400).json(formatError('Missing answer', 'MISSING_PARAM', 'Please provide an interview answer'));
    }

    session.transcript.push({ role: 'user', text: answer.trim(), timestamp: new Date().toISOString() });

    // Build context for DeepSeek
    const systemInstruction = `
      You are Aroha, a friendly and professional interviewer for a New Zealand tech company.
      The candidate is applying for: ${session.targetRole}.
      Their seniority level is: ${session.settings?.seniorityLevel || 'Junior/Grad'}.
      
      Candidate CV Summary/Strengths: ${session.analysisResult?.strengths?.join(', ') || 'Not provided'}
      Job Description Focus: ${session.analysisResult?.interviewFocus?.join(', ') || 'Not provided'}
      
      CRITICAL INSTRUCTIONS:
      1. Ask exactly ONE question at a time.
      2. The first follow-up question after "Please introduce yourself" MUST be based directly on the user's self-introduction.
      3. If the user mentions career transition, study background, motivation, or personal interest, explore that naturally first.
      4. For Junior/Grad or career-switchers, prefer background-based questions before advanced technical scenarios.
      5. DO NOT jump to generic technical questions (like system outages) unless the user's introduction clearly supports that topic.
      6. Only ask advanced production, outage, architecture, or stakeholder-pressure questions when supported by CV evidence, JD requirements, or prior user answer context.
      7. AVOID fake acknowledgments like "That's great." Instead, acknowledge briefly and naturally, then ask a directly related follow-up. 
         Example: "Thanks, that gives me a good overview. What made you decide to move into software?"
      8. Keep transitions natural and sound like you actually listened.
      9. Build a natural sequence: self-introduction -> background/motivation -> relevant project -> problem-solving -> technical depth.
      10. ONLY output the text of your next question/response. Do not include any other formatting or metadata.
    `;

    // Format transcript for DeepSeek
    const messages = session.transcript.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.text
    }));

    let nextQuestion = '';
    try {
      // We pass the full conversation history to DeepSeek
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error("Missing API Key");
      }

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemInstruction },
            ...messages
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.statusText}`);
      }

      const data = await response.json();
      nextQuestion = data.choices[0].message.content.trim();
    } catch (e) {
      console.warn('DeepSeek call failed in interview, using fallback:', e);
      // Fallback logic if API fails
      const isFirstFollowUp = session.transcript.length === 2; // AI intro, User intro
      if (isFirstFollowUp) {
        nextQuestion = "Thanks for sharing that background. What made you decide to pursue this specific role?";
      } else {
        nextQuestion = "That's interesting. Can you tell me more about a specific challenge you faced in that area and how you overcame it?";
      }
    }
    
    session.transcript.push({ role: 'ai', text: nextQuestion, timestamp: new Date().toISOString() });
    session.currentQuestionIndex = Math.min((session.currentQuestionIndex || 1) + 1, session.totalQuestions || 8);
    updateSession(sessionId, session);

    res.json(formatSuccess('Reply processed', { nextQuestion, session }));
  } catch (error) {
    next(error);
  }
};

export const repeatQuestion = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    const lastAiMessage = session.transcript.filter(m => m.role === 'ai').pop();
    res.json(formatSuccess('Question repeated', { question: lastAiMessage?.text }));
  } catch (error) {
    next(error);
  }
};

export const pauseInterview = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    updateElapsedSeconds(session);
    session.status = 'paused';
    updateSession(sessionId, session);
    res.json(formatSuccess('Interview paused', { session }));
  } catch (error) {
    next(error);
  }
};

export const resumeInterview = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    session.status = 'in_progress';
    session.lastResumedAt = new Date().toISOString();
    updateSession(sessionId, session);
    res.json(formatSuccess('Interview resumed', { session }));
  } catch (error) {
    next(error);
  }
};

export const endInterview = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    updateElapsedSeconds(session);
    session.status = 'completed';
    updateSession(sessionId, session);
    res.json(formatSuccess('Interview ended', { session }));
  } catch (error) {
    next(error);
  }
};
