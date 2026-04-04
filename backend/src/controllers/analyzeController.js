import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { compareCvToJobDescription } from '../services/matchService.js';
import { createSession } from '../services/sessionService.js';
import * as authService from '../services/authService.js';
import { createAuditLog } from '../services/auditService.js';

export const matchCV = async (req, res, next) => {
  console.log('ENTERING matchCV');
  try {
    const { cvText, rawJD, jdRubric, settings } = req.body;
    if (!cvText || (!rawJD && !jdRubric)) {
      return res.status(400).json(formatError('Missing text', 'MISSING_PARAM', 'CV text and JD input are required'));
    }

    console.log('Calling matchService for matchCV');
    const matchData = await compareCvToJobDescription(cvText, rawJD, jdRubric, settings);
    console.log('EXITING matchCV successfully');
    res.json(formatSuccess('Match analysis completed', matchData));
  } catch (error) {
    console.error('ERROR in matchCV:', error.message, error.stack);
    next(error);
  }
};

export const generateInterviewPlan = async (req, res, next) => {
  console.log('ENTERING generateInterviewPlan');
  try {
    const { cvId, cvText, rawJD, jdText, jdRubric, settings, analysisResult } = req.body;
    const user = await authService.resolveUserFromRequest(req);

    // 1. Try to extract job title from structured JD directly
    let extractedRole = '';
    if (jdText) {
      const match = jdText.match(/1\. Job Title:\s*(.*)/i);
      if (match && match[1]) {
        extractedRole = match[1].trim();
      }
    }

    // 2. Fallback to analyzed job title from JD summary
    if (!extractedRole && analysisResult?.jobTitle) {
      extractedRole = analysisResult.jobTitle;
    }

    // Create a new session with the plan
    console.log('Creating session for generateInterviewPlan');
    const session = await createSession({
      userId: user.id,
      cvFileId: cvId || null,
      cvText,
      rawJD: rawJD || '',
      jdText,
      jdRubric: jdRubric || null,
      settings,
      analysisResult,
      targetRole: extractedRole || (jdText ? 'Target Role' : 'General Interview'),
      totalQuestions: 8,
      currentQuestionIndex: 1,
      candidateName: analysisResult?.candidateName || 'Candidate'
    });

    await createAuditLog({
      actorUserId: user.id,
      targetUserId: user.id,
      sessionId: session.id,
      actionType: 'create_interview_session',
      resourceType: 'interview_session',
      resourceId: session.id,
      metadata: { cvId: cvId || null, targetRole: session.targetRole },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    console.log('EXITING generateInterviewPlan successfully');
    res.json(formatSuccess('Interview plan generated', { sessionId: session.id, session }));
  } catch (error) {
    console.error('ERROR in generateInterviewPlan:', error.message, error.stack);
    next(error);
  }
};
