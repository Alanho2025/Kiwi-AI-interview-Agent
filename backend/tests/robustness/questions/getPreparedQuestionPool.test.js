import { describe, expect, it } from 'vitest';

import { buildPreparedRootQuestionPoolQuery } from '../../../src/services/questions/questionPoolComposerService.js';

describe('get prepared question pool query', () => {
  it('treats missing, null, or empty questionRole as root questions during transition', () => {
    expect(buildPreparedRootQuestionPoolQuery({ sessionId: 'session-1' }).$or).toEqual([
      { questionRole: 'root_question' },
      { questionRole: { $exists: false } },
      { questionRole: null },
      { questionRole: '' },
    ]);
  });
});
