import { callDeepSeek } from './deepseekService.js';
import { validateInterviewPlan } from './schemaValidationService.js';

const extractJsonObject = (text = '') => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
};

export const generatePlan = async (cvText, jdText, settings, analysisResult = {}) => {
  const prompt = `Analyze this CV and job description and return JSON only.
Required keys: candidateName, jobTitle, matchScore, confidence, interviewFocus, planPreview, strategy, questionPool, fallbackRules.
Use this analysis summary when available: ${JSON.stringify({
    strengths: analysisResult.strengths || [],
    gaps: analysisResult.gaps || [],
    decision: analysisResult.decision || {},
    confidence: analysisResult.confidence || null,
  })}
Settings: ${JSON.stringify(settings)}
CV Text:\n${String(cvText || '').slice(0, 1800)}\n\nJD Text:\n${String(jdText || '').slice(0, 1800)}`;

  try {
    const responseText = await callDeepSeek(prompt, 'You output valid JSON only.');
    const result = JSON.parse(extractJsonObject(responseText));
    return validateInterviewPlan({
      schemaVersion: 'v3',
      candidateName: result.candidateName || analysisResult.candidateName || 'Candidate',
      jobTitle: result.jobTitle || analysisResult.jobTitle || 'Target Role',
      matchScore: result.matchScore || analysisResult.matchScore || 0,
      confidence: result.confidence || analysisResult.confidence || 0.4,
      decision: analysisResult.decision || result.decision || {},
      requirementChecks: analysisResult.requirementChecks || [],
      explanation: analysisResult.explanation || {},
      interviewFocus: result.interviewFocus || analysisResult.interviewFocus || ['technical depth', 'behavioural examples'],
      planPreview: result.planPreview || 'Balanced interview with gap-driven follow-up questions.',
      strategy: result.strategy || { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
      questionPool: result.questionPool || [],
      fallbackRules: result.fallbackRules || { short_answer: 'ask_probe', time_low: 'end_early' },
      settingsSnapshot: settings,
    });
  } catch (error) {
    console.error('Failed to generate plan from DeepSeek, using fallback:', error);
    return validateInterviewPlan({
      schemaVersion: 'v3',
      candidateName: analysisResult.candidateName || 'Candidate',
      jobTitle: analysisResult.jobTitle || 'Target Role',
      matchScore: analysisResult.matchScore || 0,
      confidence: analysisResult.confidence || 0.4,
      decision: analysisResult.decision || {},
      requirementChecks: analysisResult.requirementChecks || [],
      explanation: analysisResult.explanation || {},
      interviewFocus: analysisResult.interviewFocus || ['technical depth', 'behavioural scenarios'],
      planPreview: 'A balanced interview focusing on technical depth and behavioural examples.',
      strategy: { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
      questionPool: [],
      fallbackRules: { short_answer: 'ask_probe', time_low: 'end_early' },
      settingsSnapshot: settings,
    });
  }
};
