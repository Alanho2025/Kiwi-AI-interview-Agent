import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import {
  generatedTextLooksTechnical,
  guardGeneratedTextForInterviewMode,
  guardQuestionForInterviewMode,
  questionLooksTechnical,
} from '../../../src/services/aiControl/interviewModeGuard.js';

describe('interview mode guard robustness', () => {
  it('detects technical probes that should not appear in behavioural mode', () => {
    expect(questionLooksTechnical({
      category: 'technical',
      stage: 'technical_probe',
      text: 'Walk me through the Python libraries you chose and how you structured the training and testing pipeline.',
    })).toBe(true);
  });

  it('rewrites technical questions into behavioural STAR-style follow-ups when behavioural mode is selected', () => {
    const guarded = guardQuestionForInterviewMode({
      focusArea: 'behavioral',
      actionType: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      targetTopic: 'python machine learning pipeline',
      latestAnswer: 'I used Python for data cleaning and a machine learning model in my dashboard project.',
      selectedQuestion: {
        type: 'validation_follow_up',
        stage: 'technical_validation',
        category: 'technical',
        topic: 'python machine learning pipeline',
        text: 'Walk me through the Python libraries you chose and how you structured the training and testing pipeline.',
      },
    });

    expect(guarded.category).toBe('behavioural');
    expect(guarded.sourceType).toBe('mode_guard');
    expect(guarded.text).toMatch(/challenge|action|result/i);
    expect(generatedTextLooksTechnical(guarded.text)).toBe(false);
  });

  it('replaces LLM wording if the generated conversational text leaks into technical mode', () => {
    const guardedText = guardGeneratedTextForInterviewMode({
      focusArea: 'behavioral',
      generatedText: 'Now shifting to another technical skill. Walk me through the Python libraries and model training pipeline.',
      fallbackText: 'Using that project as the context, tell me about one challenge you faced. What action did you personally take, and what result did it lead to?',
    });

    expect(guardedText).not.toMatch(/technical skill|libraries|training pipeline/i);
    expect(guardedText).toMatch(/challenge|action|result/i);
  });

  it('keeps the planner out of technical section transitions when behavioural mode is locked', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'behavioural',
      currentTopic: 'dashboard_project',
      interviewStructure: { focusAreaKey: 'behavioral' },
      evaluatorState: { suggestedNextMode: 'advance' },
      sectionState: { sectionKey: 'behavioural', isSectionComplete: true, nextSectionKey: 'technical' },
      coverageState: { missingTopics: [], coveredTopics: ['teamwork'], weakAreas: [] },
      matchState: { validationTargets: [] },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_POOL_QUESTION);
    expect(plan.actionInput.category).toBe('behavioural');
  });

  it('turns technical validation targets into behavioural evidence probes in behavioural mode', () => {
    const plan = selectNextAction({
      taskType: 'interview_next_turn',
      currentStage: 'behavioural',
      currentTopic: 'dashboard_project',
      interviewStructure: { focusAreaKey: 'behavioral' },
      candidateState: { specificityLevel: 'medium' },
      evaluatorState: { suggestedNextMode: 'advance' },
      coverageState: { missingTopics: [], coveredTopics: ['teamwork'], weakAreas: [] },
      matchState: { validationTargets: ['Python model pipeline'] },
    });

    expect(plan.selectedAction).toBe(AGENT_ACTION_TYPES.ASK_PROBING_QUESTION);
    expect(plan.actionInput.probeType).toBe('behavioural_validation');
  });
});
