import { describe, expect, it } from 'vitest';
import { buildTurnActiveSpeechPhraseContext } from '../../../src/services/voice/speechPhraseHintService.js';
import { normalizeTranscript } from '../../../src/services/voice/transcriptNormalizer.js';

describe('6. phraseHintAndCalibration: Tech terms phrase list capping & calibration integrity', () => {
  it('truncates active question phrase lists to hard cap of 40', () => {
    const longSkills = Array.from({ length: 60 }, (_, i) => ({ term: `TechTerm_${i}`, priority: 'high' }));
    const result = buildTurnActiveSpeechPhraseContext({
      activeQuestion: { targetTechnicalTerms: longSkills },
      session: {},
    });

    expect(result.phraseList.length).toBeLessThanOrEqual(40);
  });

  it('normalizes tech terms with proper capitalization without altering sentence semantics', () => {
    const rawText = 'I used nodejs and postgresql database';
    const { normalizedText, changed } = normalizeTranscript(rawText);

    expect(normalizedText).toBe('I used Node.js and PostgreSQL database');
    expect(changed).toBe(true);
  });
});
