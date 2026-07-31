import { describe, expect, it } from 'vitest';
import { prepareInterviewQuestionPool } from '../../../src/services/questions/questionPoolPreparationService.js';
import { composeInterviewQuestionPool } from '../../../src/services/questions/questionPoolComposerService.js';

describe('questionCatalogDegradation & Fallback Chain Robustness Suite', () => {
  it('gracefully degrades to local template pool when Mongo catalog repository is unavailable or returns empty', async () => {
    const settings = { enableCatalogSelection: true };

    const loadCatalogItemsUnavailable = async () => ({ status: 'catalog_unavailable', items: [], error: 'Mongo offline' });

    const result = await prepareInterviewQuestionPool({
      settings,
      deliveryMode: 'voice',
      loadCatalogItems: loadCatalogItemsUnavailable,
      proofStrategy: { artifactStatus: 'ready' },
      loadProofStrategy: async () => null,
    });

    expect(result).toBeDefined();
    expect(result.catalogStatus).toBe('catalog_unavailable');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('safely composes pool when analysisResult has basic structure', async () => {
    const pool = await composeInterviewQuestionPool({
      analysisResult: {
        parsedJdProfile: {
          roleDomain: 'software_it',
        },
        matchingDetails: {
          rubric: {
            requirements: [
              { id: 'req-1', label: 'General Experience', mustHave: true },
            ],
          },
        },
      },
      deliveryMode: 'text',
    });

    expect(Array.isArray(pool)).toBe(true);
  });
});
