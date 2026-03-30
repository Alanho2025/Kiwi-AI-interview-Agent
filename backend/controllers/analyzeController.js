import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { compareCvToJobDescription } from '../services/matchService.js';
import { createSession } from '../services/sessionService.js';

export const matchCV = async (req, res, next) => {
  try {
    const { cvText, rawJD, jdRubric, settings } = req.body;
    if (!cvText || (!rawJD && !jdRubric)) {
      return res.status(400).json(formatError('Missing text', 'MISSING_PARAM', 'CV text and JD input are required'));
    }

    const matchData = compareCvToJobDescription(cvText, rawJD, jdRubric, settings);
    res.json(formatSuccess('Match analysis completed', matchData));
  } catch (error) {
    next(error);
  }
};

export const generateInterviewPlan = async (req, res, next) => {
  try {
    const { cvText, jdText, settings, analysisResult } = req.body;
    
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
    const session = createSession({
      cvText,
      jdText,
      settings,
      analysisResult,
      targetRole: extractedRole || (jdText ? 'Target Role' : 'General Interview'),
      totalQuestions: 8,
      currentQuestionIndex: 1,
      candidateName: analysisResult?.candidateName || 'Candidate'
    });

    res.json(formatSuccess('Interview plan generated', { sessionId: session.id, session }));
  } catch (error) {
    next(error);
  }
};
