import { describe, expect, it } from 'vitest';

import { buildQuestionAgentDataset } from '../../../eval/googleAgentsCli/questionAgentTraceBuilder.js';
import { buildVoiceInterviewDataset } from '../../../eval/googleAgentsCli/voiceInterviewTraceBuilder.js';

const hasPart = (dataset, fieldName) => (dataset.eval_cases || []).some((testCase) => (
  testCase.agent_data?.turns || []
).some((turn) => (
  turn.events || []
).some((event) => (
  event.content?.parts || []
).some((part) => Object.prototype.hasOwnProperty.call(part, fieldName)))));

const assertNoEvaluatorLeakage = (dataset) => {
  for (const testCase of dataset.eval_cases || []) {
    const serializedAgentData = JSON.stringify(testCase.agent_data || {});
    expect(serializedAgentData).not.toMatch(/"expected"\s*:/i);
    expect(serializedAgentData).not.toMatch(/"golden"\s*:/i);
    expect(serializedAgentData).not.toMatch(/"answer_key"\s*:/i);
  }
};

describe('Google Agents CLI trace builders', () => {
  it('builds voice traces with confidence, confirmation, and latency metadata', () => {
    const dataset = buildVoiceInterviewDataset();

    expect(dataset.eval_cases.length).toBeGreaterThanOrEqual(4);
    expect(hasPart(dataset, 'function_call')).toBe(true);
    expect(hasPart(dataset, 'function_response')).toBe(true);
    assertNoEvaluatorLeakage(dataset);

    const confirmationCase = dataset.eval_cases.find((testCase) => testCase.eval_case_id === 'voice_low_confidence_contentful_confirmation');
    expect(confirmationCase?.kiwi_evaluation.diagnostics.assessment).toEqual(expect.objectContaining({
      decision: 'confirm_understanding',
      requiresUnderstandingConfirmation: true,
    }));

    const acceptedCase = dataset.eval_cases.find((testCase) => testCase.eval_case_id === 'voice_valid_answer_next_question_fast');
    expect(acceptedCase?.kiwi_evaluation.diagnostics.latency).toEqual(expect.objectContaining({
      withinTarget: true,
      targetMs: 3000,
    }));
  });

  it('builds question traces with decision and ranking metadata', async () => {
    const dataset = await buildQuestionAgentDataset();

    expect(dataset.eval_cases.length).toBeGreaterThanOrEqual(5);
    expect(hasPart(dataset, 'function_call')).toBe(true);
    expect(hasPart(dataset, 'function_response')).toBe(true);
    assertNoEvaluatorLeakage(dataset);

    const validationCase = dataset.eval_cases.find((testCase) => testCase.eval_case_id === 'question_validation_uses_prepared_match_gap');
    expect(validationCase?.kiwi_evaluation.diagnostics).toEqual(expect.objectContaining({
      selectedQuestionId: 'prepared-db-validation',
      selectionSource: 'prepared_question_pool',
    }));

    const followUpCase = dataset.eval_cases.find((testCase) => testCase.eval_case_id === 'question_followup_does_not_consume_prepared_root');
    expect(followUpCase?.kiwi_evaluation.diagnostics).toEqual(expect.objectContaining({
      turnKind: 'follow_up',
      sourcePolicy: 'follow_up_from_parent_no_prepared_root_consumption',
    }));
  });
});
