import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { QUESTION_CATALOG_SEED } from '../../../src/data/questionCatalogSeed2026_2.js';
import { buildCatalogQuestionSnapshots } from '../../../src/services/questions/questionCatalogSelectionService.js';
import {
  QUESTION_SCOPE_TURN_TYPES,
  resolveQuestionScopeObservation,
} from '../../../src/services/voice/questionScopeClarificationService.js';

const APPROVED_SEED_2026_2 = QUESTION_CATALOG_SEED.map((item) => ({ ...item, lifecycle: 'approved' }));

describe('end-to-end voice scope clarification with catalog 2026.2', () => {
  it('snapshots 2026.2 catalog items and retains ambiguityMode and clarificationContext', () => {
    const { items } = buildCatalogQuestionSnapshots({
      catalogItems: APPROVED_SEED_2026_2,
      context: {
        userId: 'user-2026-2',
        sessionId: 'session-2026-2',
        targetLevel: 'senior',
        settings: { focusArea: 'technical', questionLimit: 12, timeLimitMinutes: 15 },
        analysisResult: {
          jobTitle: 'Senior Software Engineer with AI tools',
          parsedJdProfile: {
            roleFamily: 'software',
            title: 'Senior Software Engineer',
            requirements: ['Build AI-assisted features', 'Testing and code verification', 'Copilot'],
          },
        },
      },
    });

    expect(items.length).toBeGreaterThan(0);
    const aiItem = items.find((item) => item.catalogQuestionId === 'ai_assisted_delivery');
    expect(aiItem).toBeDefined();
    expect(aiItem.ambiguityMode).toBe('open_scope_probe');
    expect(aiItem.clarificationContextVersion).toBe('2026.2.v1');
    expect(aiItem.clarificationContext.responseText).toContain('Copilot');

    const codingItem = items.find((item) => item.catalogQuestionId === 'coding_ownership_and_verification');
    expect(codingItem).toBeDefined();
    expect(codingItem.ambiguityMode).toBe('bounded_scenario');
    expect(codingItem.clarificationContextVersion).toBe('2026.2.v1');
    expect(codingItem.clarificationContext.responseText).toContain('automated tests');
  });

  it('triggers ANSWER_QUESTION_SCOPE with 2026.2 snapshot question when candidate asks for scope clarification', () => {
    const { items } = buildCatalogQuestionSnapshots({
      catalogItems: APPROVED_SEED_2026_2,
      context: {
        userId: 'user-2026-2',
        sessionId: 'session-2026-2',
        targetLevel: 'senior',
        analysisResult: {
          jobTitle: 'Senior AI Solution Engineer',
          parsedJdProfile: {
            roleFamily: 'ai_solution',
            title: 'AI Solution Engineer',
            requirements: ['Copilot', 'Agent delivery'],
          },
        },
      },
    });

    const aiSnapshot = items.find((item) => item.catalogQuestionId === 'ai_assisted_delivery');
    expect(aiSnapshot).toBeDefined();

    const mockSession = {
      transcript: [
        {
          role: 'ai',
          questionId: aiSnapshot.questionId,
          text: aiSnapshot.text,
          metadata: {
            countsAsQuestion: true,
            turnType: 'interview_question',
            preparedQuestionId: aiSnapshot.questionId,
            catalogQuestionId: aiSnapshot.catalogQuestionId,
            ambiguityMode: aiSnapshot.ambiguityMode,
            clarificationContextVersion: aiSnapshot.clarificationContextVersion,
            clarificationContext: aiSnapshot.clarificationContext,
          },
        },
      ],
    };

    const scopeObservation = resolveQuestionScopeObservation({
      session: mockSession,
      candidateText: 'Would you like me to focus on my daily Copilot workflow or team-level AI feature integration?',
    });

    expect(scopeObservation).toMatchObject({
      kind: 'scope_request',
      actionType: AGENT_ACTION_TYPES.ANSWER_QUESTION_SCOPE,
      turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
      catalogQuestionId: 'ai_assisted_delivery',
      clarificationContextVersion: '2026.2.v1',
      countsAsQuestion: false,
      countsAsAnswer: false,
    });
    expect(scopeObservation.responseText).toContain('Copilot');
  });
});
