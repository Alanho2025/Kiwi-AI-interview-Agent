import { describe, expect, it } from 'vitest';

import {
  buildAbductiveProbeQuestion,
  buildClosingQuestion,
  buildDeepDiveQuestion,
  buildForceShiftProjectQuestion,
  buildMatchedTechnicalQuestion,
  buildProbeFrictionQuestion,
  buildProbeStressQuestion,
  buildProbeTradeOffQuestion,
  buildProbingQuestion,
  buildQuestionRootKey,
  buildRepetitionRepairSwitchQuestion,
  buildRephrasedQuestion,
  buildSectionShiftQuestion,
  buildSwitchTopicQuestion,
  buildValidationQuestion,
  inferEvidenceNeed,
  inferQuestionGoal,
  normalizeQuestionIntent,
  pickPriorityTechnicalTopic,
  toCandidatePhrase,
} from '../../../src/services/agents/interviewerAgentQuestionBuilder.js';

import {
  buildBehaviouralModeQuestion,
  guardGeneratedTextForInterviewMode,
  guardQuestionForInterviewMode,
  normalizeInterviewMode,
  questionLooksBehavioural,
  questionLooksTechnical,
} from '../../../src/services/aiControl/interviewModeGuard.js';

const expectQuestionShape = (question, overrides = {}) => {
  expect(question).toEqual(expect.objectContaining({
    type: expect.any(String),
    stage: expect.any(String),
    topic: expect.any(String),
    followUpDepth: expect.any(Number),
    text: expect.any(String),
    reason: expect.any(String),
    sourceType: expect.any(String),
    ...overrides,
  }));
};

const wordCount = (text = '') => text.split(/\s+/).filter(Boolean).length;

describe('interviewer agent question builder baseline', () => {
  it('preserves question goal and evidence need mappings', () => {
    expect(inferQuestionGoal({ type: 'deep_dive_follow_up' })).toBe('deep_dive_on_decision_quality');
    expect(inferQuestionGoal({ type: 'validation_follow_up' })).toBe('validate_claim_with_direct_evidence');
    expect(inferQuestionGoal({ type: 'rephrased_follow_up' })).toBe('clarify_current_question_with_one_concrete_example');
    expect(inferQuestionGoal({ type: 'probe_stress_follow_up' })).toBe('test_constraints_and_adaptation');
    expect(inferQuestionGoal({ type: 'probe_friction_follow_up' })).toBe('surface_tradeoff_conflict_or_failure');

    expect(inferEvidenceNeed({ type: 'deep_dive_follow_up' })).toEqual(['tradeoff', 'personal_action', 'validation_method', 'result']);
    expect(inferEvidenceNeed({ type: 'validation_follow_up' })).toEqual(['personal_ownership', 'validation_method', 'result_or_impact']);
  });

  it('normalizes question intent while preserving fallback fields', () => {
    const question = normalizeQuestionIntent({
      question: {
        type: 'deep_dive_follow_up',
        stage: 'technical_probe',
        topic: 'recommendation system',
        category: 'technical',
        followUpDepth: 2,
        text: 'How did you judge whether it worked?',
        reason: 'Baseline reason.',
        sourceType: 'controller_directed',
      },
      actionType: 'ASK_DEEP_DIVE_QUESTION',
      focusArea: 'technical',
    });

    expect(question.fallbackText).toBe('How did you judge whether it worked?');
    expect(question.text).toBe('How did you judge whether it worked?');
    expect(question.questionGoal).toBe('deep_dive_on_decision_quality');
    expect(question.constraints).toEqual(expect.arrayContaining(['ask_one_question_only', 'stay_on_same_example', 'technical_evidence_only']));
  });

  it('maps internal topics to candidate-facing phrases', () => {
    expect(toCandidatePhrase('Communication')).toBe('explaining a complex idea clearly');
    expect(toCandidatePhrase('role_fit')).toBe('your fit for this role');
    expect(toCandidatePhrase('decision_tradeoff')).toBe('making a difficult trade-off');
    expect(toCandidatePhrase('PostgreSQL')).toBe('PostgreSQL');
  });

  it('builds short controller-directed follow-up questions', () => {
    const questions = [
      buildProbingQuestion({ targetTopic: 'recommendation system' }),
      buildRephrasedQuestion({ targetTopic: 'testing' }),
      buildDeepDiveQuestion({ targetTopic: 'AI agent testing' }),
      buildValidationQuestion({ targetTopic: 'model evaluation' }),
      buildSwitchTopicQuestion({ targetTopic: 'communication' }),
      buildRepetitionRepairSwitchQuestion({ targetTopic: 'teamwork' }),
      buildAbductiveProbeQuestion({ targetTopic: 'decision_tradeoff', hiddenGap: 'unclear validation method' }),
      buildSectionShiftQuestion({ nextSectionKey: 'technical' }),
      buildForceShiftProjectQuestion({ targetTopic: 'database work', forbiddenProject: 'Forkcast' }),
      buildProbeStressQuestion({ targetTopic: 'latency handling' }),
      buildProbeFrictionQuestion({ targetTopic: 'ownership' }),
      buildProbeTradeOffQuestion({ targetTopic: 'ownership' }),
    ];

    for (const question of questions) {
      expectQuestionShape(question);
      const maxWords = 25;
      expect(wordCount(question.text)).toBeLessThanOrEqual(maxWords);
      expect(question.text).not.toMatch(/decision_tradeoff|role_fit|show Communication/);
    }

    expect(buildProbingQuestion().text).toBe('What did you personally own and build in that example?');
    expect(buildDeepDiveQuestion().text).toBe('What was the hardest decision you made there?');
    expect(buildValidationQuestion().text).toBe('How did you know your part worked?');
  });

  it('builds recovery questions without leaking internal labels', () => {
    const communicationQuestion = buildMatchedTechnicalQuestion({ topic: 'Communication' });
    const reactQuestion = buildMatchedTechnicalQuestion({ topic: 'React' });
    const databaseQuestion = buildMatchedTechnicalQuestion({ topic: 'PostgreSQL database' });

    expectQuestionShape(communicationQuestion, { type: 'role_competency_recovery_follow_up' });
    expect(communicationQuestion.text).toBe('Tell me about a time you explained a complex idea clearly.');
    expect(communicationQuestion.text).not.toContain('Communication');

    expectQuestionShape(reactQuestion, { type: 'technical_recovery_follow_up' });
    expect(reactQuestion.text).toBe('What React feature or frontend flow did you build yourself?');

    expectQuestionShape(databaseQuestion, { type: 'technical_recovery_follow_up' });
    expect(databaseQuestion.text).toBe('What database or SQL task did you handle yourself?');
  });

  it('preserves priority topic picking, root key, and closing question behaviour', () => {
    const topic = pickPriorityTechnicalTopic({
      session: {
        analysisResult: {
          matchingDetails: {
            questionPlanHints: { priorityTopics: ['SQL'] },
            topMatchedSkills: ['React'],
          },
        },
      },
      decisionContext: {
        matchState: { validationTargets: ['PostgreSQL'] },
        retrievalState: { priorityTopics: ['WebSocket'] },
      },
      targetTopic: 'technical',
    });

    expect(topic).toBe('PostgreSQL');
    expect(buildQuestionRootKey({ topic: 'Communication', category: 'behavioural', type: 'follow_up' })).toBe('communication:behavioural:follow_up');

    const closing = buildClosingQuestion({
      session: { settings: { focusArea: 'combined' } },
      decisionContext: {
        interviewStructure: { categoryCounts: { technical: 1, behavioural: 2 }, focusAreaKey: 'combined' },
        matchState: { validationTargets: ['SQL'] },
      },
    });

    expectQuestionShape(closing, { stage: 'closing', category: 'closing' });
    expect(closing.text).toContain('Before we wrap up');
    expect(wordCount(closing.text)).toBeLessThanOrEqual(18);
  });
});

describe('interview mode guard baseline', () => {
  it('normalizes interview modes and detects broad question styles', () => {
    expect(normalizeInterviewMode('behavioural')).toBe('behavioral');
    expect(normalizeInterviewMode('behavioral')).toBe('behavioral');
    expect(normalizeInterviewMode('technical')).toBe('technical');
    expect(normalizeInterviewMode('anything_else')).toBe('combined');

    expect(questionLooksTechnical({ text: 'How did you implement the database schema?' })).toBe(true);
    expect(questionLooksBehavioural({ text: 'Tell me about a time you handled a team challenge.' })).toBe(true);
  });

  it('rewrites technical-looking selected questions in behavioural mode', () => {
    const guarded = guardQuestionForInterviewMode({
      focusArea: 'behavioral',
      actionType: 'ASK_VALIDATION_QUESTION',
      selectedQuestion: buildValidationQuestion({ targetTopic: 'database schema' }),
      targetTopic: 'database schema',
      latestAnswer: 'I worked on a database dashboard project with my team.',
    });

    expectQuestionShape(guarded, { type: 'behavioural_mode_guard_follow_up', sourceType: 'mode_guard', modeGuardApplied: true });
    expect(guarded.text).toBe('Using that project as context, what challenge did you personally handle?');
    expect(wordCount(guarded.text)).toBeLessThanOrEqual(12);
  });

  it('rewrites behavioural-looking selected questions in technical mode', () => {
    const guarded = guardQuestionForInterviewMode({
      focusArea: 'technical',
      actionType: 'ASK_PROBING_QUESTION',
      selectedQuestion: {
        type: 'behavioural_follow_up',
        stage: 'behavioural',
        topic: 'teamwork',
        category: 'behavioural',
        followUpDepth: 1,
        text: 'Tell me about a time you handled a team challenge.',
        reason: 'Baseline behavioural question.',
        sourceType: 'fallback',
      },
      targetTopic: 'database',
      latestAnswer: 'I used SQL in a team project.',
    });

    expectQuestionShape(guarded, { type: 'technical_mode_guard_follow_up', sourceType: 'mode_guard', modeGuardApplied: true });
    expect(guarded.text).toBe('What technical approach did you use for database?');
  });

  it('guards generated text without changing valid combined-mode text', () => {
    const text = 'What did you personally own in that project?';
    expect(guardGeneratedTextForInterviewMode({ focusArea: 'combined', generatedText: text })).toBe(text);
  });

  it('falls back when generated text crosses the selected mode boundary', () => {
    const behaviouralFallback = buildBehaviouralModeQuestion({
      selectedQuestion: buildValidationQuestion({ targetTopic: 'database' }),
      targetTopic: 'database',
      latestAnswer: 'I built a data dashboard.',
    }).text;

    expect(guardGeneratedTextForInterviewMode({
      focusArea: 'behavioral',
      generatedText: 'How did you implement the SQL schema and API endpoint?',
      fallbackText: behaviouralFallback,
    })).toBe(behaviouralFallback);

    expect(guardGeneratedTextForInterviewMode({
      focusArea: 'technical',
      generatedText: 'Tell me about a time you handled a team challenge.',
      fallbackText: 'What technical approach did you use for PostgreSQL?',
      selectedQuestion: buildValidationQuestion({ targetTopic: 'PostgreSQL' }),
    })).toContain('technical approach');
  });
});
