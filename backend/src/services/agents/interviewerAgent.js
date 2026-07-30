/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewerAgent should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { getNextPoolQuestion, hasReachedQuestionLimit, hasReachedTimeLimit } from '../interviewStateService.js';
import { guardGeneratedTextForInterviewMode, guardQuestionForInterviewMode } from '../aiControl/interviewModeGuard.js';
import { buildQuestionDecisionTrace } from '../aiControl/questionRanker.js';
import { buildInterviewTurnPlan } from '../questions/interviewTurnOrchestratorService.js';
import { runBoundedQuestionMicroPlanning } from '../questions/interviewMicroPlanningService.js';
import { polishQuestionWording } from '../questions/questionWordingPolishService.js';
import { buildQuestionHistory, evaluateQuestionNovelty } from '../questions/questionDeduplicationService.js';
import {
  buildAbductiveProbeQuestion,
  buildClosingQuestion,
  buildDeepDiveQuestion,
  buildForceShiftProjectQuestion,
  buildProbeFrictionQuestion,
  buildProbeStressQuestion,
  buildProbeTradeOffQuestion,
  buildProbingQuestion,
  buildReactTrace,
  buildRepetitionRepairSwitchQuestion,
  buildRephrasedQuestion,
  buildRoleLockedQuestion,
  buildSectionShiftQuestion,
  buildSwitchTopicQuestion,
  buildTechnicalRecoveryQuestion,
  buildValidationQuestion,
  getLastUserAnswer,
  inferEvidenceTypeHint,
  normalizeQuestionIntent,
  pickRetrievedQuestion,
} from './interviewerAgentQuestionBuilder.js';

const mapRootCandidateToQuestion = ({ candidate = null, targetTopic = '', category = null } = {}) => {
  if (!candidate?.text) return null;
  return {
    type: candidate.questionIntent || candidate.sourceStage || 'prepared_pool_question',
    stage: candidate.sourceStage || candidate.category || 'prepared_pool',
    topic: candidate.topic || targetTopic || 'role_fit',
    category: candidate.category || category || 'experience',
    followUpDepth: 0,
    text: candidate.text,
    fallbackText: candidate.text,
    reason: `Selected from prepared root question pool (${candidate.sourceStage || candidate.sourceType || 'prepared'}).`,
    sourceType: candidate.sourceType || candidate.sourceStage || 'prepared_question_pool',
    sourceId: candidate.questionId || null,
    preparedQuestionId: candidate.questionId || null,
    evidenceNeed: candidate.evidenceNeed,
    constraints: candidate.constraints,
    maxFollowUps: candidate.maxFollowUps,
    followUpStrategies: candidate.followUpStrategies,
    questionFamily: candidate.questionFamily || null,
    evidenceMode: candidate.evidenceMode || null,
    roleDomain: candidate.roleDomain || 'general',
    requirementCategory: candidate.requirementCategory || null,
    capabilityGroup: candidate.capabilityGroup || null,
    catalogQuestionId: candidate.catalogQuestionId || null,
    catalogVersion: candidate.catalogVersion || null,
    catalogLifecycle: candidate.catalogLifecycle || null,
    targetLevel: candidate.targetLevel || null,
    testedSignals: candidate.testedSignals || [],
    eligibilityReason: candidate.eligibilityReason || [],
    selectionPolicy: candidate.selectionPolicy || null,
    coverageSlot: candidate.coverageSlot || null,
    ambiguityMode: candidate.ambiguityMode || null,
    clarificationContextVersion: candidate.clarificationContextVersion || null,
    clarificationContext: candidate.clarificationContext || null,
    reportDimensions: candidate.reportDimensions || [],
    rankTrace: candidate.rankTrace || {
      questionId: candidate.questionId || null,
      selectionSource: 'prepared_question_pool',
      sourceStage: candidate.sourceStage || null,
      sourceType: candidate.sourceType || null,
      topic: candidate.topic || null,
      category: candidate.category || null,
      score: candidate.score ?? null,
    },
  };
};

export const runInterviewerAgent = async ({
  session,
  retrievalBundle = null,
  actionType = AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
  decisionContext = null,
  evidenceBundle = null,
  targetTopic = null,
  probeType = null,
  freshOnly = false,
  category = null,
  onSentence = null,
} = {}) => {
  const transcript = session?.transcript || [];
  const lastUserAnswer = getLastUserAnswer(transcript).toLowerCase();
  const environment = decisionContext?.environment || null;
  const evaluatorState = decisionContext?.evaluatorState || null;
  const focusArea = String(decisionContext?.interviewStructure?.focusAreaKey || session?.settings?.focusArea || 'combined').trim().toLowerCase().replace('behavioural', 'behavioral');

  if (hasReachedTimeLimit(session)) {
    const reactTrace = buildReactTrace({
      selectedAction: AGENT_ACTION_TYPES.WRAP_STAGE,
      decisionContext,
      selectedQuestion: { stage: 'wrap_up', topic: 'time_limit' },
      environment,
      evaluatorState,
    });
    return {
      questionType: 'wrap_up',
      nextQuestion: null,
      rationale: 'The planned interview time limit has been reached.',
      stage: 'wrap_up',
      topic: 'time_limit',
      followUpDepth: 0,
      retrievalSnapshot: retrievalBundle,
      isComplete: true,
      completedBecause: 'time_limit_reached',
      reactTrace,
    };
  }

  if (hasReachedQuestionLimit(session)) {
    const reactTrace = buildReactTrace({
      selectedAction: AGENT_ACTION_TYPES.WRAP_STAGE,
      decisionContext,
      selectedQuestion: { stage: 'wrap_up', topic: 'completed' },
      environment,
      evaluatorState,
    });
    return {
      questionType: 'wrap_up',
      nextQuestion: null,
      rationale: 'The planned interview question limit has been reached.',
      stage: 'wrap_up',
      topic: 'completed',
      followUpDepth: 0,
      retrievalSnapshot: retrievalBundle,
      isComplete: true,
      completedBecause: 'question_limit_reached',
      reactTrace,
    };
  }

  const lockedCategory = focusArea === 'technical' ? 'technical' : focusArea === 'behavioral' ? 'behavioural' : category;
  const turnPlan = await buildInterviewTurnPlan({
    session,
    actionType,
    decisionContext,
    actionInput: { targetTopic, probeType, freshOnly, category: lockedCategory },
  });
  let selectedQuestion = turnPlan.turnKind === 'root_question'
    ? mapRootCandidateToQuestion({ candidate: turnPlan.selectedRootCandidate, targetTopic, category: lockedCategory })
    : null;

  if (!selectedQuestion) {
    selectedQuestion = turnPlan.turnKind === 'root_question'
      ? getNextPoolQuestion(session, { freshOnly, category: lockedCategory })
      : null;
  }

  if (actionType === AGENT_ACTION_TYPES.ASK_PROBING_QUESTION) {
    selectedQuestion = buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || evidenceBundle?.validationTargets?.[0] || 'project', candidateText: environment?.latestAnswer?.text || lastUserAnswer });
  } else if (actionType === AGENT_ACTION_TYPES.REPHRASE_QUESTION) {
    selectedQuestion = buildRephrasedQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project', environment });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION) {
    selectedQuestion = focusArea === 'behavioral'
      ? buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'behavioural_example', candidateText: environment?.latestAnswer?.text || lastUserAnswer })
      : buildDeepDiveQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project' });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION) {
    if (!selectedQuestion?.preparedQuestionId) {
      selectedQuestion = focusArea === 'behavioral'
        ? buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'behavioural_example', candidateText: environment?.latestAnswer?.text || lastUserAnswer })
        : buildValidationQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'claim' });
    }
  } else if (actionType === AGENT_ACTION_TYPES.SWITCH_TOPIC) {
    if (!selectedQuestion?.preparedQuestionId) {
      selectedQuestion = probeType === 'repetition_repair_switch'
        ? buildRepetitionRepairSwitchQuestion({ targetTopic: targetTopic || decisionContext?.coverageState?.missingTopics?.[0] || 'role_fit' })
        : buildSwitchTopicQuestion({ targetTopic: targetTopic || decisionContext?.coverageState?.missingTopics?.[0] || 'role_fit', previousTopic: decisionContext?.currentTopic || '' });
    }
  } else if (actionType === AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION) {
    selectedQuestion = buildAbductiveProbeQuestion({ targetTopic: targetTopic || decisionContext?.abductiveState?.probeTopic || 'decision_tradeoff', hiddenGap: decisionContext?.abductiveState?.hiddenGap || '' });
  } else if (actionType === AGENT_ACTION_TYPES.SHIFT_SECTION) {
    if (!selectedQuestion?.preparedQuestionId) {
      if ((category || decisionContext?.interviewStructure?.forceCategory) === 'technical' || probeType === 'technical_recovery' || targetTopic === 'technical') {
        selectedQuestion = getNextPoolQuestion(session, { freshOnly: true, category: 'technical' }) || buildTechnicalRecoveryQuestion({ targetTopic: decisionContext?.matchState?.validationTargets?.[0] || 'implementation', session, decisionContext });
      } else {
        selectedQuestion = buildSectionShiftQuestion({ nextSectionKey: targetTopic || decisionContext?.sectionState?.nextSectionKey || 'motivation', previousTopic: decisionContext?.currentTopic || '' });
      }
    }
  } else if (actionType === AGENT_ACTION_TYPES.FORCE_SHIFT_PROJECT) {
    selectedQuestion = buildForceShiftProjectQuestion({ targetTopic: targetTopic || 'experience', forbiddenProject: decisionContext?.latestDecision?.actionInput?.forbiddenProject || 'the previous project' });
  } else if (actionType === AGENT_ACTION_TYPES.PROBE_STRESS) {
    selectedQuestion = buildProbeStressQuestion({ targetTopic: targetTopic || 'technical_depth' });
  } else if (actionType === AGENT_ACTION_TYPES.PROBE_FRICTION) {
    selectedQuestion = buildProbeFrictionQuestion({ targetTopic: targetTopic || 'ownership' });
  } else if (actionType === AGENT_ACTION_TYPES.PROBE_TRADE_OFF) {
    selectedQuestion = buildProbeTradeOffQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'technical_depth' });
  } else if (actionType === AGENT_ACTION_TYPES.ANSWER_CANDIDATE_QUESTION) {
    selectedQuestion = {
      type: 'answer_candidate_question',
      stage: 'closing',
      topic: 'candidate_questions',
      category: 'closing',
      followUpDepth: 0,
      text: 'Answer the candidate\'s question thoughtfully based on your knowledge of the role, and then ask if they have any other questions.',
      reason: 'The candidate asked a question during wrap up.',
      sourceType: 'controller_directed',
    };
  } else if (actionType === AGENT_ACTION_TYPES.WRAP_STAGE) {
    if (!selectedQuestion?.preparedQuestionId) {
      selectedQuestion = buildClosingQuestion({ session, decisionContext });
    }
  } else {
    const retrievedQuestion = pickRetrievedQuestion(retrievalBundle, selectedQuestion, targetTopic || decisionContext?.currentTopic || '');
    if (selectedQuestion && retrievedQuestion && !['opening', 'wrap_up'].includes(selectedQuestion.stage) && actionType !== AGENT_ACTION_TYPES.ASK_POOL_QUESTION) {
      selectedQuestion = buildRoleLockedQuestion(retrievedQuestion, selectedQuestion);
    }
  }

  if (turnPlan.turnKind === 'follow_up' && !selectedQuestion) {
    selectedQuestion = focusArea === 'behavioral'
      ? buildProbingQuestion({ targetTopic: turnPlan.followUpContext?.parentTopic || targetTopic || decisionContext?.currentTopic || 'behavioural_example' })
      : buildDeepDiveQuestion({ targetTopic: turnPlan.followUpContext?.parentTopic || targetTopic || decisionContext?.currentTopic || 'project' });
  }

  if (turnPlan.turnKind === 'follow_up' && selectedQuestion) {
    selectedQuestion = {
      ...selectedQuestion,
      preparedQuestionId: null,
      sourceId: selectedQuestion.sourceId && selectedQuestion.sourceId === selectedQuestion.preparedQuestionId ? null : selectedQuestion.sourceId,
      followUpDepth: turnPlan.followUpContext?.followUpDepth || Math.max(1, Number(selectedQuestion.followUpDepth || 1)),
      parentQuestionId: turnPlan.followUpContext?.parentQuestionId || null,
      rootQuestionId: turnPlan.followUpContext?.rootQuestionId || null,
      parentPreparedQuestionId: turnPlan.followUpContext?.parentPreparedQuestionId || null,
      rootTopic: turnPlan.followUpContext?.rootTopic || selectedQuestion.topic || null,
      followUpIntent: turnPlan.followUpIntent || null,
      evidenceTarget: turnPlan.evidenceTarget || null,
      questionFamily: turnPlan.followUpContext?.questionFamily || selectedQuestion.questionFamily || null,
      evidenceMode: turnPlan.followUpContext?.evidenceMode || selectedQuestion.evidenceMode || null,
      targetedDimensions: turnPlan.followUpContext?.targetedDimensions || [],
      parentQuestionFamily: turnPlan.followUpContext?.parentQuestionFamily || null,
      parentEvidenceMode: turnPlan.followUpContext?.parentEvidenceMode || null,
      roleDomain: turnPlan.followUpContext?.roleDomain || selectedQuestion.roleDomain || 'general',
      requirementCategory: turnPlan.followUpContext?.requirementCategory || selectedQuestion.requirementCategory || null,
      capabilityGroup: turnPlan.followUpContext?.capabilityGroup || selectedQuestion.capabilityGroup || null,
    };
  }

  if (focusArea === 'technical' && selectedQuestion && selectedQuestion.category === 'behavioural') {
    selectedQuestion = getNextPoolQuestion(session, { freshOnly: true, category: 'technical' });
  }
  if (focusArea === 'behavioral' && selectedQuestion && selectedQuestion.category === 'technical') {
    selectedQuestion = getNextPoolQuestion(session, { freshOnly: true, category: 'behavioural' });
  }

  selectedQuestion = guardQuestionForInterviewMode({
    focusArea,
    actionType,
    selectedQuestion,
    targetTopic: targetTopic || decisionContext?.currentTopic || decisionContext?.sectionState?.nextSectionKey || '',
    latestAnswer: environment?.latestAnswer?.text || lastUserAnswer,
  });
  selectedQuestion = normalizeQuestionIntent({ question: selectedQuestion, actionType, focusArea });

  if (!selectedQuestion && (lockedCategory === 'technical' || category === 'technical' || decisionContext?.interviewStructure?.forceCategory === 'technical')) {
    selectedQuestion = buildTechnicalRecoveryQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'implementation', session, decisionContext });
  }

  if (!selectedQuestion) {
    selectedQuestion = focusArea === 'technical'
      ? buildTechnicalRecoveryQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'implementation', session, decisionContext })
      : {
          type: 'behavioural_follow_up',
          stage: 'behavioural',
          category: 'behavioural',
          topic: lastUserAnswer.includes('team') ? 'teamwork' : probeType || 'problem_solving',
          followUpDepth: 1,
          text: lastUserAnswer.includes('team')
            ? 'What was your exact role in that team effort, and what result came from it?'
            : 'Can you give me one specific example that shows how you handled that in practice?',
          reason: 'Fallback follow-up when the structured role-linked pool is unavailable.',
          sourceType: 'fallback',
        };
  }

  if (focusArea === 'technical' && selectedQuestion?.category === 'behavioural') {
    selectedQuestion = buildTechnicalRecoveryQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'implementation', session, decisionContext });
  }

  selectedQuestion = guardQuestionForInterviewMode({
    focusArea,
    actionType,
    selectedQuestion,
    targetTopic: targetTopic || decisionContext?.currentTopic || decisionContext?.sectionState?.nextSectionKey || '',
    latestAnswer: environment?.latestAnswer?.text || lastUserAnswer,
  });
  selectedQuestion = normalizeQuestionIntent({ question: selectedQuestion, actionType, focusArea });

  let reactTrace = buildReactTrace({ selectedAction: actionType, decisionContext, selectedQuestion, environment, evaluatorState });
  
  let generatedText = selectedQuestion.fallbackText || selectedQuestion.text;
  let microPlan = null;
  const llmTiming = {
    llmFirstTokenMs: null,
    llmCompleteMs: null,
    ttsFirstAudioMs: null,
    totalEndOfSpeechToFirstAudioMs: null,
  };
  try {
    const llmStartedAt = Date.now();
    microPlan = await runBoundedQuestionMicroPlanning({
      planningFrame: {
        ...turnPlan.planningFrame,
        deliveryMode: session?.mode || session?.settings?.deliveryMode || 'text',
      },
      fallbackQuestion: selectedQuestion.fallbackText || selectedQuestion.text,
      focusArea,
    });
    llmTiming.llmCompleteMs = Date.now() - llmStartedAt;
    generatedText = microPlan.finalSpokenQuestion;
  } catch (error) {
    console.warn('Failed to generate conversational turn via LLM, falling back to base template', error);
  }

  generatedText = guardGeneratedTextForInterviewMode({
    focusArea,
    generatedText,
    fallbackText: selectedQuestion.fallbackText || selectedQuestion.text,
    selectedQuestion,
  });
  generatedText = polishQuestionWording(generatedText);
  const noveltyGuardStartedAt = Date.now();
  const questionHistory = buildQuestionHistory(transcript);
  const generatedNovelty = evaluateQuestionNovelty({
    candidate: selectedQuestion,
    spokenText: generatedText,
    history: questionHistory,
  });
  let deduplication = {
    modelOutputRejected: false,
    usedBaseQuestion: false,
    reason: generatedNovelty.reason,
    assessmentKey: generatedNovelty.assessmentKey,
    fingerprint: generatedNovelty.fingerprint,
    matchedQuestionId: generatedNovelty.matchedQuestionId,
    similarity: generatedNovelty.similarity,
  };
  if (!generatedNovelty.allowed) {
    const baseText = polishQuestionWording(guardGeneratedTextForInterviewMode({
      focusArea,
      generatedText: selectedQuestion.fallbackText || selectedQuestion.text,
      fallbackText: selectedQuestion.fallbackText || selectedQuestion.text,
      selectedQuestion,
    }));
    const baseNovelty = evaluateQuestionNovelty({
      candidate: selectedQuestion,
      spokenText: baseText,
      history: questionHistory,
    });
    deduplication = {
      modelOutputRejected: true,
      usedBaseQuestion: baseNovelty.allowed,
      reason: generatedNovelty.reason,
      assessmentKey: generatedNovelty.assessmentKey,
      fingerprint: generatedNovelty.fingerprint,
      matchedQuestionId: generatedNovelty.matchedQuestionId,
      similarity: generatedNovelty.similarity,
      baseQuestionReason: baseNovelty.reason,
    };
    if (!baseNovelty.allowed) {
      let alternative = null;
      for (const candidate of turnPlan.alternativeRootCandidates || []) {
        const mappedQuestion = mapRootCandidateToQuestion({ candidate, targetTopic, category: lockedCategory });
        const alternativeText = polishQuestionWording(guardGeneratedTextForInterviewMode({
          focusArea,
          generatedText: mappedQuestion?.fallbackText || mappedQuestion?.text,
          fallbackText: mappedQuestion?.fallbackText || mappedQuestion?.text,
          selectedQuestion: mappedQuestion,
        }));
        const alternativeNovelty = evaluateQuestionNovelty({
          candidate: mappedQuestion,
          spokenText: alternativeText,
          history: questionHistory,
        });
        if (alternativeNovelty.allowed) {
          alternative = { question: mappedQuestion, text: alternativeText, novelty: alternativeNovelty };
          break;
        }
      }
      if (!alternative) {
        return {
          questionType: 'wrap_up',
          nextQuestion: null,
          displayText: '',
          rationale: 'No unique interview question remains after transcript deduplication.',
          stage: 'wrap_up',
          topic: 'completed',
          followUpDepth: 0,
          retrievalSnapshot: retrievalBundle,
          isComplete: true,
          completedBecause: 'no_unique_question_remaining',
          reactTrace,
          deduplication,
        };
      }
      selectedQuestion = alternative.question;
      generatedText = alternative.text;
      reactTrace = buildReactTrace({ selectedAction: actionType, decisionContext, selectedQuestion, environment, evaluatorState });
      deduplication = {
        ...deduplication,
        usedAlternativeBaseQuestion: true,
        alternativeQuestionId: selectedQuestion.preparedQuestionId,
        alternativeReason: alternative.novelty.reason,
      };
    } else {
      generatedText = baseText;
    }
  }
  deduplication.rejectedCandidates = turnPlan.rejectedCandidates || [];
  llmTiming.finalNoveltyGuardMs = Date.now() - noveltyGuardStartedAt;
  if (onSentence) {
    await onSentence(generatedText, 0);
  }

  const displayTurn = {
    feedbackMode: 'conversational_llm',
    preamble: '',
    question: selectedQuestion.fallbackText || selectedQuestion.text,
    displayText: generatedText,
  };

  const questionDecision = buildQuestionDecisionTrace({
    selectedQuestion,
    session,
    decisionContext,
    selectedAction: actionType,
    actionInput: { targetTopic, probeType, freshOnly, category: lockedCategory },
    generatedText: displayTurn.displayText,
    confidence: decisionContext?.latestDecision?.confidence || null,
    selectionSource: decisionContext?.latestDecision?.selectionSource || 'rule_fallback',
  });
  questionDecision.turnKind = turnPlan.turnKind;
  questionDecision.scenario = turnPlan.scenario;
  questionDecision.sourcePolicy = turnPlan.sourcePolicy;
  questionDecision.evidencePackage = turnPlan.evidencePackage;
  questionDecision.topRootCandidates = turnPlan.topRootCandidates;
  questionDecision.poolDegraded = turnPlan.poolDegraded;
  questionDecision.poolDegradedReason = turnPlan.poolDegradedReason;
  questionDecision.rejectedCandidates = turnPlan.rejectedCandidates;
  questionDecision.parentQuestionId = selectedQuestion.parentQuestionId || turnPlan.followUpContext?.parentQuestionId || null;
  questionDecision.rootQuestionId = selectedQuestion.rootQuestionId || turnPlan.followUpContext?.rootQuestionId || null;
  questionDecision.parentPreparedQuestionId = selectedQuestion.parentPreparedQuestionId || turnPlan.followUpContext?.parentPreparedQuestionId || null;
  questionDecision.followUpIntent = selectedQuestion.followUpIntent || turnPlan.followUpIntent || null;
  questionDecision.followUpDepth = selectedQuestion.followUpDepth || turnPlan.followUpContext?.followUpDepth || 0;
  questionDecision.rootTopic = selectedQuestion.rootTopic || turnPlan.followUpContext?.rootTopic || selectedQuestion.topic || null;
  questionDecision.evidenceTarget = selectedQuestion.evidenceTarget || turnPlan.evidenceTarget || null;
  questionDecision.selectedAngle = microPlan?.selectedAngle || null;
  questionDecision.shortReason = microPlan?.shortReason || null;
  questionDecision.microPlanEvidenceUsed = microPlan?.evidenceUsed || [];
  questionDecision.riskFlags = microPlan?.riskFlags || [];
  questionDecision.deduplication = deduplication;
  questionDecision.catalogQuestionId = selectedQuestion.catalogQuestionId || null;
  questionDecision.catalogVersion = selectedQuestion.catalogVersion || null;
  questionDecision.coverageSlot = selectedQuestion.coverageSlot || null;
  questionDecision.selectionPolicy = selectedQuestion.selectionPolicy || null;
  questionDecision.eligibilityReason = selectedQuestion.eligibilityReason || [];
  questionDecision.followUpComparison = turnPlan.followUpComparison || null;
  questionDecision.latency = {
    ...(turnPlan.latency || {}),
    ...llmTiming,
  };
  if (selectedQuestion.preparedQuestionId) {
    questionDecision.preparedQuestionId = selectedQuestion.preparedQuestionId;
    questionDecision.rankTrace = selectedQuestion.rankTrace || null;
    questionDecision.selectionSource = 'prepared_question_pool';
  }

  return {
    questionType: selectedQuestion.type,
    nextQuestion: selectedQuestion.fallbackText || selectedQuestion.text,
    interviewerTurn: displayTurn,
    displayText: displayTurn.displayText,
    rationale: selectedQuestion.reason,
    rationaleSummary: selectedQuestion.reason,
    stage: selectedQuestion.stage,
    topic: selectedQuestion.topic,
    followUpDepth: selectedQuestion.followUpDepth || 0,
    sourceType: selectedQuestion.sourceType || 'agent_generated',
    questionCategory: selectedQuestion.category || (String(selectedQuestion.stage || '').includes('behaviour') ? 'behavioural' : String(selectedQuestion.stage || '').includes('technical') ? 'technical' : String(selectedQuestion.stage || '').includes('opening') ? 'opening' : 'experience'),
    evidenceTypeHint: inferEvidenceTypeHint(selectedQuestion),
    questionDecision,
    questionRanking: questionDecision.ranking,
    turnKind: turnPlan.turnKind,
    scenario: turnPlan.scenario,
    sourcePolicy: turnPlan.sourcePolicy,
    evidencePackage: turnPlan.evidencePackage,
    topRootCandidates: turnPlan.topRootCandidates,
    poolDegraded: turnPlan.poolDegraded,
    poolDegradedReason: turnPlan.poolDegradedReason,
    latency: questionDecision.latency,
    parentQuestionId: selectedQuestion.parentQuestionId || null,
    parentPreparedQuestionId: selectedQuestion.parentPreparedQuestionId || null,
    rootQuestionId: selectedQuestion.rootQuestionId || null,
    rootTopic: selectedQuestion.rootTopic || null,
    followUpIntent: selectedQuestion.followUpIntent || null,
    evidenceTarget: selectedQuestion.evidenceTarget || null,
    questionFamily: selectedQuestion.questionFamily || null,
    evidenceMode: selectedQuestion.evidenceMode || null,
    targetedDimensions: selectedQuestion.targetedDimensions || [],
    parentQuestionFamily: selectedQuestion.parentQuestionFamily || null,
    parentEvidenceMode: selectedQuestion.parentEvidenceMode || null,
    roleDomain: selectedQuestion.roleDomain || 'general',
    requirementCategory: selectedQuestion.requirementCategory || null,
    capabilityGroup: selectedQuestion.capabilityGroup || null,
    catalogQuestionId: selectedQuestion.catalogQuestionId || null,
    catalogVersion: selectedQuestion.catalogVersion || null,
    catalogLifecycle: selectedQuestion.catalogLifecycle || null,
    targetLevel: selectedQuestion.targetLevel || null,
    testedSignals: selectedQuestion.testedSignals || [],
    eligibilityReason: selectedQuestion.eligibilityReason || [],
    selectionPolicy: selectedQuestion.selectionPolicy || null,
    coverageSlot: selectedQuestion.coverageSlot || null,
    ambiguityMode: selectedQuestion.ambiguityMode || null,
    clarificationContextVersion: selectedQuestion.clarificationContextVersion || null,
    clarificationContext: selectedQuestion.clarificationContext || null,
    reportDimensions: selectedQuestion.reportDimensions || [],
    preparedQuestionId: selectedQuestion.preparedQuestionId || null,
    rankTrace: selectedQuestion.rankTrace || null,
    retrievalSnapshot: retrievalBundle,
    isComplete: false,
    reactTrace,
  };
};
