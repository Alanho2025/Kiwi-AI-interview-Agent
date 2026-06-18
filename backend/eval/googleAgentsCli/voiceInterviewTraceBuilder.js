/**
 * File responsibility: Convert Kiwi voice interview scenarios to Google Agents CLI traces.
 * Main responsibilities:
 * - Represent realtime transcript gating, repair, confirmation, and answer processing as trace events.
 * - Score product-contract behavior without leaking expected labels into agent_data.
 * - Produce complete EvaluationDataset JSON for agents-cli eval grade.
 */

import { AGENT_ACTION_TYPES } from '../../src/constants/agentActionTypes.js';
import { AGENT_TOOL_NAMES } from '../../src/constants/agentToolNames.js';
import { assessRealtimeVoiceTranscript } from '../../src/services/voice/speechConfidenceGate.js';
import { buildTranscriptConfirmationPrompt } from '../../src/services/voice/transcriptUnderstandingSummary.js';
import { analyzeTranscriptConfirmationReply } from '../../src/services/voice/transcriptConfirmationReplyClassifier.js';
import {
  ensureArray,
  scoreChecks,
  textEvent,
  toTextPart,
  toolCallEvent,
  toolResponseEvent,
  truncate,
} from './traceEventBuilders.js';

const VOICE_AGENT_ID = 'kiwi_voice_interview_agent';
const CONFIDENCE_GATE_ID = 'voice_confidence_gate';
const CONFIRMATION_AGENT_ID = 'transcript_confirmation_agent';
const ADAPTIVE_CONTROLLER_ID = 'adaptive_interview_controller';
const TTS_AGENT_ID = 'voice_tts_agent';

const VOICE_SCENARIOS = [
  {
    id: 'voice_empty_transcript_repair',
    prompt: 'The candidate stops speaking but the realtime STT final transcript is empty.',
    transcriptText: '',
    asrConfidence: 0.92,
    vad: { speechDurationMs: 0, sttSegmentCount: 0, isFinal: true },
    contract: {
      decision: 'reject',
      reason: 'EMPTY_TRANSCRIPT',
      countsAsQuestion: false,
      shouldProcessAnswer: false,
      repairPrompt: true,
    },
  },
  {
    id: 'voice_low_confidence_contentful_confirmation',
    prompt: 'The candidate gives a long database answer but ASR confidence is low.',
    transcriptText: 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.',
    asrConfidence: 0.24,
    vad: { speechDurationMs: 42000, sttSegmentCount: 3, isFinal: true },
    contract: {
      decision: 'confirm_understanding',
      reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
      countsAsQuestion: false,
      shouldProcessAnswer: false,
      confirmationPrompt: true,
    },
  },
  {
    id: 'voice_confirmed_low_confidence_answer_processed',
    prompt: 'The candidate confirms a contentful low-confidence transcript and adds a short clarification.',
    transcriptText: 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.',
    asrConfidence: 0.28,
    vad: { speechDurationMs: 46000, sttSegmentCount: 4, isFinal: true },
    confirmationReply: 'Yes, that is right. I also chose PostgreSQL when relational reporting and strict validation mattered.',
    latencyMs: {
      speechEndReceived: 0,
      sttFinalReady: 180,
      confidenceGateDone: 235,
      confirmationNeededOrNot: 260,
      answerSaved: 720,
      evaluatorDone: 1280,
      actionSelected: 1510,
      questionRanked: 1670,
      firstSentenceReady: 2080,
      ttsFirstAudio: 2520,
      frontendPlaybackStarted: 2760,
    },
    contract: {
      decision: 'confirm_understanding',
      reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
      confirmationDecision: 'confirm_with_clarification',
      countsAsQuestion: true,
      shouldProcessAnswer: true,
      latencyWithinTarget: true,
    },
  },
  {
    id: 'voice_valid_answer_next_question_fast',
    prompt: 'The candidate gives a clear accepted voice answer and should receive the next question within the latency target.',
    transcriptText: 'In my university team project I coordinated the backend voice agent, clarified blockers, implemented the WebSocket turn flow, and measured latency from speech end to first audio.',
    asrConfidence: 0.86,
    vad: { speechDurationMs: 12500, sttSegmentCount: 3, isFinal: true },
    latencyMs: {
      speechEndReceived: 0,
      sttFinalReady: 140,
      confidenceGateDone: 185,
      confirmationNeededOrNot: 205,
      answerSaved: 520,
      evaluatorDone: 980,
      actionSelected: 1210,
      questionRanked: 1380,
      firstSentenceReady: 1880,
      ttsFirstAudio: 2360,
      frontendPlaybackStarted: 2550,
    },
    contract: {
      decision: 'accept',
      reason: 'VALID_TRANSCRIPT',
      countsAsQuestion: true,
      shouldProcessAnswer: true,
      latencyWithinTarget: true,
    },
  },
];

const buildAgents = () => ({
  [VOICE_AGENT_ID]: {
    agent_id: VOICE_AGENT_ID,
    agent_type: 'DuplexVoiceInterviewAgent',
    instruction: 'Coordinate realtime voice interview turns while preserving transcript confidence, repair, confirmation, turn counting, and latency guarantees.',
  },
  [CONFIDENCE_GATE_ID]: {
    agent_id: CONFIDENCE_GATE_ID,
    agent_type: 'SpeechConfidenceGate',
    instruction: 'Classify final realtime transcripts as accepted, rejected, or requiring understanding confirmation before scoring.',
  },
  [CONFIRMATION_AGENT_ID]: {
    agent_id: CONFIRMATION_AGENT_ID,
    agent_type: 'TranscriptConfirmationAgent',
    instruction: 'Ask deterministic confirmation prompts for contentful low-confidence transcripts and classify the user confirmation reply.',
  },
  [ADAPTIVE_CONTROLLER_ID]: {
    agent_id: ADAPTIVE_CONTROLLER_ID,
    agent_type: 'AdaptiveInterviewController',
    instruction: 'Save accepted answers, evaluate the latest answer, choose the next action, rank the concrete question, and preserve traceable question metadata.',
  },
  [TTS_AGENT_ID]: {
    agent_id: TTS_AGENT_ID,
    agent_type: 'SpeechSynthesisAgent',
    instruction: 'Synthesize repair, confirmation, acknowledgement, and next-question speech without counting non-question turns as interview questions.',
  },
});

const summarizeAssessment = (assessment = {}) => ({
  ok: Boolean(assessment.ok),
  decision: assessment.decision || '',
  reason: assessment.reason || '',
  requiresUnderstandingConfirmation: Boolean(assessment.requiresUnderstandingConfirmation),
  shouldProcessAnswer: assessment.shouldProcessAnswer !== false && assessment.ok === true,
  countsAsQuestion: assessment.ok === true,
  message: assessment.message || null,
  confidenceGate: assessment.confidenceGate || null,
  metrics: assessment.metrics || null,
  transcriptQuality: assessment.transcriptQuality || null,
});

const resolveConfirmedTranscript = ({ originalTranscript = '', confirmationReply = '', confirmationDetails = {} } = {}) => {
  const original = String(originalTranscript || '').trim();
  const reply = String(confirmationReply || '').trim();
  const extraContent = String(confirmationDetails.extraContent || '').trim();
  if (confirmationDetails.isContentfulClarification && reply) {
    return `${original}\n\nUser clarification after transcript check: ${reply}`.trim();
  }
  if (extraContent) {
    return `${original}\n\nUser clarification after confirming transcript: ${extraContent}`.trim();
  }
  return original;
};

const buildQuestionDecision = ({ scenario = {}, resolvedTranscriptText = '' } = {}) => ({
  selectedAction: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
  selectedQuestionId: 'voice_database_validation_001',
  sourceType: 'match_gap',
  whyThisQuestion: 'Selected because the accepted answer discussed database trade-offs and the role evidence still needs validation.',
  evidenceUsed: [
    { type: 'voice_transcript', value: truncate(resolvedTranscriptText, 260) },
    { type: 'selected_action', value: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION },
    { type: 'latency_target', value: 'speech_end_to_tts_first_audio_under_3000_ms' },
  ],
  expectedSignal: ['database_tradeoff', 'personal_ownership', 'validation_method'],
  alternativesConsidered: [
    { questionId: 'voice_api_followup_001', sourceType: 'cv_template', score: 0.78, reasons: ['answer_mentions_backend'] },
    { questionId: 'voice_teamwork_followup_001', sourceType: 'culture_fit', score: 0.62, reasons: ['answer_mentions_team_project'] },
  ],
  confidence: scenario.asrConfidence,
  selectionSource: 'voice_contract_eval',
  baseQuestionText: 'How did you validate that database decision yourself?',
  spokenQuestionText: 'How did you validate that database decision yourself, and what trade-off did you make?',
  ranking: {
    selectedQuestionId: 'voice_database_validation_001',
    selectedScore: 1.28,
    rankingReason: 'Database evidence was present but still needed personal validation and trade-off detail.',
    topCandidates: [
      {
        questionId: 'voice_database_validation_001',
        sourceType: 'match_gap',
        score: 1.28,
        reasons: ['match_validation_target', 'linked_to_latest_answer', 'needs_validation_evidence'],
      },
      { questionId: 'voice_api_followup_001', sourceType: 'cv_template', score: 0.78, reasons: ['answer_mentions_backend'] },
    ],
  },
});

const buildLatencySummary = (latencyMs = {}) => {
  const ttsFirstAudio = Number(latencyMs.ttsFirstAudio ?? 0);
  return {
    milestones: latencyMs,
    speechEndToFirstAudioMs: ttsFirstAudio,
    withinTarget: ttsFirstAudio > 0 && ttsFirstAudio <= 3000,
    targetMs: 3000,
  };
};

const buildAnswerProcessing = ({ scenario = {}, resolvedTranscriptText = '' } = {}) => {
  const questionDecision = buildQuestionDecision({ scenario, resolvedTranscriptText });
  return {
    answerSaved: true,
    turnType: 'user_answer',
    countsAsQuestion: true,
    evaluator: {
      suggestedNextMode: 'deepen',
      evidenceGainScore: 0.72,
      currentTopic: 'database',
      rationale: 'The answer is contentful and should be followed by a validation question.',
    },
    selectedAction: questionDecision.selectedAction,
    questionDecision,
    questionRanking: questionDecision.ranking,
    nextQuestionText: questionDecision.spokenQuestionText,
    latency: buildLatencySummary(scenario.latencyMs),
  };
};

const buildVoiceChecks = ({ scenario = {}, assessment = {}, confirmationDetails = null, answerProcessing = null } = {}) => {
  const contract = scenario.contract || {};
  const checks = [
    { label: 'decision_matches_contract', passed: assessment.decision === contract.decision },
    { label: 'reason_matches_contract', passed: assessment.reason === contract.reason },
  ];

  if (Object.prototype.hasOwnProperty.call(contract, 'shouldProcessAnswer')) {
    checks.push({
      label: 'answer_processing_matches_contract',
      passed: Boolean(answerProcessing) === Boolean(contract.shouldProcessAnswer),
    });
  }

  if (Object.prototype.hasOwnProperty.call(contract, 'countsAsQuestion')) {
    checks.push({
      label: 'turn_counting_matches_contract',
      passed: answerProcessing
        ? answerProcessing.countsAsQuestion === contract.countsAsQuestion
        : contract.countsAsQuestion === false,
    });
  }

  if (contract.confirmationPrompt) {
    checks.push({
      label: 'confirmation_prompt_requested',
      passed: Boolean(assessment.requiresUnderstandingConfirmation),
    });
  }

  if (contract.confirmationDecision) {
    checks.push({
      label: 'confirmation_decision_matches_contract',
      passed: confirmationDetails?.resolvedDecision === contract.confirmationDecision,
    });
  }

  if (contract.latencyWithinTarget) {
    checks.push({
      label: 'speech_end_to_first_audio_within_target',
      passed: Boolean(answerProcessing?.latency?.withinTarget),
    });
  }

  return scoreChecks(checks);
};

const buildPromptText = (scenario = {}) => [
  `Evaluate Kiwi voice interview case: ${scenario.id}.`,
  scenario.prompt,
  'Assess transcript confidence handling, turn counting, answer processing, next-question traceability, and first-audio latency.',
].join('\n');

const buildFinalResponseText = ({ scenario = {}, evaluation = {}, answerProcessing = null, assessment = {} } = {}) => [
  `Voice case ${scenario.id}: ${evaluation.passed ? 'passed' : 'needs attention'}.`,
  `Transcript decision: ${assessment.decision || 'unknown'} (${assessment.reason || 'no reason'}).`,
  answerProcessing
    ? `Next action: ${answerProcessing.selectedAction}; first audio ${answerProcessing.latency.speechEndToFirstAudioMs}ms.`
    : 'No interview answer was processed for this turn.',
  evaluation.failedChecks.length
    ? `Deterministic checks flagged: ${evaluation.failedChecks.join(', ')}.`
    : 'Deterministic checks did not flag failures.',
].join('\n');

const buildEventsForScenario = (scenario = {}) => {
  const prompt = buildPromptText(scenario);
  const assessment = assessRealtimeVoiceTranscript({
    transcriptText: scenario.transcriptText,
    asrConfidence: scenario.asrConfidence,
    vad: scenario.vad,
  });
  const summarizedAssessment = summarizeAssessment(assessment);
  const events = [
    textEvent({ author: 'user', text: prompt }),
    toolCallEvent({
      author: VOICE_AGENT_ID,
      name: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
      args: { caseId: scenario.id, inputMode: 'duplex_voice' },
    }),
    toolResponseEvent({
      name: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
      response: {
        state: 'stt_finalizing',
        transcriptPreview: truncate(scenario.transcriptText, 220),
        asrConfidence: scenario.asrConfidence,
        vad: scenario.vad,
      },
    }),
    toolCallEvent({
      author: CONFIDENCE_GATE_ID,
      name: AGENT_TOOL_NAMES.VALIDATE_SPEECH_CONFIDENCE,
      args: {
        transcriptText: truncate(scenario.transcriptText, 260),
        asrConfidence: scenario.asrConfidence,
        vad: scenario.vad,
      },
    }),
    toolResponseEvent({
      name: AGENT_TOOL_NAMES.VALIDATE_SPEECH_CONFIDENCE,
      response: summarizedAssessment,
    }),
  ];

  let confirmationDetails = null;
  let resolvedTranscriptText = String(scenario.transcriptText || '').trim();
  let answerProcessing = null;

  if (assessment.requiresUnderstandingConfirmation || assessment.decision === 'confirm_understanding') {
    const confirmationPrompt = buildTranscriptConfirmationPrompt(scenario.transcriptText);
    events.push(
      toolCallEvent({
        author: CONFIRMATION_AGENT_ID,
        name: 'build_transcript_confirmation_prompt',
        args: { transcriptText: truncate(scenario.transcriptText, 260) },
      }),
      toolResponseEvent({
        name: 'build_transcript_confirmation_prompt',
        response: {
          turnType: 'transcript_confirmation',
          countsAsQuestion: false,
          confirmationPrompt,
          pendingTranscriptStored: true,
        },
      }),
      textEvent({
        author: VOICE_AGENT_ID,
        text: confirmationPrompt,
        metadata: { turnType: 'transcript_confirmation', countsAsQuestion: false },
      }),
    );

    if (scenario.confirmationReply) {
      const replyAnalysis = analyzeTranscriptConfirmationReply(scenario.confirmationReply);
      const resolvedDecision = replyAnalysis.isContentfulClarification
        ? 'clarification'
        : replyAnalysis.hasExtraContent
          ? 'confirm_with_clarification'
          : replyAnalysis.decision;
      confirmationDetails = { ...replyAnalysis, resolvedDecision };
      resolvedTranscriptText = resolveConfirmedTranscript({
        originalTranscript: scenario.transcriptText,
        confirmationReply: scenario.confirmationReply,
        confirmationDetails,
      });
      answerProcessing = buildAnswerProcessing({ scenario, resolvedTranscriptText });
      events.push(
        textEvent({ author: 'user', text: scenario.confirmationReply }),
        toolCallEvent({
          author: CONFIRMATION_AGENT_ID,
          name: 'classify_transcript_confirmation_reply',
          args: { replyText: scenario.confirmationReply },
        }),
        toolResponseEvent({
          name: 'classify_transcript_confirmation_reply',
          response: {
            decision: confirmationDetails.resolvedDecision,
            usedClarification: resolvedTranscriptText !== String(scenario.transcriptText || '').trim(),
            turnType: 'transcript_confirmation',
            countsAsQuestion: false,
          },
        }),
      );
    }
  } else if (!assessment.ok) {
    events.push(
      toolCallEvent({
        author: TTS_AGENT_ID,
        name: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        args: { source: 'duplex_repair_prompt', text: assessment.message },
      }),
      toolResponseEvent({
        name: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        response: {
          turnType: 'repair_prompt',
          countsAsQuestion: false,
          text: assessment.message,
        },
      }),
      textEvent({
        author: VOICE_AGENT_ID,
        text: assessment.message,
        metadata: { turnType: 'repair_prompt', countsAsQuestion: false },
      }),
    );
  } else {
    answerProcessing = buildAnswerProcessing({ scenario, resolvedTranscriptText });
  }

  if (answerProcessing) {
    events.push(
      toolCallEvent({
        author: ADAPTIVE_CONTROLLER_ID,
        name: 'process_accepted_voice_answer',
        args: {
          transcriptText: truncate(resolvedTranscriptText, 300),
          confidenceReason: assessment.reason,
          skipTranscriptGate: Boolean(scenario.confirmationReply),
        },
      }),
      toolResponseEvent({
        name: 'process_accepted_voice_answer',
        response: answerProcessing,
      }),
      toolCallEvent({
        author: TTS_AGENT_ID,
        name: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        args: { source: 'duplex_interview_sentence', text: answerProcessing.nextQuestionText },
      }),
      toolResponseEvent({
        name: AGENT_TOOL_NAMES.SYNTHESIZE_ASSISTANT_SPEECH,
        response: {
          turnType: 'interview_question',
          countsAsQuestion: true,
          ttsFirstAudioMs: answerProcessing.latency.speechEndToFirstAudioMs,
          frontendPlaybackStartedMs: answerProcessing.latency.milestones.frontendPlaybackStarted,
          text: answerProcessing.nextQuestionText,
        },
      }),
      textEvent({ author: VOICE_AGENT_ID, text: answerProcessing.nextQuestionText }),
    );
  }

  const evaluation = {
    ...buildVoiceChecks({ scenario, assessment, confirmationDetails, answerProcessing }),
    minimumPassingScore: 1,
  };
  evaluation.passed = evaluation.score >= evaluation.minimumPassingScore && evaluation.failedChecks.length === 0;

  return {
    events,
    assessment: summarizedAssessment,
    confirmationDetails,
    answerProcessing,
    evaluation,
  };
};

const buildRubricGroup = () => ({
  rubrics: [
    {
      rubric_id: 'voice_confidence_policy',
      content: { property: { description: 'Transcript confidence must control reject, confirmation, and accepted-answer paths without treating ASR uncertainty as answer quality.' } },
    },
    {
      rubric_id: 'voice_turn_counting',
      content: { property: { description: 'Repair prompts, transcript confirmations, and bridge acknowledgements must not count as interview questions.' } },
    },
    {
      rubric_id: 'voice_latency',
      content: { property: { description: 'Accepted voice answers should reach first next-question audio within 3 seconds and expose the latency milestones.' } },
    },
    {
      rubric_id: 'voice_question_traceability',
      content: { property: { description: 'Accepted answers should include selected action, question decision, ranking, evidence, alternatives, and spoken question text.' } },
    },
  ],
});

export const buildVoiceInterviewEvalCase = (scenario = {}, index = 0) => {
  const run = buildEventsForScenario(scenario);
  const finalText = buildFinalResponseText({
    scenario,
    evaluation: run.evaluation,
    answerProcessing: run.answerProcessing,
    assessment: run.assessment,
  });
  const promptText = buildPromptText(scenario);
  return {
    eval_case_id: scenario.id || `voice_interview_${index + 1}`,
    prompt: {
      role: 'user',
      parts: [toTextPart(promptText)],
    },
    responses: [
      {
        response: {
          role: 'model',
          parts: [toTextPart(finalText)],
        },
      },
    ],
    agent_data: {
      agents: buildAgents(),
      turns: [
        {
          turn_index: 0,
          events: [
            ...run.events,
            textEvent({ author: VOICE_AGENT_ID, text: finalText }),
          ],
        },
      ],
    },
    rubric_groups: {
      kiwi_voice_interview_rubrics: buildRubricGroup(),
    },
    kiwi_evaluation: {
      domain: 'voice_interview',
      score: run.evaluation.score,
      passed: run.evaluation.passed,
      minimumPassingScore: run.evaluation.minimumPassingScore,
      failedChecks: run.evaluation.failedChecks,
      checks: run.evaluation.checks,
      diagnostics: {
        assessment: run.assessment,
        confirmationDecision: run.confirmationDetails?.resolvedDecision || null,
        answerProcessed: Boolean(run.answerProcessing),
        latency: run.answerProcessing?.latency || null,
      },
    },
  };
};

export const buildVoiceInterviewDataset = (scenarios = VOICE_SCENARIOS) => ({
  eval_cases: ensureArray(scenarios).map((scenario, index) => buildVoiceInterviewEvalCase(scenario, index)),
});

export const getVoiceInterviewScenarios = () => VOICE_SCENARIOS.map((scenario) => ({ ...scenario }));
