import { describe, expect, it } from 'vitest';
import {
  isOpenSourceNlpEnabled,
  extractPdfWithPdfplumber,
  analyzeTextWithSpacy,
  rankEvidenceWithSentenceTransformers,
} from '../../../src/services/pythonNlpService.js';

describe('F-11 Python NLP CV Entity Extraction Service Robustness Suite', () => {
  it('returns null and skips execution when ENABLE_OPEN_SOURCE_NLP is disabled (default)', async () => {
    expect(isOpenSourceNlpEnabled()).toBe(false);

    const pdfResult = await extractPdfWithPdfplumber(Buffer.from('fake pdf content'));
    const spacyResult = await analyzeTextWithSpacy({ kind: 'cv', text: 'Senior Software Engineer with 5 years experience' });
    const rankResult = await rankEvidenceWithSentenceTransformers({ requirements: ['SQL'], evidence: ['Built SQL queries'] });

    expect(pdfResult).toBeNull();
    expect(spacyResult).toBeNull();
    expect(rankResult).toBeNull();
  });

  it('safely handles empty text input in analyzeTextWithSpacy', async () => {
    const emptyResult = await analyzeTextWithSpacy({ kind: 'cv', text: '' });
    const whitespaceResult = await analyzeTextWithSpacy({ kind: 'cv', text: '   \n  ' });

    expect(emptyResult).toBeNull();
    expect(whitespaceResult).toBeNull();
  });

  it('safely handles empty requirements or evidence arrays in rankEvidenceWithSentenceTransformers', async () => {
    const noReqs = await rankEvidenceWithSentenceTransformers({ requirements: [], evidence: ['Built SQL queries'] });
    const noEvidence = await rankEvidenceWithSentenceTransformers({ requirements: ['SQL'], evidence: [] });

    expect(noReqs).toBeNull();
    expect(noEvidence).toBeNull();
  });
});
