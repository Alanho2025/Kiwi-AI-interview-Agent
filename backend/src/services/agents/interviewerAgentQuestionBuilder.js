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

export const normalizeQuestionIntent = ({ question = {}, actionType = '', focusArea = 'combined' } = {}) => {
  if (!question) return question;
  const fallbackText = normalizeText(question.fallbackText || question.text);
  return {
    ...question,
    questionGoal: question.questionGoal || inferQuestionGoal(question, actionType),
    evidenceNeed: Array.isArray(question.evidenceNeed) ? question.evidenceNeed : inferEvidenceNeed(question, actionType),
    constraints: Array.isArray(question.constraints) ? question.constraints : buildQuestionConstraints({ question, focusArea }),
    fallbackText,
    text: question.text || fallbackText,
  };
};

export const buildRoleLockedQuestion = (retrievedItem, fallback = {}) => ({
  type: fallback.type || fallback.stage || 'technical_core',
  stage: fallback.stage || 'technical_core',
  topic: fallback.topic || retrievedItem.metadata?.skillTags?.[0] || retrievedItem.metadata?.category || 'role_fit',
  followUpDepth: fallback.followUpDepth || 0,
  text: retrievedItem.metadata?.question || retrievedItem.text,
  reason: `Retrieved from role-matched question bank (${retrievedItem.metadata?.roleCanonical || retrievedItem.metadata?.roleFamily || 'general'}).`,
  sourceType: retrievedItem.sourceType,
  sourceId: retrievedItem.sourceId,
});

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
  const skillAwareText = inferredCategory === 'qualification'
    ? `Let us validate a key role requirement. Can you walk me through your evidence for ${normalizedTopic}, and where you have applied it in practice?`
    : inferredCategory === 'compliance_or_safety'
      ? `Let us validate a key role requirement. Tell me about a time you had to follow or apply ${normalizedTopic}. What checks did you make, and what was at stake?`
      : inferredCategory === 'customer_or_stakeholder'
        ? `Let us focus on the role requirements. Tell me about a time you handled a difficult customer or stakeholder situation involving ${normalizedTopic}. What happened, what did you do, and what was the outcome?`
        : inferredCategory === 'communication'
          ? `Let us focus on the role requirements. Tell me about a time you used ${normalizedTopic}. Who was the audience, and what result did your communication achieve?`
          : inferredCategory === 'leadership'
            ? `Let us focus on the role requirements. Tell me about a time you showed ${normalizedTopic}. What did you lead or influence, and what changed afterwards?`
            : lower.includes('react')
    ? `Let us move to the technical side. Tell me about one React feature or frontend flow you implemented yourself. What decisions did you make, and how did you know it worked?`
    : lower.includes('postgres') || lower.includes('sql') || lower.includes('database')
      ? `Let us move to the technical side. Tell me about one database or SQL task you handled yourself. What query, schema, or trade-off did you work through, and what result came from it?`
      : lower.includes('aws') || lower.includes('cloud') || lower.includes('deploy')
        ? `Let us move to the technical side. Tell me about one cloud or deployment task you handled yourself using ${normalizedTopic}. What part did you own, and what did you have to troubleshoot?`
        : lower.includes('debug') || lower.includes('troubleshoot')
          ? `Let us move to the technical side. Tell me about one debugging or troubleshooting example from your work. What was the issue, what did you check first, and how did you fix it?`
          : lower.includes('automation')
            ? `Let us move to the technical side. Tell me about one automation task you built or improved. What did you implement yourself, and how did it change the workflow?`
            : inferredCategory === 'responsibility'
              ? `Let us focus on the role requirements. Tell me about a real example where you handled ${normalizedTopic}. What did you own, and what was the result?`
              : `Let us move to the technical side. Tell me about one concrete example where you used ${normalizedTopic}. What did you implement yourself, what trade-off did you handle, and what was the result?`;

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
      text: `Before we wrap up, I want one final role-specific example. Thinking about ${topic}, what did you own yourself, what was the hardest part, and what result came from it?`,
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

export const buildProbingQuestion = ({ targetTopic = 'project' } = {}) => ({
  type: 'probing_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 1,
  text: `Can you walk me through one concrete ${targetTopic} example, what you personally did, and what result it led to?`,
  reason: 'A probing question is needed to collect one concrete example before moving on.',
  sourceType: 'controller_directed',
});

export const buildRephrasedQuestion = ({ targetTopic = 'project', environment = {} } = {}) => ({
  type: 'rephrased_follow_up',
  stage: environment?.questionContext?.latestQuestionStage || 'clarification',
  topic: targetTopic,
  category: String(environment?.questionContext?.latestQuestionStage || '').includes('behaviour') ? 'behavioural' : 'technical',
  followUpDepth: 1,
  text: `Let me rephrase that more clearly. For ${targetTopic}, please pick one real example and tell me your role, what you did, and the outcome.`,
  reason: 'The evaluator detected likely misunderstanding, so the interviewer should restate the question with a tighter structure.',
  sourceType: 'controller_directed',
});

export const buildDeepDiveQuestion = ({ targetTopic = 'project' } = {}) => ({
  type: 'deep_dive_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: `Staying with ${targetTopic}, what trade-off, difficulty, or decision did you handle yourself, and how did you judge whether it worked?`,
  reason: 'The latest answer was usable but still partial, so a deeper question should capture decision quality and ownership.',
  sourceType: 'controller_directed',
});

export const buildValidationQuestion = ({ targetTopic = 'claim' } = {}) => ({
  type: 'validation_follow_up',
  stage: 'technical_validation',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 1,
  text: `You mentioned ${targetTopic}. What exactly did you own, and how did you know it worked well in practice?`,
  reason: 'This question validates a claim that still needs direct supporting evidence.',
  sourceType: 'controller_directed',
});

export const buildSwitchTopicQuestion = ({ targetTopic = 'role_fit' } = {}) => ({
  type: 'coverage_follow_up',
  stage: 'coverage',
  topic: targetTopic,
  category: 'experience',
  followUpDepth: 0,
  text: `I would like to move to ${targetTopic}. Can you share one example that shows your experience in that area?`,
  reason: 'The controller switched topic because an important requirement has not been covered yet.',
  sourceType: 'controller_directed',
});

export const buildRepetitionRepairSwitchQuestion = ({ targetTopic = 'role_fit' } = {}) => ({
  type: 'repetition_repair_switch',
  stage: 'coverage',
  topic: targetTopic,
  category: 'experience',
  followUpDepth: 0,
  text: `You're right, we have covered that angle. Let us move on to ${targetTopic}: can you share one different example that shows your fit in that area?`,
  reason: 'The candidate flagged repetition, so the interviewer acknowledges it and moves to a fresh topic.',
  sourceType: 'controller_directed',
});

export const buildAbductiveProbeQuestion = ({ targetTopic = 'decision_tradeoff', hiddenGap = '' } = {}) => ({
  type: 'abductive_probe_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: `You hinted at ${hiddenGap || targetTopic}. What was the hardest trade-off or gap there, and how did you handle it in practice?`,
  reason: 'The controller inferred a hidden gap that should be tested before moving on.',
  sourceType: 'controller_directed',
});

export const buildSectionShiftQuestion = ({ nextSectionKey = 'motivation' } = {}) => ({
  type: 'section_shift_follow_up',
  stage: nextSectionKey,
  topic: nextSectionKey,
  category: nextSectionKey === 'technical' ? 'technical' : nextSectionKey === 'behavioural' ? 'behavioural' : nextSectionKey === 'closing' ? 'closing' : 'experience',
  followUpDepth: 0,
  text: nextSectionKey === 'motivation'
    ? 'Let us shift to motivation. What makes this role a strong fit for you now?'
    : nextSectionKey === 'behavioural'
      ? 'Let us move to teamwork and problem solving. Can you share one situation where you had to work through a challenge with others?'
      : nextSectionKey === 'technical'
        ? 'Let us move to technical depth. Can you share one example where you made an important implementation or design decision?'
        : nextSectionKey === 'reflection_close'
          ? 'Before we close, what would you improve about one of your past answers or examples if you could answer again?'
          : `Let us move to ${nextSectionKey}. Can you share one concrete example from that area?`,
  reason: 'The current section is sufficiently covered, so the interviewer is moving to the next planned section.',
  sourceType: 'controller_directed',
});

export const buildForceShiftProjectQuestion = ({ targetTopic = 'experience', forbiddenProject = '' } = {}) => ({
  type: 'force_shift_project_follow_up',
  stage: 'experience_breadth',
  topic: targetTopic,
  category: 'experience',
  followUpDepth: 1,
  text: `I've heard a good deal about your work on "${forbiddenProject}". To help me see the full breadth of your experience, could you share a different example from your CV for ${targetTopic}?`,
  reason: `The candidate has overused the "${forbiddenProject}" example, so the interviewer is forcing a context switch to ensure CV coverage.`,
  sourceType: 'controller_directed',
});

export const buildProbeStressQuestion = ({ targetTopic = 'technical_depth' } = {}) => ({
  type: 'probe_stress_follow_up',
  stage: 'technical_stress',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: `That solution works well in a standard scenario. But what if you faced a major constraint—like 10x the traffic or a 50% cut in timeline? How would your approach for ${targetTopic} change?`,
  reason: 'The candidate provided a stable answer, so the interviewer is applying a stress constraint to test boundaries.',
  sourceType: 'controller_directed',
});

export const buildProbeFrictionQuestion = ({ targetTopic = 'ownership' } = {}) => ({
  type: 'probe_friction_follow_up',
  stage: 'friction_analysis',
  topic: targetTopic,
  category: 'behavioural',
  followUpDepth: 2,
  text: `Every successful project has its friction points. In that example for ${targetTopic}, what was the hardest trade-off you had to make, or a time when a stakeholder strongly disagreed with your direction?`,
  reason: 'The candidate gave a "happy path" answer, so the interviewer is probing for real-world friction and conflict resolution.',
  sourceType: 'controller_directed',
});

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
