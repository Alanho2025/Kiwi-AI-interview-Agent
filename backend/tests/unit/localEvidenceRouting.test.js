import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { judgeRequirementEvidenceBatch } from '../../src/services/match/evidenceJudgeService.js';
import * as deepseekJsonClient from '../../src/services/agenticSafeguards/deepseekJsonClient.js';
import { normalizeTaxonomyLabel } from '../../src/services/taxonomyService.js';

describe('localEvidenceRouting (TDD Red Stage)', () => {
  let callDeepSeekSpy;

  beforeEach(() => {
    // Spy on callDeepSeekJson so we can mock its behavior or verify if it is called
    callDeepSeekSpy = vi.spyOn(deepseekJsonClient, 'callDeepSeekJson').mockResolvedValue({
      judgements: []
    });
    // Force real mode in test context so that we don't hit the standard process.env.AI_TEST_MODE === 'mock' early exit
    process.env.AI_TEST_MODE = 'real';
    process.env.MATCH_ENGINE = 'semantic';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bypasses LLM (does not call callDeepSeekJson) when all requirements are high-confidence local hits or misses', async () => {
    const requirements = [
      { id: 'req-1', label: 'React experience', mustHave: true, category: 'technical_skill' },
      { id: 'req-2', label: 'Rust experience', mustHave: false, category: 'technical_skill' }
    ];

    const semanticEvidenceContext = {
      byLabel: {
        [normalizeTaxonomyLabel('React experience')]: [
          { id: 'ev-1', text: '5 years React development', score: 0.85, evidenceStrength: 'strong' }
        ],
        [normalizeTaxonomyLabel('Rust experience')]: [
          { id: 'ev-2', text: 'No match', score: 0.15, evidenceStrength: 'missing' }
        ]
      }
    };

    const result = await judgeRequirementEvidenceBatch({ requirements, semanticEvidenceContext });

    // Assertions
    expect(callDeepSeekSpy).not.toHaveBeenCalled(); // LLM must be completely bypassed
    expect(result['req-1']).toBeDefined();
    expect(result['req-1'].status).toBe('met');
    expect(result['req-1'].routedLocally).toBe(true);

    expect(result['req-2']).toBeDefined();
    expect(result['req-2'].status).toBe('not_met');
    expect(result['req-2'].routedLocally).toBe(true);
  });

  it('calls DeepSeek LLM only for ambiguous boundary requirements and merges results', async () => {
    const requirements = [
      { id: 'req-1', label: 'React experience', mustHave: true, category: 'technical_skill' },
      { id: 'req-2', label: 'NodeJS experience', mustHave: true, category: 'technical_skill' }
    ];

    const semanticEvidenceContext = {
      byLabel: {
        [normalizeTaxonomyLabel('React experience')]: [
          { id: 'ev-1', text: '5 years React development', score: 0.85, evidenceStrength: 'strong' }
        ],
        // Ambiguous score (0.65)
        [normalizeTaxonomyLabel('NodeJS experience')]: [
          { id: 'ev-2', text: 'Some Node scripts written', score: 0.65, evidenceStrength: 'partial' }
        ]
      }
    };

    // DeepSeek mock return for the single ambiguous requirement
    callDeepSeekSpy.mockResolvedValue({
      judgements: [
        {
          requirementId: 'req-2',
          status: 'partial',
          confidence: 0.7,
          evidenceStrength: 'partial',
          reason: 'Has basic script writing but not full service build experience.',
          missingEvidence: 'Direct production backend development.',
          interviewProbe: 'Ask them to describe a backend service.'
        }
      ]
    });

    const result = await judgeRequirementEvidenceBatch({ requirements, semanticEvidenceContext });

    // Assertions
    expect(callDeepSeekSpy).toHaveBeenCalledOnce(); // LLM must be called for the ambiguous item
    
    // Check that req-1 was bypassed and met
    expect(result['req-1']).toBeDefined();
    expect(result['req-1'].status).toBe('met');
    expect(result['req-1'].routedLocally).toBe(true);

    // Check that req-2 was judged by the LLM
    expect(result['req-2']).toBeDefined();
    expect(result['req-2'].status).toBe('partial');
    expect(result['req-2'].routedLocally).toBeUndefined(); // judged by LLM, not local router
  });
});
