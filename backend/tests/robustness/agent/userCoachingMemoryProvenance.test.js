import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock('../../../src/db/models/userCoachingMemoryModel.js', () => ({
  UserCoachingMemory: {
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));

const { persistUserCoachingMemory } = await import(
  '../../../src/services/aiControl/userCoachingMemoryService.js'
);

describe('user coaching memory provenance', () => {
  it('keeps the newest workflow lineage when a coaching lesson is deduplicated', async () => {
    mocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        memoryRecords: [{
          memoryId: 'reflection-old',
          sourceWorkflowRunId: 'run-old',
          pattern: 'useful_progress',
          lesson: 'Keep building depth on owned decisions.',
          recommendedNextStrategy: 'deepen_then_shift',
        }],
      }),
    });
    mocks.findOneAndUpdate.mockResolvedValue(null);

    await persistUserCoachingMemory({
      userId: 'user-1',
      reflectionRecord: {
        reflectionId: 'reflection-new',
        sourceWorkflowRunId: 'run-new',
        pattern: 'useful_progress',
        lesson: 'Keep building depth on owned decisions.',
        recommendedNextStrategy: 'deepen_then_shift',
        createdAt: '2026-07-15T00:00:00.000Z',
      },
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          memoryRecords: [expect.objectContaining({
            memoryId: 'reflection-new',
            sourceWorkflowRunId: 'run-new',
          })],
        }),
      }),
      expect.any(Object),
    );
  });
});
