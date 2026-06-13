import { describe, expect, it } from 'vitest';

import { buildOpeningQuestion } from '../../src/utils/questionBuilders.js';

describe('question builders', () => {
  it('builds opening questions around the role instead of the interview artifact', () => {
    const question = buildOpeningQuestion({
      roleLabel: 'Junior Data & System Analyst',
      companyName: "Variety - The Children's Charity",
      level: 'junior',
    });

    expect(question).toContain('the Junior Data & System Analyst role');
    expect(question).not.toContain('Junior Data & System Analyst interview');
  });
});
