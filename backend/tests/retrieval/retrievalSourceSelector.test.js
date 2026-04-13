import { describe, expect, it } from 'vitest';
import { RETRIEVAL_OBJECTIVES } from '../../src/constants/retrievalObjectives.js';
import { selectRetrievalSources } from '../../src/services/retrieval/retrievalSourceSelector.js';

describe('selectRetrievalSources', () => {
  it('uses session-first sources for claim validation', () => {
    const sources = selectRetrievalSources({ objective: RETRIEVAL_OBJECTIVES.VALIDATE_CANDIDATE_CLAIM });
    expect(sources).toContain('cv_profile');
    expect(sources).toContain('match_analysis');
    expect(sources).toContain('transcript');
  });

  it('uses global question sources for role-specific question search', () => {
    const sources = selectRetrievalSources({ objective: RETRIEVAL_OBJECTIVES.FIND_ROLE_SPECIFIC_QUESTION });
    expect(sources).toContain('question_bank');
    expect(sources).toContain('behavioural_bank');
  });
});
