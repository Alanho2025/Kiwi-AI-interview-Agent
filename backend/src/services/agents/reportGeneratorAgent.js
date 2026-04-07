import { validateReportOutput } from '../schemaValidationService.js';

const joinEvidence = (items = [], limit = 4) => items.slice(0, limit).map((item) => item.label).join(', ');

export const runReportGeneratorAgent = async ({ session = {}, analysisResult = {}, interviewPlan = {}, retrievalBundle = null } = {}) => {
  const transcript = session.transcript || [];
  const userTurns = transcript.filter((turn) => turn.role === 'user');
  const aiTurns = transcript.filter((turn) => turn.role === 'ai');
  const explanation = analysisResult.explanation || { strengths: [], gaps: [], risks: [], summary: '' };

  const draft = {
    schemaVersion: 'v3',
    sessionId: session.id,
    candidateName: analysisResult.candidateName || session.candidateName || 'Candidate',
    jobTitle: analysisResult.jobTitle || session.targetRole || 'Target Role',
    generatedAt: new Date().toISOString(),
    summary: explanation.summary || `The candidate was evaluated for ${analysisResult.jobTitle || session.targetRole || 'the target role'} with a ${analysisResult.decision?.label || 'manual_review'} outcome.`,
    sections: [
      {
        id: 'match_overview',
        title: 'Match overview',
        content: `Overall score ${analysisResult.overallScore || 0}, confidence ${analysisResult.confidence || 0}. Decision: ${analysisResult.decision?.label || 'manual_review'}.`,
      },
      {
        id: 'strengths',
        title: 'Strengths',
        content: explanation.strengths?.length ? joinEvidence(explanation.strengths) : 'No standout strengths were captured.',
      },
      {
        id: 'gaps',
        title: 'Gaps',
        content: explanation.gaps?.length ? joinEvidence(explanation.gaps) : 'No major gaps were captured.',
      },
      {
        id: 'interview_observations',
        title: 'Interview observations',
        content: `The session recorded ${userTurns.length} candidate turns and ${aiTurns.length} interviewer turns. Focus areas: ${(interviewPlan.interviewFocus || []).join(', ') || 'general role fit'}.`,
      },
    ],
    scores: {
      overall: analysisResult.overallScore || 0,
      macro: analysisResult.scoreBreakdown?.macro || 0,
      micro: analysisResult.scoreBreakdown?.micro || 0,
      requirements: analysisResult.scoreBreakdown?.requirements || 0,
    },
    recommendations: [
      explanation.gaps?.length ? `Prioritize stronger evidence around ${explanation.gaps[0].label}.` : 'Continue reinforcing role-relevant examples.',
      'Use STAR-style examples to tighten impact and outcome statements.',
    ],
    evidenceReferences: [
      ...(analysisResult.evidenceMap || []).slice(0, 5),
      ...((retrievalBundle?.items || []).slice(0, 3).map((item) => ({ chunkId: item.chunkId, label: item.metadata?.label || item.sourceType, sourceType: item.sourceType }))),
    ],
  };

  return validateReportOutput(draft);
};
