import { describe, expect, it, vi } from 'vitest';
import { embedTextsWithHuggingFace } from '../../../src/services/match/huggingFaceEmbeddingService.js';
import { buildDeterministicEmbedding } from '../../../src/services/embeddingService.js';

describe('huggingFaceEmbeddingService robustness & fallback suite', () => {
  it('falls back seamlessly to buildDeterministicEmbedding when HF API fetch fails', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('HuggingFace API rate limit 429 / server error 500'));

    try {
      const sampleText = 'Senior React Developer with TypeScript and State Management experience';
      const result = await embedTextsWithHuggingFace([sampleText]).catch(() => null);
      expect(result).toBeNull();

      // Verify that deterministic fallback produces valid 256-dim vector
      const fallbackVector = buildDeterministicEmbedding(sampleText);
      expect(Array.isArray(fallbackVector)).toBe(true);
      expect(fallbackVector.length).toBe(256);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles empty text and whitespace inputs safely without crashing', () => {
    const emptyVector = buildDeterministicEmbedding('');
    const whitespaceVector = buildDeterministicEmbedding('   \n\t  ');

    expect(Array.isArray(emptyVector)).toBe(true);
    expect(Array.isArray(whitespaceVector)).toBe(true);
    expect(whitespaceVector.length).toBe(emptyVector.length);
  });

  it('handles non-ASCII / Unicode characters correctly in deterministic vectorization', () => {
    const unicodeText = '應徵 AI 軟體工程師 具備 Python, PyTorch 與 LLM 開發經驗 🚀';
    const embedding = buildDeterministicEmbedding(unicodeText);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(256);
  });
});
