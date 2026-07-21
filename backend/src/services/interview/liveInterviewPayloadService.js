import { sanitizeLiveSessionForClient } from '../session/sessionViewBuilder.js';

const sanitizeInterviewerTurn = (interviewerTurn = null) => {
  if (!interviewerTurn) return null;
  return {
    feedbackMode: interviewerTurn.feedbackMode || null,
    preamble: interviewerTurn.preamble || '',
    question: interviewerTurn.question || interviewerTurn.text || '',
    displayText: interviewerTurn.displayText || interviewerTurn.text || interviewerTurn.question || '',
  };
};

export const buildLiveInterviewTurnResponse = ({
  agentResult = {},
  updatedSession = null,
  generatedReport = null,
  transcription = null,
  assistantAudio = null,
  latency = null,
} = {}) => ({
  nextQuestion: agentResult.nextQuestion || null,
  interviewerTurn: sanitizeInterviewerTurn(agentResult.interviewerTurn),
  isComplete: Boolean(agentResult.isComplete),
  completedBecause: agentResult.completedBecause || null,
  reportStatus: generatedReport?.stored?.latestStatus || null,
  ...(transcription ? { transcription } : {}),
  ...(assistantAudio ? { assistantAudio } : {}),
  ...(latency ? { latency } : {}),
  session: updatedSession ? sanitizeLiveSessionForClient(updatedSession) : null,
});
