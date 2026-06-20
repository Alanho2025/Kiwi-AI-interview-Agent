import { describe, expect, it } from 'vitest';
import { AiLog } from '../../../src/db/models/aiLogModel.js';
import { AiUsageEvent } from '../../../src/db/models/aiUsageEventModel.js';
import { CvQuestionSeed } from '../../../src/db/models/cvQuestionSeedModel.js';
import { InterviewQuestionPoolItem } from '../../../src/db/models/interviewQuestionPoolItemModel.js';
import { JdQuestionFilter } from '../../../src/db/models/jdQuestionFilterModel.js';
import { TokenUsage } from '../../../src/db/models/tokenUsageModel.js';
import { UserCoachingMemory } from '../../../src/db/models/userCoachingMemoryModel.js';

const models = [
  AiLog,
  CvQuestionSeed,
  InterviewQuestionPoolItem,
  JdQuestionFilter,
  UserCoachingMemory,
];

describe('runtime retention TTL indexes', () => {
  it.each(models.map((model) => [model.modelName, model]))(
    '%s expires independent runtime data seven days after its last update',
    (_name, model) => {
      const indexes = model.schema.indexes();
      expect(indexes).toContainEqual([
        { updatedAt: 1 },
        expect.objectContaining({ expireAfterSeconds: 604800 }),
      ]);
    },
  );
});

describe('permanent usage detail protection', () => {
  it.each([
    ['AiUsageEvent', AiUsageEvent],
    ['TokenUsage', TokenUsage],
  ])('%s has no TTL index until verified permanent rollups exist', (_name, model) => {
    const ttlIndexes = model.schema.indexes().filter(([, options]) => options.expireAfterSeconds != null);
    expect(ttlIndexes).toEqual([]);
  });
});
