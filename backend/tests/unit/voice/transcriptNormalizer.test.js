import { describe, expect, it } from 'vitest';
import { normalizeTranscript } from '../../../src/services/voice/transcriptNormalizer.js';

describe('normalizeTranscript', () => {
  it('collapses spacing and preserves an empty transcript safely', () => {
    expect(normalizeTranscript('   ').normalizedText).toBe('');
    expect(normalizeTranscript('  hello    world  ').normalizedText).toBe('hello world');
  });

  it('applies conservative interview-tech corrections without rewriting meaning', () => {
    const result = normalizeTranscript('I used react query with post gray sql and r a g.');

    expect(result.normalizedText).toBe('I used React Query with PostgreSQL and RAG.');
    expect(result.changed).toBe(true);
    expect(result.corrections.length).toBeGreaterThanOrEqual(3);
  });
});
