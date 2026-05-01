import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { AGENT_TOOL_NAMES, getToolNameForAction } from '../../../src/constants/agentToolNames.js';

describe('formal tool trace contract robustness', () => {
  it('maps action types to formal tool names used by reports and architecture diagrams', () => {
    expect(getToolNameForAction(AGENT_ACTION_TYPES.RETRIEVE_EVIDENCE)).toBe(AGENT_TOOL_NAMES.RETRIEVE_INTERVIEW_EVIDENCE);
    expect(getToolNameForAction(AGENT_ACTION_TYPES.SHIFT_SECTION)).toBe(AGENT_TOOL_NAMES.TRANSITION_INTERVIEW_SECTION);
    expect(getToolNameForAction(AGENT_ACTION_TYPES.QA_REPORT)).toBe(AGENT_TOOL_NAMES.REVIEW_REPORT_QUALITY);
    expect(getToolNameForAction(AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT)).toBe(AGENT_TOOL_NAMES.DRAFT_INTERVIEW_REPORT);
    expect(getToolNameForAction(AGENT_ACTION_TYPES.ASK_PROBING_QUESTION)).toBe(AGENT_TOOL_NAMES.GENERATE_INTERVIEW_QUESTION);
  });

  it('keeps voice tools explicit so duplex traces do not collapse into generic agent events', () => {
    expect(Object.values(AGENT_TOOL_NAMES)).toEqual(expect.arrayContaining([
      'transcribe_realtime_speech',
      'synthesize_assistant_speech',
      'orchestrate_duplex_voice',
      'handle_voice_barge_in',
      'validate_speech_confidence',
      'normalize_voice_transcript',
    ]));
  });
});
