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
import { getNextPoolQuestion, hasReachedQuestionLimit } from '../interviewStateService.js';
import { callDeepSeek } from '../deepseekService.js';
const normalizeText = (value = '') => String(value || '').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const getLastUserAnswer = (transcript = []) => [...transcript].reverse().find((turn) => turn.role === 'user')?.text || '';

const buildRoleLockedQuestion = (retrievedItem, fallback = {}) => ({
  type: fallback.type || fallback.stage || 'technical_core',
  stage: fallback.stage || 'technical_core',
  topic: fallback.topic || retrievedItem.metadata?.skillTags?.[0] || retrievedItem.metadata?.category || 'role_fit',
  followUpDepth: fallback.followUpDepth || 0,
  text: retrievedItem.metadata?.question || retrievedItem.text,
  reason: `Retrieved from role-matched question bank (${retrievedItem.metadata?.roleCanonical || retrievedItem.metadata?.roleFamily || 'general'}).`,
  sourceType: retrievedItem.sourceType,
  sourceId: retrievedItem.sourceId,
});

const pickRetrievedQuestion = (retrievalBundle, selectedQuestion, targetTopic = '') => {
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


const normalizeKey = (value = '') => String(value || '').trim().toLowerCase();

const buildQuestionRootKey = (question = {}) => {
  const topic = normalizeKey(question.topic || '');
  const category = normalizeKey(question.category || (String(question.stage || '').includes('behaviour') ? 'behavioural' : String(question.stage || '').includes('technical') ? 'technical' : 'experience'));
  const type = normalizeKey(question.type || '');
  return [topic || 'topic', category || 'category', type || 'type'].join(':');
};

const isDuplicateRootQuestion = (question = null, decisionContext = {}) => {
  if (!question || Number(question.followUpDepth || 0) > 0) return false;
  const rootKey = buildQuestionRootKey(question);
  return (decisionContext?.interviewStructure?.askedRootQuestionKeys || []).some((item) => normalizeKey(item) === rootKey);
};

const pickPriorityTechnicalTopic = ({ session = {}, decisionContext = {}, targetTopic = '' } = {}) => {
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

const buildMatchedTechnicalQuestion = ({ topic = 'implementation' } = {}) => {
  const normalizedTopic = normalizeText(topic) || 'implementation';
  const lower = normalizedTopic.toLowerCase();
  const skillAwareText = lower.includes('react')
    ? `Let us move to the technical side. Tell me about one React feature or frontend flow you implemented yourself. What decisions did you make, and how did you know it worked?`
    : lower.includes('postgres') || lower.includes('sql') || lower.includes('database')
      ? `Let us move to the technical side. Tell me about one database or SQL task you handled yourself. What query, schema, or trade-off did you work through, and what result came from it?`
      : lower.includes('aws') || lower.includes('cloud') || lower.includes('deploy')
        ? `Let us move to the technical side. Tell me about one cloud or deployment task you handled yourself using ${normalizedTopic}. What part did you own, and what did you have to troubleshoot?`
        : lower.includes('debug') || lower.includes('troubleshoot')
          ? `Let us move to the technical side. Tell me about one debugging or troubleshooting example from your work. What was the issue, what did you check first, and how did you fix it?`
          : lower.includes('automation')
            ? `Let us move to the technical side. Tell me about one automation task you built or improved. What did you implement yourself, and how did it change the workflow?`
            : `Let us move to the technical side. Tell me about one concrete example where you used ${normalizedTopic}. What did you implement yourself, what trade-off did you handle, and what was the result?`;

  return {
    type: 'technical_recovery_follow_up',
    stage: 'technical',
    topic: normalizedTopic,
    category: 'technical',
    followUpDepth: 0,
    text: skillAwareText,
    reason: `The interview still needs grounded technical evidence, so the controller is using a role-matched technical topic (${normalizedTopic}).`,
    sourceType: 'controller_directed',
  };
};

const buildClosingQuestion = ({ session = {}, decisionContext = {} } = {}) => {
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
      text: `Before we wrap up, I want one final technical example. Thinking about ${topic}, what did you own yourself, what was the hardest part, and what result came from it?`,
      reason: 'The session is at its final planned turn, so the interviewer is using a clear closing question that still checks concrete technical ownership.',
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

const buildTechnicalRecoveryQuestion = ({ targetTopic = 'implementation', session = {}, decisionContext = {} } = {}) => {
  const selectedTopic = pickPriorityTechnicalTopic({ session, decisionContext, targetTopic });
  return buildMatchedTechnicalQuestion({ topic: selectedTopic });
};

const inferEvidenceTypeHint = (question = {}) => {
  const stage = String(question.stage || question.type || '').toLowerCase();
  if (stage.includes('technical')) return 'direct_past_experience';
  if (stage.includes('experience')) return 'direct_past_experience';
  if (stage.includes('behavioural')) return 'direct_past_experience';
  if (stage.includes('wrap')) return 'candidate_questions';
  return 'adjacent_experience';
};

const buildProbingQuestion = ({ targetTopic = 'project' } = {}) => ({
  type: 'probing_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 1,
  text: `Can you walk me through one concrete ${targetTopic} example, what you personally did, and what result it led to?`,
  reason: 'A probing question is needed to collect one concrete example before moving on.',
  sourceType: 'controller_directed',
});

const buildRephrasedQuestion = ({ targetTopic = 'project', environment = {} } = {}) => ({
  type: 'rephrased_follow_up',
  stage: environment?.questionContext?.latestQuestionStage || 'clarification',
  topic: targetTopic,
  category: String(environment?.questionContext?.latestQuestionStage || '').includes('behaviour') ? 'behavioural' : 'technical',
  followUpDepth: 1,
  text: `Let me rephrase that more clearly. For ${targetTopic}, please pick one real example and tell me your role, what you did, and the outcome.`,
  reason: 'The evaluator detected likely misunderstanding, so the interviewer should restate the question with a tighter structure.',
  sourceType: 'controller_directed',
});

const buildDeepDiveQuestion = ({ targetTopic = 'project' } = {}) => ({
  type: 'deep_dive_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: `Staying with ${targetTopic}, what trade-off, difficulty, or decision did you handle yourself, and how did you judge whether it worked?`,
  reason: 'The latest answer was usable but still partial, so a deeper question should capture decision quality and ownership.',
  sourceType: 'controller_directed',
});

const buildValidationQuestion = ({ targetTopic = 'claim' } = {}) => ({
  type: 'validation_follow_up',
  stage: 'technical_validation',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 1,
  text: `You mentioned ${targetTopic}. What exactly did you own, and how did you know it worked well in practice?`,
  reason: 'This question validates a claim that still needs direct supporting evidence.',
  sourceType: 'controller_directed',
});

const buildSwitchTopicQuestion = ({ targetTopic = 'role_fit' } = {}) => ({
  type: 'coverage_follow_up',
  stage: 'coverage',
  topic: targetTopic,
  category: 'experience',
  followUpDepth: 0,
  text: `I would like to move to ${targetTopic}. Can you share one example that shows your experience in that area?`,
  reason: 'The controller switched topic because an important requirement has not been covered yet.',
  sourceType: 'controller_directed',
});

const buildAbductiveProbeQuestion = ({ targetTopic = 'decision_tradeoff', hiddenGap = '' } = {}) => ({
  type: 'abductive_probe_follow_up',
  stage: 'technical_probe',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: `You hinted at ${hiddenGap || targetTopic}. What was the hardest trade-off or gap there, and how did you handle it in practice?`,
  reason: 'The controller inferred a hidden gap that should be tested before moving on.',
  sourceType: 'controller_directed',
});

const buildSectionShiftQuestion = ({ nextSectionKey = 'motivation' } = {}) => ({
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

const buildForceShiftProjectQuestion = ({ targetTopic = 'experience', forbiddenProject = '' } = {}) => ({
  type: 'force_shift_project_follow_up',
  stage: 'experience_breadth',
  topic: targetTopic,
  category: 'experience',
  followUpDepth: 1,
  text: `I've heard a good deal about your work on "${forbiddenProject}". To help me see the full breadth of your experience, could you share a different example from your CV for ${targetTopic}?`,
  reason: `The candidate has overused the "${forbiddenProject}" example, so the interviewer is forcing a context switch to ensure CV coverage.`,
  sourceType: 'controller_directed',
});

const buildProbeStressQuestion = ({ targetTopic = 'technical_depth' } = {}) => ({
  type: 'probe_stress_follow_up',
  stage: 'technical_stress',
  topic: targetTopic,
  category: 'technical',
  followUpDepth: 2,
  text: `That solution works well in a standard scenario. But what if you faced a major constraint—like 10x the traffic or a 50% cut in timeline? How would your approach for ${targetTopic} change?`,
  reason: 'The candidate provided a stable answer, so the interviewer is applying a stress constraint to test boundaries.',
  sourceType: 'controller_directed',
});

const buildProbeFrictionQuestion = ({ targetTopic = 'ownership' } = {}) => ({
  type: 'probe_friction_follow_up',
  stage: 'friction_analysis',
  topic: targetTopic,
  category: 'behavioural',
  followUpDepth: 2,
  text: `Every successful project has its friction points. In that example for ${targetTopic}, what was the hardest trade-off you had to make, or a time when a stakeholder strongly disagreed with your direction?`,
  reason: 'The candidate gave a "happy path" answer, so the interviewer is probing for real-world friction and conflict resolution.',
  sourceType: 'controller_directed',
});

const buildReactTrace = ({ selectedAction, decisionContext, selectedQuestion, environment, evaluatorState }) => {
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

const generateConversationalTurn = async ({ baseQuestion, actionType, lastUserAnswer, decisionContext, retrievalBundle }) => {
  const systemInstruction = `You are a professional, empathetic, and highly restrained Tech Lead conducting an interview.
Your goal is to output the EXACT words you will say next to the candidate.
DO NOT output any internal tags, XML, or json. Output ONLY the conversational text.

NEGATIVE_CONSTRAINTS:
- NEVER use generic robotic compliments like: "That's a [great/solid/impressive/smart/good] [example/approach/outcome/way/start]".
- NEVER use mechanical transitions like: "Shifting gears a bit", "Now, I'd like to shift gears", or "Moving on to...".
- NEVER make qualitative judgments or definitive conclusions about the candidate's expertise during the interview (e.g., Ban phrases like "It sounds like you have a lot of experience in..." or "Clearly you are an expert at...").

DIRECTIVE:
- Acknowledge the factual substance of the candidate's last answer naturally, briefly, and neutrally.
- Example: If they mentioned a performance win, you might say "Designing for a 40% throughput increase is a significant constraint" instead of "That's an impressive result".
- Stay professional, sharp, and focused on gathering depth without over-praising or using cliches.`;

  const retrievedTexts = (retrievalBundle?.items || [])
    .map(i => i.text || i.metadata?.question || i.metadata?.skillTags?.join(', '))
    .filter(Boolean)
    .slice(0, 3)
    .join('\n- ');
  
  const reflections = decisionContext?.sessionReflectionMemory || [];
  const reflectionText = reflections.length > 0 
    ? `\nPerformance Reflections to obey:\n${reflections.slice(-2).map(r => r.lesson || r.summary).join('\n')}` 
    : '';

  const prompt = `Here is the interview context:
Candidate's last answer:
"${lastUserAnswer || '(Interview is just starting)'}"

Strategic Intent of your next turn: [${actionType}]
Target Topic: "${baseQuestion.topic}"
Base Goal: "${baseQuestion.text}"
${reflectionText}
${retrievedTexts ? `\nReference Context from Knowledge Base:\n- ${retrievedTexts}` : ''}

INSTRUCTIONS FOR [${actionType}]:
${actionType === 'FORCE_SHIFT_PROJECT' ? "- ACKNOWLEDGE their previous project/experience briefly.\n- STATE that you want to see their breadth and explicitly ask for a DIFFERENT example from their CV.\n- Be professional and encouraging but firm about the shift." : ""}
${actionType === 'PROBE_STRESS' ? "- COMPLIMENT their current solution/answer briefly.\n- APPLY a 'What if' constraint (e.g. scale, time, budget, resource failure).\n- ASK how their strategy would adapt to this friction." : ""}
${actionType === 'PROBE_FRICTION' ? "- ACKNOWLEDGE the success of their example.\n- ASK about the 'hidden' difficulty: a trade-off, a disagreement, or a moment where things didn't go as planned.\n- Focus on their decision-making under pressure or conflict." : ""}
${actionType === 'REPHRASE_QUESTION' ? "- Admit the previous question might have been unclear.\n- Break down the requirement into simpler parts." : ""}
- For all other types: Briefly acknowledge the candidate's last answer naturally, then advance to the "Base Goal".

GENERAL GUIDELINES:
1. Advance the interview based on the "Base Goal".
2. Use the "Reference Context" for inspiration to make your response professional and deep.
3. Keep the tone conversational, avoid sounding like a robot reading a template.
4. NEVER leak internal engineering variables (e.g. 'targetTopic', 'decision_tradeoff', 'role_fit') to the user. Phrase it naturally.

Generate your verbal response now:`;

  return await callDeepSeek(prompt, systemInstruction);
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
} = {}) => {
  const transcript = session?.transcript || [];
  const lastUserAnswer = getLastUserAnswer(transcript).toLowerCase();
  const environment = decisionContext?.environment || null;
  const evaluatorState = decisionContext?.evaluatorState || null;
  const focusArea = String(decisionContext?.interviewStructure?.focusAreaKey || session?.settings?.focusArea || 'combined').trim().toLowerCase().replace('behavioural', 'behavioral');

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
  let selectedQuestion = getNextPoolQuestion(session, { freshOnly, category: lockedCategory });

  if (actionType === AGENT_ACTION_TYPES.ASK_PROBING_QUESTION) {
    selectedQuestion = buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || evidenceBundle?.validationTargets?.[0] || 'project' });
  } else if (actionType === AGENT_ACTION_TYPES.REPHRASE_QUESTION) {
    selectedQuestion = buildRephrasedQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project', environment });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION) {
    selectedQuestion = focusArea === 'behavioral'
      ? buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'behavioural_example' })
      : buildDeepDiveQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project' });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION) {
    selectedQuestion = focusArea === 'behavioral'
      ? buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'behavioural_example' })
      : buildValidationQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'claim' });
  } else if (actionType === AGENT_ACTION_TYPES.SWITCH_TOPIC) {
    selectedQuestion = buildSwitchTopicQuestion({ targetTopic: targetTopic || decisionContext?.coverageState?.missingTopics?.[0] || 'role_fit' });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION) {
    selectedQuestion = buildAbductiveProbeQuestion({ targetTopic: targetTopic || decisionContext?.abductiveState?.probeTopic || 'decision_tradeoff', hiddenGap: decisionContext?.abductiveState?.hiddenGap || '' });
  } else if (actionType === AGENT_ACTION_TYPES.SHIFT_SECTION) {
    if ((category || decisionContext?.interviewStructure?.forceCategory) === 'technical' || probeType === 'technical_recovery' || targetTopic === 'technical') {
      selectedQuestion = getNextPoolQuestion(session, { freshOnly: true, category: 'technical' }) || buildTechnicalRecoveryQuestion({ targetTopic: decisionContext?.matchState?.validationTargets?.[0] || 'implementation', session, decisionContext });
    } else {
      selectedQuestion = buildSectionShiftQuestion({ nextSectionKey: targetTopic || decisionContext?.sectionState?.nextSectionKey || 'motivation' });
    }
  } else if (actionType === AGENT_ACTION_TYPES.FORCE_SHIFT_PROJECT) {
    selectedQuestion = buildForceShiftProjectQuestion({ targetTopic: targetTopic || 'experience', forbiddenProject: decisionContext?.latestDecision?.actionInput?.forbiddenProject || 'the previous project' });
  } else if (actionType === AGENT_ACTION_TYPES.PROBE_STRESS) {
    selectedQuestion = buildProbeStressQuestion({ targetTopic: targetTopic || 'technical_depth' });
  } else if (actionType === AGENT_ACTION_TYPES.PROBE_FRICTION) {
    selectedQuestion = buildProbeFrictionQuestion({ targetTopic: targetTopic || 'ownership' });
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
    selectedQuestion = buildClosingQuestion({ session, decisionContext });
  } else {
    const retrievedQuestion = pickRetrievedQuestion(retrievalBundle, selectedQuestion, targetTopic || decisionContext?.currentTopic || '');
    if (selectedQuestion && retrievedQuestion && !['opening', 'wrap_up'].includes(selectedQuestion.stage) && actionType !== AGENT_ACTION_TYPES.ASK_POOL_QUESTION) {
      selectedQuestion = buildRoleLockedQuestion(retrievedQuestion, selectedQuestion);
    }
  }

  if (isDuplicateRootQuestion(selectedQuestion, decisionContext)) {
    selectedQuestion = null;
  }

  if (focusArea === 'technical' && selectedQuestion && selectedQuestion.category === 'behavioural') {
    selectedQuestion = getNextPoolQuestion(session, { freshOnly: true, category: 'technical' });
  }
  if (focusArea === 'behavioral' && selectedQuestion && selectedQuestion.category === 'technical') {
    selectedQuestion = getNextPoolQuestion(session, { freshOnly: true, category: 'behavioural' });
  }

  if (!selectedQuestion && (lockedCategory === 'technical' || category === 'technical' || decisionContext?.interviewStructure?.forceCategory === 'technical')) {
    selectedQuestion = buildTechnicalRecoveryQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'implementation', session, decisionContext });
  }

  if (!selectedQuestion) {
    selectedQuestion = {
      type: 'behavioural_follow_up',
      stage: 'behavioural',
      topic: lastUserAnswer.includes('team') ? 'teamwork' : probeType || 'problem_solving',
      followUpDepth: 1,
      text: lastUserAnswer.includes('team')
        ? 'What was your exact role in that team effort, and what result came from it?'
        : 'Can you give me one specific example that shows how you handled that in practice?',
      reason: 'Fallback follow-up when the structured role-linked pool is unavailable.',
      sourceType: 'fallback',
    };
  }

  const reactTrace = buildReactTrace({ selectedAction: actionType, decisionContext, selectedQuestion, environment, evaluatorState });
  
  let generatedText = selectedQuestion.text;
  try {
    generatedText = await generateConversationalTurn({ 
      baseQuestion: selectedQuestion, 
      actionType, 
      lastUserAnswer: environment?.latestAnswer?.text || lastUserAnswer, 
      decisionContext, 
      retrievalBundle 
    });
  } catch (error) {
    console.warn('Failed to generate conversational turn via LLM, falling back to base template', error);
  }

  const displayTurn = {
    feedbackMode: 'conversational_llm',
    preamble: '',
    question: selectedQuestion.text,
    displayText: generatedText,
  };

  return {
    questionType: selectedQuestion.type,
    nextQuestion: selectedQuestion.text,
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
    retrievalSnapshot: retrievalBundle,
    isComplete: false,
    reactTrace,
  };
};
