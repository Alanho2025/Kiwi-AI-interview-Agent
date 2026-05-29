import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  embedText: vi.fn(),
  normalizeForRetrieval: vi.fn(),
  postgresQuery: vi.fn(),
}));

vi.mock('../../../src/services/embeddingService.js', () => ({
  embedText: mocks.embedText,
  normalizeForRetrieval: mocks.normalizeForRetrieval,
}));

vi.mock('../../../src/db/postgres.js', () => ({
  query: mocks.postgresQuery,
}));

const { retrieveForInterviewTurn } = await import('../../../src/services/ragRetrievalService.js');

describe('retrieveForInterviewTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mocks.normalizeForRetrieval.mockImplementation((text = '') => String(text).toLowerCase());
    mocks.postgresQuery.mockResolvedValue({
      rows: [
        {
          chunkId: 'chunk-1',
          sourceType: 'cv',
          sessionId: 'session-1',
          text: 'The candidate used real data and manual data cleaning for a food AI project.',
          semantic: 0.9,
          metadata: { sourceId: 'cv-1' },
        },
      ],
    });
  });

  it('builds an interview-turn query from role, company, and current question context', async () => {
    const result = await retrieveForInterviewTurn({
      session: {
        id: 'session-1',
        targetRole: 'Junior Data Scientist',
        companyName: 'Halter',
        interviewPlan: {
          questionPool: [
            {
              id: 'question-1',
              text: 'Tell me about your food AI project.',
              skill: 'data cleaning',
              competency: 'communication',
            },
          ],
        },
      },
      userId: 'user-1',
      currentQuestionId: 'question-1',
      topK: 6,
    });

    expect(mocks.embedText).toHaveBeenCalledWith(expect.stringContaining('Junior Data Scientist'));
    expect(mocks.embedText).toHaveBeenCalledWith(expect.stringContaining('Halter'));
    expect(mocks.embedText).toHaveBeenCalledWith(expect.stringContaining('Tell me about your food AI project.'));
    expect(mocks.embedText).toHaveBeenCalledWith(expect.stringContaining('data cleaning'));
    expect(mocks.embedText).toHaveBeenCalledWith(expect.stringContaining('communication'));
    expect(mocks.embedText).toHaveBeenCalledWith(expect.stringContaining('user:user-1'));

    expect(mocks.postgresQuery).toHaveBeenCalledWith(
      expect.stringContaining('source_type = ANY'),
      expect.arrayContaining([
        '[0.1,0.2,0.3]',
        ['cv', 'job_description', 'match_analysis', 'interview_plan'],
        'session-1',
      ]),
    );

    expect(result).toEqual(expect.objectContaining({
      topK: 6,
      sourceTypes: ['cv', 'job_description', 'match_analysis', 'interview_plan'],
      items: expect.arrayContaining([
        expect.objectContaining({
          chunkId: 'chunk-1',
          sourceType: 'cv',
          sessionId: 'session-1',
          text: expect.stringContaining('manual data cleaning'),
        }),
      ]),
    }));
  });
});
