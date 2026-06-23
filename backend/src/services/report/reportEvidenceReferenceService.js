import { ensureArray, normalizeText } from '../../utils/commonHelpers.js';

const SOURCE_LABELS = {
  interview_answer: 'Interview answer',
  cv: 'CV',
  jd: 'Job description',
  nz_guide: 'NZ workplace guide',
};

export const buildCandidateEvidenceReferences = (references = []) => {
  const seen = new Set();

  return ensureArray(references)
    .flatMap((reference) => ensureArray(reference.evidenceSnippets).map((snippet) => ({
      claimId: reference.claimId || '',
      claim: normalizeText(reference.claimText),
      sourceType: normalizeText(snippet.sourceType),
      sourceLabel: SOURCE_LABELS[snippet.sourceType] || normalizeText(snippet.sourceType).toUpperCase(),
      evidenceSnippet: normalizeText(snippet.text),
      confidenceLevel: reference.confidenceLevel || 'low',
      similarity: Number(snippet.similarity || 0),
    })))
    .filter((item) => {
      const key = `${item.claim}|${item.sourceType}|${item.evidenceSnippet}`.toLowerCase();
      if (!item.claim || !item.evidenceSnippet || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

