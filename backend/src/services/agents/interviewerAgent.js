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
import { callDeepSeek, callDeepSeekStream } from '../deepseekService.js';
import { guardGeneratedTextForInterviewMode, guardQuestionForInterviewMode } from '../aiControl/interviewModeGuard.js';
import { buildQuestionDecisionTrace } from '../aiControl/questionRanker.js';
import { getPreparedQuestionPool } from '../questions/questionPoolComposerService.js';
import {
  buildAbductiveProbeQuestion,
  buildClosingQuestion,
  buildDeepDiveQuestion,
  buildForceShiftProjectQuestion,
  buildProbeFrictionQuestion,
  buildProbeStressQuestion,
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
  isDuplicateRootQuestion,
  normalizeQuestionIntent,
  pickRetrievedQuestion,
} from './interviewerAgentQuestionBuilder.js';

const selectPreparedPoolQuestion = async ({
  session = {},
  actionType = '',
  targetTopic = '',
  probeType = '',
  freshOnly = false,
  category = null,
  focusArea = 'combined',
} = {}) => {
  if (!session?.id) return null;

  const normalizeValue = (value = '') => String(value || '').trim().toLowerCase();
  const normalizeMode = (value = 'combined') => {
    const normalized = normalizeValue(value);
    if (normalized === 'technical') return 'technical';
    if (['behavioral', 'behavioural'].includes(normalized)) return 'behavioural';
    return 'combined';
  };

  const mode = normalizeMode(focusArea);

  try {
    let pool = await getPreparedQuestionPool({ sessionId: session.id, category });
    if ((!Array.isArray(pool) || pool.length === 0) && category) {
      pool = await getPreparedQuestionPool({ sessionId: session.id });
    }

    const items = Array.isArray(pool) ? pool : [];
    if (!items.length) return null;

    const askedIds = new Set(
      (session.askedPreparedQuestionIds || session.preparedQuestionHistory || [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );

    const target = normalizeValue(targetTopic || probeType || '');
    const selected = items
      .filter((item) => item && item.status !== 'inactive')
      .filter((item) => !freshOnly || !item.questionId || !askedIds.has(String(item.questionId)))
      .filter((item) => {
        const compatibility = item.modeCompatibility || {};
        if (mode === 'technical') return compatibility.technical !== false;
        if (mode === 'behavioural') return compatibility.behavioural !== false && compatibility.behavioral !== false;
        return compatibility.combined !== false;
      })
      .sort((a, b) => {
        const score = (item) => {
          const topic = normalizeValue(item.topic);
          const stage = normalizeValue(item.stage);
          const sourceStage = normalizeValue(item.sourceStage);
          const questionIntent = normalizeValue(item.questionIntent);
          let value = 0;
          value += Number(item.priorityWeight || 0) * 100;
          value += Number(item.coverageWeight || 0) * 30;
          value += Number(item.riskWeight || 0) * 20;
          if (target && (topic.includes(target) || target.includes(topic))) value += 50;
          if (normalizeValue(category) && normalizeValue(item.category) === normalizeValue(category)) value += 25;
          if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION && /validation|gap|requirement|risk/.test(`${stage} ${sourceStage} ${questionIntent}`)) value += 25;
          return value;
        };
        return score(b) - score(a);
      })[0];

    if (!selected) return null;

    const text = selected.spokenDraft || selected.fallbackText || selected.text || selected.draftQuestion || '';
    if (!text) return null;

    return {
      type: selected.questionIntent || selected.type || selected.stage || 'prepared_pool_question',
      stage: selected.stage || selected.category || 'prepared_pool',
      topic: selected.topic || selected.competency || targetTopic || 'role_fit',
      category: selected.category || category || 'experience',
      followUpDepth: Number(selected.followUpDepth || 0),
      text,
      fallbackText: selected.fallbackText || text,
      reason: selected.reason || `Selected from prepared interview question pool (${selected.sourceStage || selected.sourceType || 'prepared'}).`,
      sourceType: selected.sourceType || selected.sourceStage || 'prepared_question_pool',
      sourceId: selected.questionId || selected.sourceSeedId || null,
      preparedQuestionId: selected.questionId || null,
      evidenceNeed: Array.isArray(selected.evidenceNeed) ? selected.evidenceNeed : undefined,
      constraints: Array.isArray(selected.constraints) ? selected.constraints : undefined,
      rankTrace: {
        questionId: selected.questionId || null,
        selectionSource: 'prepared_question_pool',
        sourceStage: selected.sourceStage || null,
        sourceType: selected.sourceType || null,
        topic: selected.topic || null,
        category: selected.category || null,
        priorityWeight: selected.priorityWeight ?? null,
        coverageWeight: selected.coverageWeight ?? null,
        riskWeight: selected.riskWeight ?? null,
        actionType,
        targetTopic,
        focusArea: mode,
      },
    };
  } catch {
    return null;
  }
};

const generateConversationalTurn = async ({ baseQuestion, actionType, lastUserAnswer, decisionContext, retrievalBundle, focusArea = 'combined', onSentence }) => {
  const environment = decisionContext?.environment || {};
  const nzCoachingDirective = environment.nzCultureContext?.enabled ? `\n\n${environment.nzCultureContext.coachingDirective}` : '';
  const systemInstruction = `ROLE:
You are a professional, adaptive interviewer conducting a live voice interview.
When the selected mode is technical, behave like a sharp Tech Lead.
When the selected mode is behavioral, behave like a structured but natural hiring interviewer.

TASK:
Output the exact next words you will say to the candidate.
Ask one useful follow-up question.
Usually ask directly.
Base the question on the candidate's latest answer and the missing evidence.
Probe the strongest unfinished point: ownership, decision, trade-off, validation, result, or reflection.

CONTEXT:
This is a real-time voice interview.
The response will be spoken by TTS immediately.
Latency and natural speech matter.
The candidate's transcript may contain ASR errors.
Use technical projects as technical evidence only in technical mode.
Use technical projects as behavioural context only in behavioral mode.

EXAMPLES:
Good:
- "What part did you personally own?"
- "How did you test the agent's recommendations?"
- "What was the hardest decision you made there?"
- "What changed after your action?"

Bad:
- "That's a great example."
- "Shifting gears, let us move on."
- "Tell me about a time when you had to show Communication."
- "You mentioned testing with the AI agent and user behavior. Can you walk me through..."

OUTPUT_FORMAT:
Output only the spoken interviewer text.
Do not output JSON, XML, markdown, bullet points, labels, headings, or internal reasoning.
Ask exactly one main question.

CONSTRAINTS:
- Current selected mode: ${focusArea}.
- Prefer 8 to 18 words for normal follow-ups.
- Add a short bridge only when the candidate needs context.
- Avoid multi-part questions.
- Avoid repeating the candidate's answer unless clarification is needed.
- Do not over-praise or judge the candidate's expertise.
- Never expose internal variables such as targetTopic, decision_tradeoff, role_fit, questionGoal, evidenceNeed, or constraints.
- Never say rubric labels directly, such as Communication, Leadership, Teamwork, role_fit, or decision_tradeoff.
- If the answer is unclear or ASR may be noisy, ask a short clarification question.
- If the mode is technical, ask about concrete technical evidence: implementation, design choice, debugging, trade-off, validation, performance, data, architecture, or tooling.
- If the mode is behavioral, ask about real workplace behaviour: situation, personal action, communication, conflict, pressure, collaboration, result, or reflection.
- In behavioral mode, do not ask for libraries, code, algorithms, database schema, SQL queries, model metrics, training pipelines, scalability, latency, or implementation details.
- In technical mode, do not turn the question into a pure STAR behavioural story unless technical ownership is unclear.${nzCoachingDirective}`;

  const retrievedTexts = (retrievalBundle?.items || [])
    .map(i => i.text || i.metadata?.question || i.metadata?.skillTags?.join(', '))
    .filter(Boolean)
    .slice(0, 3)
    .join('\n- ');
  
  const reflections = decisionContext?.sessionReflectionMemory || [];
  const reflectionText = reflections.length > 0 
    ? `\nPerformance Reflections to obey:\n${reflections.slice(-2).map(r => r.lesson || r.summary).join('\n')}` 
    : '';
  const answerUnderstanding = environment?.latestAnswerUnderstanding || decisionContext?.latestAnswerUnderstanding || decisionContext?.evaluatorState?.fastAnswerUnderstanding || null;
  const answerUnderstandingText = answerUnderstanding
    ? `\nFast Answer Understanding:
- Intent: ${answerUnderstanding.intent || 'unknown'}
- Key facts to preserve: ${(answerUnderstanding.keyFacts || []).slice(0, 5).join('; ') || 'none'}
- Technologies/entities mentioned: ${(answerUnderstanding.technologies || answerUnderstanding.mentionedEntities || []).slice(0, 6).join(', ') || 'none'}
- Missing evidence to probe: ${(answerUnderstanding.missingEvidence || []).slice(0, 4).join(', ') || 'none'}
- Suggested follow-up goal: ${answerUnderstanding.suggestedFollowUp?.questionGoal || 'stay grounded in the latest answer'}
Use these facts to avoid a generic next question. Do not mention this analysis to the candidate.`
    : '';

  const prompt = `Here is the interview context:
Candidate's last answer:
"${lastUserAnswer || '(Interview is just starting)'}"

Strategic Intent of your next turn: [${actionType}]
Target Topic: "${baseQuestion.topic}"
Question Goal: "${baseQuestion.questionGoal || 'collect_specific_example_with_action_and_result'}"
Evidence Needs: ${(baseQuestion.evidenceNeed || []).join(', ') || 'specific_example, personal_action, result_or_impact'}
Constraints: ${(baseQuestion.constraints || []).join(', ') || 'ask_one_question_only'}
Question Seed: "${baseQuestion.fallbackText || baseQuestion.text}"
${reflectionText}
${answerUnderstandingText}
${retrievedTexts ? `\nReference Context from Knowledge Base:\n- ${retrievedTexts}` : ''}

INSTRUCTIONS FOR [${actionType}]:
${actionType === 'FORCE_SHIFT_PROJECT' ? "- ACKNOWLEDGE their previous project/experience in at most 6 words if needed.\n- Ask for a DIFFERENT example from their CV.\n- Be professional and firm about the shift." : ""}
${actionType === 'PROBE_STRESS' ? "- Apply one clear constraint, such as scale, time, budget, or resource failure.\n- Ask how their strategy would adapt." : ""}
${actionType === 'PROBE_FRICTION' ? "- Ask about one hidden difficulty, trade-off, disagreement, or failed moment.\n- Focus on their decision-making under pressure or conflict." : ""}
${actionType === 'REPHRASE_QUESTION' ? "- Admit the previous question may have been unclear.\n- Ask for one real example with role, action, and outcome." : ""}
- For all other types: Ask one useful interviewer follow-up from the Question Goal, Evidence Needs, and Constraints.

GENERAL GUIDELINES:

Role:
- You are a professional Tech Lead interviewer speaking directly to the candidate in a live voice interview.
- You are empathetic, restrained, and focused on collecting useful interview evidence.

Task:
- Generate the exact next spoken interviewer turn.
- Usually ask the question directly.
- Add a short bridge only when the candidate needs context.
- Use the Question Goal, Evidence Needs, Constraints, Question Seed, Fast Answer Understanding, and Reference Context to guide the question.
- Do not copy the Question Seed unless it is already the best short spoken question.

Context:
- This is a real-time voice interview, so latency and natural speech matter.
- The response will be spoken by TTS immediately.
- The goal is to keep the interview moving while collecting stronger evidence about skills, decisions, ownership, trade-offs, and results.
- You are not rewriting a fixed template. Generate a natural interviewer question from the provided interview context.

Examples:
- Prefer: "How did you decide the database split?"
- Prefer: "What part did you personally own?"
- Prefer: "How did you test the agent's recommendations?"
- Avoid: "You mentioned testing with the AI agent and user behavior. Can you walk me through..."
- Avoid: "Tell me about a time when you had to show Communication."

Output format:
- Output only the spoken interviewer text.
- Do not output JSON, markdown, bullet points, labels, headings, or internal reasoning.
- Ask exactly one main follow-up question.

Constraints:
- Prefer 8 to 18 words for normal follow-ups.
- Rephrase, opening, and closing questions may be slightly longer when needed.
- Do not explain the user's answer before asking.
- Do not include long praise.
- Use short spoken English.
- Keep the tone conversational and professional.
- Avoid sounding like a robot reading a template.
- If the answer is unclear, ask a clarification question.
- NEVER leak internal engineering variables such as targetTopic, decision_tradeoff, role_fit, questionGoal, evidenceNeed, or constraints.
- NEVER say rubric labels directly, such as Communication, Leadership, Teamwork, role_fit, or decision_tradeoff.
- Phrase internal context naturally for the candidate.

Generate your verbal response now:`;

  if (!onSentence) {
    const result = await callDeepSeek(prompt, systemInstruction, {
      usageMetadata: { stage: 'interview', operation: 'llm_chat', feature: 'interviewer_response' },
    });
    return result.content;
  }


  const stream = callDeepSeekStream(prompt, systemInstruction, {
    usageMetadata: { stage: 'interview', operation: 'llm_chat', feature: 'interviewer_stream_response' },
  });
  let fullText = '';
  let currentSentence = '';
  let sentenceIndex = 0;

  for await (const chunk of stream) {
    fullText += chunk;
    currentSentence += chunk;
    
    if (/[.!?。！？]\s+$/.test(currentSentence) || (currentSentence.length > 50 && /[,，]\s+$/.test(currentSentence))) {
      await onSentence(currentSentence.trim(), sentenceIndex++);
      currentSentence = '';
    }
  }

  if (currentSentence.trim()) {
    await onSentence(currentSentence.trim(), sentenceIndex);
  }

  return fullText;
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
  let selectedQuestion = await selectPreparedPoolQuestion({
    session,
    decisionContext,
    evaluatorState,
    actionType,
    targetTopic,
    probeType,
    freshOnly,
    category: lockedCategory,
    focusArea,
  });
  if (!selectedQuestion) {
    selectedQuestion = getNextPoolQuestion(session, { freshOnly, category: lockedCategory });
  }

  if (actionType === AGENT_ACTION_TYPES.ASK_PROBING_QUESTION) {
    selectedQuestion = buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || evidenceBundle?.validationTargets?.[0] || 'project' });
  } else if (actionType === AGENT_ACTION_TYPES.REPHRASE_QUESTION) {
    selectedQuestion = buildRephrasedQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project', environment });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION) {
    selectedQuestion = focusArea === 'behavioral'
      ? buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'behavioural_example' })
      : buildDeepDiveQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'project' });
  } else if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION) {
    if (!selectedQuestion?.preparedQuestionId) {
      selectedQuestion = focusArea === 'behavioral'
        ? buildProbingQuestion({ targetTopic: targetTopic || decisionContext?.currentTopic || 'behavioural_example' })
        : buildValidationQuestion({ targetTopic: targetTopic || decisionContext?.matchState?.validationTargets?.[0] || 'claim' });
    }
  } else if (actionType === AGENT_ACTION_TYPES.SWITCH_TOPIC) {
    if (!selectedQuestion?.preparedQuestionId) {
      selectedQuestion = probeType === 'repetition_repair_switch'
        ? buildRepetitionRepairSwitchQuestion({ targetTopic: targetTopic || decisionContext?.coverageState?.missingTopics?.[0] || 'role_fit' })
        : buildSwitchTopicQuestion({ targetTopic: targetTopic || decisionContext?.coverageState?.missingTopics?.[0] || 'role_fit' });
    }
  } else if (actionType === AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION) {
    selectedQuestion = buildAbductiveProbeQuestion({ targetTopic: targetTopic || decisionContext?.abductiveState?.probeTopic || 'decision_tradeoff', hiddenGap: decisionContext?.abductiveState?.hiddenGap || '' });
  } else if (actionType === AGENT_ACTION_TYPES.SHIFT_SECTION) {
    if (!selectedQuestion?.preparedQuestionId) {
      if ((category || decisionContext?.interviewStructure?.forceCategory) === 'technical' || probeType === 'technical_recovery' || targetTopic === 'technical') {
        selectedQuestion = getNextPoolQuestion(session, { freshOnly: true, category: 'technical' }) || buildTechnicalRecoveryQuestion({ targetTopic: decisionContext?.matchState?.validationTargets?.[0] || 'implementation', session, decisionContext });
      } else {
        selectedQuestion = buildSectionShiftQuestion({ nextSectionKey: targetTopic || decisionContext?.sectionState?.nextSectionKey || 'motivation' });
      }
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
    if (!selectedQuestion?.preparedQuestionId) {
      selectedQuestion = buildClosingQuestion({ session, decisionContext });
    }
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

  const reactTrace = buildReactTrace({ selectedAction: actionType, decisionContext, selectedQuestion, environment, evaluatorState });
  
  let generatedText = selectedQuestion.fallbackText || selectedQuestion.text;
  try {
    generatedText = await generateConversationalTurn({ 
      baseQuestion: selectedQuestion, 
      actionType, 
      lastUserAnswer: environment?.latestAnswer?.text || lastUserAnswer, 
      decisionContext, 
      retrievalBundle,
      focusArea,
      onSentence,
    });
  } catch (error) {
    console.warn('Failed to generate conversational turn via LLM, falling back to base template', error);
  }

  generatedText = guardGeneratedTextForInterviewMode({
    focusArea,
    generatedText,
    fallbackText: selectedQuestion.fallbackText || selectedQuestion.text,
    selectedQuestion,
  });

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
    preparedQuestionId: selectedQuestion.preparedQuestionId || null,
    rankTrace: selectedQuestion.rankTrace || null,
    retrievalSnapshot: retrievalBundle,
    isComplete: false,
    reactTrace,
  };
};
