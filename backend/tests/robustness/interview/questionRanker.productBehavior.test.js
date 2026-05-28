import { describe, expect, it } from 'vitest';
import { buildQuestionDecisionTrace } from '../../../src/services/aiControl/questionRanker.js';

describe('question ranking product behavior', () => {
  it('builds transparent ranking metadata for a selected question', () => {
    const trace = buildQuestionDecisionTrace({
      selectedAction: 'ASK_VALIDATION_QUESTION',
      selectedQuestion: {
        id: 'q_database_validation_001',
        sourceType: 'match_gap',
        topic: 'database',
        text: 'Tell me about one database task you handled yourself.',
        reason: 'Database evidence is still partial and needs validation.',
        evidenceNeed: ['ownership', 'validation_method', 'result'],
        matchGapId: 'database_evidence_partial',
      },
      session: {
        interviewPlan: {
          questionPool: [
            { id: 'q_database_validation_001', sourceType: 'match_gap', topic: 'database', text: 'Tell me about one database task you handled yourself.' },
            { id: 'q_culture_fit_001', sourceType: 'culture_fit', topic: 'teamwork', text: 'Tell me about how you work in a team.' },
          ],
        },
      },
      decisionContext: {
        environment: { latestAnswer: { text: 'I used MongoDB and PostgreSQL for different data needs.' } },
        matchState: { validationTargets: ['database'] },
        coverageState: { missingTopics: ['database'] },
      },
      generatedText: 'You mentioned databases. What database task did you own yourself?',
    });

    expect(trace).toEqual(expect.objectContaining({
      selectedAction: 'ASK_VALIDATION_QUESTION',
      selectedQuestionId: 'q_database_validation_001',
      sourceType: 'match_gap',
      whyThisQuestion: expect.stringContaining('Database evidence'),
      ranking: expect.objectContaining({
        selectedQuestionId: 'q_database_validation_001',
        topCandidates: expect.any(Array),
      }),
    }));
    expect(trace.evidenceUsed.length).toBeGreaterThan(0);
  });
});
