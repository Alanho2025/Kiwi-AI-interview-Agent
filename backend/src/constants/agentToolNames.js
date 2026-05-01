/**
 * File responsibility: Formal agent tool name registry.
 * Main responsibilities:
 * - Keep report-friendly tool names in one place.
 * - Let traces, logs, and architecture diagrams use stable agent tool names.
 * - Avoid renaming existing services while making tool use explicit.
 */

export const AGENT_TOOL_NAMES = Object.freeze({
  PLAN_INTERVIEW_ACTION: 'plan_interview_action',
  RETRIEVE_INTERVIEW_EVIDENCE: 'retrieve_interview_evidence',
  GENERATE_INTERVIEW_QUESTION: 'generate_interview_question',
  EVALUATE_CANDIDATE_ANSWER: 'evaluate_candidate_answer',
  TRANSITION_INTERVIEW_SECTION: 'transition_interview_section',

  DRAFT_INTERVIEW_REPORT: 'draft_interview_report',
  REVIEW_REPORT_QUALITY: 'review_report_quality',

  TRANSCRIBE_REALTIME_SPEECH: 'transcribe_realtime_speech',
  SYNTHESIZE_ASSISTANT_SPEECH: 'synthesize_assistant_speech',
  ORCHESTRATE_DUPLEX_VOICE: 'orchestrate_duplex_voice',
  HANDLE_VOICE_BARGE_IN: 'handle_voice_barge_in',
  VALIDATE_SPEECH_CONFIDENCE: 'validate_speech_confidence',
  NORMALIZE_VOICE_TRANSCRIPT: 'normalize_voice_transcript',
  SUMMARIZE_VOICE_LATENCY: 'summarize_voice_latency',
});

export const getToolNameForAction = (actionType = '') => {
  const action = String(actionType || '');
  if (!action) return AGENT_TOOL_NAMES.PLAN_INTERVIEW_ACTION;
  if (action.includes('QA')) return AGENT_TOOL_NAMES.REVIEW_REPORT_QUALITY;
  if (action.includes('REPORT')) return AGENT_TOOL_NAMES.DRAFT_INTERVIEW_REPORT;
  if (action.includes('SHIFT_SECTION')) return AGENT_TOOL_NAMES.TRANSITION_INTERVIEW_SECTION;
  if (action.includes('RETRIEVE')) return AGENT_TOOL_NAMES.RETRIEVE_INTERVIEW_EVIDENCE;
  return AGENT_TOOL_NAMES.GENERATE_INTERVIEW_QUESTION;
};
