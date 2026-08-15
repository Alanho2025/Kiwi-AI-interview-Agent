import { lookupRealWorldTradeOff } from '../../config/realWorldInterviewPatterns.js';
import { extractTargetTechnicalTerms } from '../questions/questionArtifactHelpers.js';

export const normalizeText = (value = '') => String(value || '').trim();
export const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
export const getLastUserAnswer = (transcript = []) => [...transcript].reverse().find((turn) => turn.role === 'user')?.text || '';

export const inferQuestionGoal = (question = {}, actionType = '') => {
  const type = String(question.type || actionType || '').toLowerCase();
  if (type.includes('deep')) return 'deep_dive_on_decision_quality';
  if (type.includes('validation')) return 'validate_claim_with_direct_evidence';
  if (type.includes('rephrase')) return 'clarify_current_question_with_one_concrete_example';
  if (type.includes('abductive')) return 'probe_inferred_gap_without_leading';
  if (type.includes('stress')) return 'test_constraints_and_adaptation';
  if (type.includes('friction')) return 'surface_tradeoff_conflict_or_failure';
  if (type.includes('shift')) return 'open_fresh_coverage_topic';
  if (type.includes('closing')) return 'close_interview_with_final_useful_evidence';
  return 'collect_specific_example_with_action_and_result';
};

export const inferEvidenceNeed = (question = {}, actionType = '') => {
  const goal = inferQuestionGoal(question, actionType);
  if (goal === 'deep_dive_on_decision_quality') return ['tradeoff', 'personal_action', 'validation_method', 'result'];
  if (goal === 'validate_claim_with_direct_evidence') return ['personal_ownership', 'validation_method', 'result_or_impact'];
  if (goal === 'clarify_current_question_with_one_concrete_example') return ['specific_example', 'personal_action', 'result_or_impact'];
  if (goal === 'probe_inferred_gap_without_leading') return ['hidden_gap', 'personal_action', 'tradeoff_or_failure_detail'];
  if (goal === 'test_constraints_and_adaptation') return ['constraint_handling', 'decision_quality', 'tradeoff'];
  if (goal === 'surface_tradeoff_conflict_or_failure') return ['friction', 'stakeholder_or_constraint', 'resolution'];
  if (goal === 'open_fresh_coverage_topic') return ['coverage', 'specific_example'];
  return ['specific_example', 'personal_action', 'result_or_impact'];
};

export const buildQuestionConstraints = ({ question = {}, focusArea = 'combined' } = {}) => {
  const constraints = ['ask_one_question_only'];
  if (Number(question.followUpDepth || 0) > 0) constraints.push('stay_on_same_example');
  if (question.freshOnly || Number(question.followUpDepth || 0) === 0) constraints.push('allow_fresh_example');
  if (focusArea === 'behavioral') constraints.push('behavioural_star_only', 'do_not_ask_technical_implementation_details');
  if (focusArea === 'technical') constraints.push('technical_evidence_only', 'avoid_purely_behavioural_drift');
  if (question.category === 'closing') constraints.push('do_not_start_long_follow_up_chain');
  return constraints;
};

export const normalizeQuestionIntent = ({ question = {}, actionType = '', focusArea = 'combined', analysisResult = {} } = {}) => {
  if (!question) return question;
  const fallbackText = normalizeText(question.fallbackText || question.text);
  const targetTechnicalTerms = Array.isArray(question.targetTechnicalTerms) && question.targetTechnicalTerms.length
    ? question.targetTechnicalTerms
    : extractTargetTechnicalTerms({
      questionText: question.text || fallbackText,
      topic: question.topic || '',
      matchedSkill: question.matchedSkill || '',
      basedOnSkills: question.basedOnSkills || [],
      evidenceRefs: question.evidenceRefs || [],
      analysisResult,
      questionId: question.id || question.questionId || null,
    });
  return {
    ...question,
    questionGoal: question.questionGoal || inferQuestionGoal(question, actionType),
    evidenceNeed: Array.isArray(question.evidenceNeed) ? question.evidenceNeed : inferEvidenceNeed(question, actionType),
    constraints: Array.isArray(question.constraints) ? question.constraints : buildQuestionConstraints({ question, focusArea }),
    targetTechnicalTerms,
    fallbackText,
    text: question.text || fallbackText,
  };
};


export const buildRoleLockedQuestion = (retrievedItem = {}, fallback = {}) => {
  const metadata = retrievedItem.metadata || {};
  const questionFamily = fallback.questionFamily || retrievedItem.questionFamily || metadata.questionFamily || null;
  const evidenceMode = fallback.evidenceMode || retrievedItem.evidenceMode || metadata.evidenceMode || null;

  return {
    type: fallback.type || retrievedItem.questionType || metadata.questionType || fallback.stage || 'technical_core',
    stage: fallback.stage || retrievedItem.stage || metadata.stage || 'technical_core',
    topic: fallback.topic || retrievedItem.topic || metadata.skillTags?.[0] || metadata.category || 'role_fit',
    category: fallback.category || retrievedItem.category || metadata.category || null,
    followUpDepth: fallback.followUpDepth || retrievedItem.followUpDepth || 0,
    text: metadata.question || retrievedItem.text,
    reason: `Retrieved from role-matched question bank (${metadata.roleCanonical || metadata.roleFamily || 'general'}).`,
    sourceType: retrievedItem.sourceType,
    sourceId: retrievedItem.sourceId,
    questionFamily,
    evidenceMode,
    roleDomain: fallback.roleDomain || retrievedItem.roleDomain || metadata.roleDomain || 'general',
    requirementCategory: fallback.requirementCategory || retrievedItem.requirementCategory || metadata.requirementCategory || null,
    capabilityGroup: fallback.capabilityGroup || retrievedItem.capabilityGroup || metadata.capabilityGroup || null,
    targetedDimensions: fallback.targetedDimensions || retrievedItem.targetedDimensions || metadata.targetedDimensions || [],
  };
};

export const pickRetrievedQuestion = (retrievalBundle, selectedQuestion, targetTopic = '') => {
  if (!retrievalBundle?.items?.length) return null;
  const topicTokens = new Set(tokenize(targetTopic || selectedQuestion?.topic || ''));
  const desiredSource = selectedQuestion?.stage === 'behavioural' ? 'behavioural_bank' : 'question_bank';
  const sameStage = retrievalBundle.items.find((item) => {
    if (![desiredSource, 'question_bank', 'behavioural_bank'].includes(item.sourceType)) return false;
    const skillTags = item.metadata?.skillTags || [];
    if (!topicTokens.size) return item.sourceType === desiredSource;
    return skillTags.some((tag) => topicTokens.has(String(tag).toLowerCase())) || tokenize(item.metadata?.category || '').some((token) => topicTokens.has(token));
  });
  return sameStage
    || retrievalBundle.items.find((item) => item.sourceType === desiredSource)
    || retrievalBundle.items.find((item) => item.sourceType === 'question_bank' || item.sourceType === 'behavioural_bank')
    || null;
};

export const normalizeKey = (value = '') => String(value || '').trim().toLowerCase();

const CANDIDATE_TOPIC_PHRASES = {
  communication: 'explaining a complex idea clearly',
  teamwork: 'working with others to solve a problem',
  leadership: 'helping guide a team decision',
  problem_solving: 'solving a difficult problem',
  problem: 'solving a difficult problem',
  adaptability: 'changing your approach after feedback',
  stakeholder: 'working with a stakeholder',
  customer: 'handling a customer situation',
  decision_tradeoff: 'making a difficult trade-off',
  role_fit: 'your fit for this role',
  behavioural_example: 'that behavioural example',
  project_behaviour: 'your behaviour in that project',
  claim: 'that claim',
  ownership: 'your ownership',
  technical_depth: 'your technical approach',
};

export const toCandidatePhrase = (topic = '') => {
  const clean = normalizeText(topic);
  const key = normalizeKey(clean).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return CANDIDATE_TOPIC_PHRASES[key] || clean || 'this area';
};

export const buildQuestionRootKey = (question = {}) => {
  const topic = normalizeKey(question.topic || '');
  const category = normalizeKey(question.category || (String(question.stage || '').includes('behaviour') ? 'behavioural' : String(question.stage || '').includes('technical') ? 'technical' : 'experience'));
  const type = normalizeKey(question.type || '');
  return [topic || 'topic', category || 'category', type || 'type'].join(':');
};

export const isDuplicateRootQuestion = (question = null, decisionContext = {}) => {
  if (!question || Number(question.followUpDepth || 0) > 0) return false;
  const rootKey = buildQuestionRootKey(question);
  return (decisionContext?.interviewStructure?.askedRootQuestionKeys || []).some((item) => normalizeKey(item) === rootKey);
};

export const pickPriorityTechnicalTopic = ({ session = {}, decisionContext = {}, targetTopic = '' } = {}) => {
  const sources = [
    targetTopic,
    ...(decisionContext?.matchState?.validationTargets || []),
    ...(decisionContext?.retrievalState?.priorityTopics || []),
    ...(session?.analysisResult?.matchingDetails?.questionPlanHints?.priorityTopics || []),
    ...(session?.analysisResult?.matchingDetails?.topMatchedSkills || []),
    ...((session?.analysisResult?.planPreview?.topMatchedAreas) || []),
  ];
  const ignored = new Set(['technical', 'implementation', 'project', 'role_fit', 'claim', 'experience', 'candidate_questions']);
  for (const item of sources) {
    const clean = normalizeText(item);
    if (!clean) continue;
    const lowered = clean.toLowerCase();
    if (ignored.has(lowered)) continue;
    return clean;
  }
  return normalizeText(targetTopic) || 'implementation';
};

export const inferRequirementCategoryFromTopic = (topic = '') => {
  const lower = normalizeText(topic).toLowerCase();
  if (/registered|registration|licen[cs]e|certificat|qualification|degree|bachelor|master/.test(lower)) return 'qualification';
  if (/safety|compliance|policy|regulatory|legal|privacy/.test(lower)) return 'compliance_or_safety';
  if (/customer|client|stakeholder|complaint|relationship|escalation/.test(lower)) return 'customer_or_stakeholder';
  if (/communicat|writing|present|report|documentation/.test(lower)) return 'communication';
  if (/lead|manage|mentor|supervis/.test(lower)) return 'leadership';
  if (/aws|azure|cloud|react|sql|database|postgres|python|api|debug|troubleshoot|automation|deploy|software|technical/.test(lower)) return 'technical';
  return 'responsibility';
};

export const buildMatchedTechnicalQuestion = ({ topic = 'implementation' } = {}) => {
  const normalizedTopic = normalizeText(topic) || 'implementation';
  const lower = normalizedTopic.toLowerCase();
  const inferredCategory = inferRequirementCategoryFromTopic(normalizedTopic);
  const spokenTopic = toCandidatePhrase(normalizedTopic);
  const skillAwareText = inferredCategory === 'qualification'
    ? `What evidence shows your ${spokenTopic} in practice?`
    : inferredCategory === 'compliance_or_safety'
      ? `Tell me about a time you applied ${spokenTopic}.`
      : inferredCategory === 'customer_or_stakeholder'
        ? `How did you handle a difficult ${spokenTopic} situation?`
        : inferredCategory === 'communication'
          ? 'Tell me about a time you explained a complex idea clearly.'
          : inferredCategory === 'leadership'
            ? 'Tell me about a time you helped guide a team decision.'
            : lower.includes('react')
    ? 'What React feature or frontend flow did you build yourself?'
    : lower.includes('postgres') || lower.includes('sql') || lower.includes('database')
      ? 'What database or SQL task did you handle yourself?'
      : lower.includes('aws') || lower.includes('cloud') || lower.includes('deploy')
        ? 'What cloud or deployment task did you own?'
        : lower.includes('debug') || lower.includes('troubleshoot')
          ? 'Tell me about one debugging problem you solved.'
          : lower.includes('automation')
            ? 'What automation task did you build or improve?'
            : inferredCategory === 'responsibility'
              ? `Tell me about a real example where you handled ${spokenTopic}.`
              : `What is one concrete example where you used ${spokenTopic}?`;

  return {
    type: inferredCategory === 'technical' ? 'technical_recovery_follow_up' : 'role_competency_recovery_follow_up',
    stage: 'technical',
    topic: normalizedTopic,
    category: 'technical',
    followUpDepth: 0,
    text: skillAwareText,
    reason: `The interview still needs grounded role evidence, so the controller is using a role-matched topic (${normalizedTopic}).`,
    sourceType: 'controller_directed',
  };
};

export const buildClosingQuestion = ({ session = {}, decisionContext = {} } = {}) => {
  const technicalCount = Number(decisionContext?.interviewStructure?.categoryCounts?.technical || 0);
  const behaviouralCount = Number(decisionContext?.interviewStructure?.categoryCounts?.behavioural || 0);
  const focusArea = String(decisionContext?.interviewStructure?.focusAreaKey || session?.settings?.focusArea || 'combined').toLowerCase();
  if (focusArea === 'technical' || (focusArea === 'combined' && technicalCount <= behaviouralCount)) {
    const topic = pickPriorityTechnicalTopic({ session, decisionContext, targetTopic: 'implementation' });
    return {
      type: 'closing_technical_check',
      stage: 'closing',
      topic,
      category: 'closing',
      followUpDepth: 0,
      text: `Before we wrap up, what did you personally own in ${toCandidatePhrase(topic)}?`,
      reason: 'The session is at its final planned turn, so the interviewer is using a clear closing question that still checks concrete role ownership.',
      sourceType: 'controller_directed',
    };
  }

  return {
    type: 'closing_candidate_questions',
    stage: 'closing',
    topic: 'candidate_questions',
    category: 'closing',
    followUpDepth: 0,
    text: 'Before we finish, what questions do you have for me about the role or team?',
    reason: 'The session is at its final planned turn, so the interviewer is closing with a standard final question.',
    sourceType: 'controller_directed',
  };
};

export const buildTechnicalRecoveryQuestion = ({ targetTopic = 'implementation', session = {}, decisionContext = {} } = {}) => {
  const selectedTopic = pickPriorityTechnicalTopic({ session, decisionContext, targetTopic });
  return buildMatchedTechnicalQuestion({ topic: selectedTopic });
};

export const inferEvidenceTypeHint = (question = {}) => {
  const stage = String(question.stage || question.type || '').toLowerCase();
  if (stage.includes('technical')) return 'direct_past_experience';
  if (stage.includes('experience')) return 'direct_past_experience';
  if (stage.includes('behavioural')) return 'direct_past_experience';
  if (stage.includes('wrap')) return 'candidate_questions';
  return 'adjacent_experience';
};

export const buildProbingQuestion = ({ targetTopic = 'project', candidateText = '', missingEvidence = null } = {}) => {
  const hasTeamworkReference = /\b(we|our team|together|cooperated|collaborated)\b/i.test(candidateText);
  let text = 'What did you personally own and build in that example?';
  let reason = 'Culturally nuanced probing for personal action and ownership.';

  if (missingEvidence === 'result_or_validation') {
    text = 'What was the final outcome or measurable impact of that specific project?';
    reason = 'Probing specifically for missing result or validation evidence.';
  } else if (missingEvidence === 'tradeoff_or_constraint') {
    text = 'What was the hardest decision or technical trade-off you had to make there?';
    reason = 'Probing specifically for missing tradeoff evidence.';
  } else if (missingEvidence === 'personal_ownership' || hasTeamworkReference) {
    text = hasTeamworkReference
      ? 'That sounds like a great team effort! What was your specific piece of the puzzle there, and what did you personally build or design?'
      : 'What did you personally own and build in that example?';
    reason = 'Culturally nuanced probing for personal action and ownership.';
  }

  return {
    type: 'probing_follow_up',
    stage: 'technical_probe',
    topic: targetTopic,
    category: 'technical',
    followUpDepth: 1,
    text,
    reason,
    sourceType: 'controller_directed',
  };
};

export const buildRephrasedQuestion = ({ targetTopic = 'project', environment = {} } = {}) => ({
  type: 'rephrased_follow_up',
  stage: environment?.questionContext?.latestQuestionStage || 'clarification',
  topic: targetTopic,
  category: String(environment?.questionContext?.latestQuestionStage || '').includes('behaviour') ? 'behavioural' : 'technical',
  followUpDepth: 1,
  text: 'Let me rephrase that. Pick one real example and explain your role, action, and outcome.',
  reason: 'The evaluator detected likely misunderstanding, so the interviewer should restate the question with a tighter structure.',
  sourceType: 'controller_directed',
});

export const buildDeepDiveQuestion = ({ targetTopic = 'project' } = {}) => ({
  type: 'deep_dive_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: 'What was the hardest decision you made there?',
  reason: 'The latest answer was usable but still partial, so a deeper question should capture decision quality and ownership.',
  sourceType: 'controller_directed',
});

export const buildProbeTradeOffQuestion = ({ targetTopic = 'technical_depth' } = {}) => {
  const matchedPattern = lookupRealWorldTradeOff(targetTopic);
  let text = matchedPattern?.tradeOffQuestion;
  if (!text) {
    const phrase = toCandidatePhrase(targetTopic);
    text = phrase && phrase !== 'this area' && phrase !== 'this role'
      ? `You mentioned using ${phrase} there. What was the biggest limitation or technical trade-off you accepted with that choice?`
      : 'What was the biggest limitation or technical trade-off you accepted with that choice?';
  }
  return {
    type: 'probe_tradeoff_follow_up',
    stage: 'technical_tradeoff',
    topic: targetTopic,
    category: 'technical',
    followUpDepth: 2,
    text,
    reason: 'Organic trade-off probe rooted in candidate technical narrative.',
    sourceType: 'controller_directed',
  };
};

export const buildValidationQuestion = ({ targetTopic = 'claim' } = {}) => ({
  type: 'validation_follow_up',
  stage: 'technical_validation',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 1,
  text: 'How did you know your part worked?',
  reason: 'This question validates a claim that still needs direct supporting evidence.',
  sourceType: 'controller_directed',
});

export const buildSwitchTopicQuestion = ({ targetTopic = 'role_fit', previousTopic = '' } = {}) => {
  const cleanPrev = toCandidatePhrase(previousTopic);
  const cleanTarget = toCandidatePhrase(targetTopic);
  const bridgingText = cleanPrev && cleanPrev !== 'this area' && cleanPrev !== 'this role'
    ? `That makes sense for ${cleanPrev}. Moving on to ${cleanTarget}, can you share one practical example?`
    : `Can you share one example that shows ${cleanTarget}?`;
  return {
    type: 'coverage_follow_up',
    stage: 'coverage',
    topic: targetTopic,
    category: 'experience',
    followUpDepth: 0,
    text: bridgingText,
    reason: 'Bridged topic switch to ensure clear context transition.',
    sourceType: 'controller_directed',
  };
};

export const buildRepetitionRepairSwitchQuestion = ({ targetTopic = 'role_fit' } = {}) => ({
  type: 'repetition_repair_switch',
  stage: 'coverage',
  topic: targetTopic,
  category: 'experience',
  followUpDepth: 0,
  text: `You're right, we covered that. Can you use a different example for ${toCandidatePhrase(targetTopic)}?`,
  reason: 'The candidate flagged repetition, so the interviewer acknowledges it and moves to a fresh topic.',
  sourceType: 'controller_directed',
});

export const buildAbductiveProbeQuestion = ({ targetTopic = 'decision_tradeoff', hiddenGap = '' } = {}) => ({
  type: 'abductive_probe_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: hiddenGap
    ? `You hinted at ${hiddenGap}. What was hardest there?`
    : `What was hardest about ${toCandidatePhrase(targetTopic)}?`,
  reason: 'The controller inferred a hidden gap that should be tested before moving on.',
  sourceType: 'controller_directed',
});

export const buildSectionShiftQuestion = ({ nextSectionKey = 'motivation', previousTopic = '' } = {}) => {
  const cleanPrev = toCandidatePhrase(previousTopic);
  const cleanNext = toCandidatePhrase(nextSectionKey);
  const prefix = cleanPrev && cleanPrev !== 'this area' && cleanPrev !== 'this role'
    ? `We've covered ${cleanPrev} well. `
    : '';
  let body = `Can you share one example from ${cleanNext}?`;
  if (nextSectionKey === 'motivation') body = `${prefix}What makes this role a strong fit for you now?`;
  else if (nextSectionKey === 'behavioural') body = `${prefix}Tell me about one challenge you worked through with others.`;
  else if (nextSectionKey === 'technical') body = `${prefix}What technical decision did you make yourself?`;
  else if (nextSectionKey === 'reflection_close') body = `${prefix}What would you improve if you answered one past question again?`;
  return {
    type: 'section_shift_follow_up',
    stage: nextSectionKey,
    topic: nextSectionKey,
    category: nextSectionKey === 'technical' ? 'technical' : nextSectionKey === 'behavioural' ? 'behavioural' : nextSectionKey === 'closing' ? 'closing' : 'experience',
    followUpDepth: 0,
    text: body,
    reason: 'Bridged section shift for smooth interview section transition.',
    sourceType: 'controller_directed',
  };
};

export const buildForceShiftProjectQuestion = ({ targetTopic = 'experience', forbiddenProject = '' } = {}) => ({
  type: 'force_shift_project_follow_up',
  stage: 'experience_breadth',
  topic: targetTopic,
  category: 'experience',
  followUpDepth: 1,
  text: `Let's use a different CV example. What shows ${toCandidatePhrase(targetTopic)}?`,
  reason: `The candidate has overused the "${forbiddenProject}" example, so the interviewer is forcing a context switch to ensure CV coverage.`,
  sourceType: 'controller_directed',
});

export const buildProbeStressQuestion = ({ targetTopic = 'technical_depth' } = {}) => {
  const phrase = toCandidatePhrase(targetTopic);
  const text = phrase && phrase !== 'this area'
    ? `If ${phrase} experienced a 10x traffic or latency spike, where would your architecture fail first and how did you defend it?`
    : 'If your architecture experienced a 10x traffic or latency spike, where would it fail first and how did you defend it?';
  return {
    type: 'probe_stress_follow_up',
    stage: 'technical_stress',
    topic: targetTopic,
    category: 'technical',
    followUpDepth: 2,
    text,
    reason: 'Applying a 10x scale/latency constraint test to probe architecture limits and disaster resilience.',
    sourceType: 'controller_directed',
  };
};

export const buildProbeFrictionQuestion = ({ targetTopic = 'ownership' } = {}) => {
  const phrase = toCandidatePhrase(targetTopic);
  const text = phrase && phrase !== 'this area'
    ? `What was the worst outage, technical conflict, or trade-off you encountered in ${phrase}, and how did you resolve it?`
    : 'What was the worst technical outage, conflict, or trade-off you encountered, and how did you resolve it?';
  return {
    type: 'probe_friction_follow_up',
    stage: 'friction_analysis',
    topic: targetTopic,
    category: 'behavioural',
    followUpDepth: 2,
    text,
    reason: 'Probing for real-world technical friction, trade-offs, outage recovery, and accountability under pressure.',
    sourceType: 'controller_directed',
  };
};

export const buildReactTrace = ({ selectedAction, decisionContext, selectedQuestion, environment, evaluatorState }) => {
  const targetTopic = selectedQuestion?.topic || decisionContext?.currentTopic || environment?.questionContext?.latestQuestionTopic || 'role_fit';
  const thoughtParts = [
    `Current section: ${decisionContext?.sectionState?.sectionKey || decisionContext?.currentStage || environment?.questionContext?.latestQuestionStage || 'opening'}.`,
    `Target topic: ${targetTopic}.`,
  ];
  if (decisionContext?.coverageState?.missingTopics?.length) thoughtParts.push(`Missing topics still include ${decisionContext.coverageState.missingTopics.slice(0, 2).join(', ')}.`);
  if (decisionContext?.matchState?.validationTargets?.length) thoughtParts.push(`Validation targets remain for ${decisionContext.matchState.validationTargets.slice(0, 2).join(', ')}.`);
  if (decisionContext?.abductiveState?.shouldProbe) thoughtParts.push(`Hidden gap inferred: ${decisionContext.abductiveState.hiddenGap}.`);
  if (evaluatorState?.misunderstandingFlag) thoughtParts.push('The evaluator signalled likely misunderstanding on the previous answer.');
  else if (evaluatorState?.evidenceGainScore != null) thoughtParts.push(`Latest evidence gain was ${evaluatorState.evidenceGainScore}.`);
  return {
    thoughtSummary: thoughtParts.join(' '),
    actionName: selectedAction,
    observationSummary: environment?.latestAnswer?.text
      ? `Latest answer length was ${environment.latestAnswer.tokenCount} tokens with interaction status ${evaluatorState?.interactionStatus || 'unknown'}.`
      : 'No user answer has been observed yet in the current controller step.',
  };
};
