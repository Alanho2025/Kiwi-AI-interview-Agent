import { describe, expect, it } from 'vitest';
import {
    analyzeTranscriptConfirmationReply,
    classifyTranscriptConfirmationReply,
} from '../../../src/services/voice/transcriptConfirmationReplyClassifier.js';

describe('transcriptConfirmationReplyClassifier', () => {
    it('classifies plain confirmation without extra content', () => {
        const result = analyzeTranscriptConfirmationReply('Yes, that is correct.');

        expect(result.decision).toBe('confirm');
        expect(result.hasExtraContent).toBe(false);
        expect(result.extraContent).toBe('');
        expect(result.isContentfulClarification).toBe(false);
        expect(classifyTranscriptConfirmationReply('Yes, that is correct.')).toBe('confirm');
    });

    it('keeps extra answer content after confirmation words', () => {
        const result = analyzeTranscriptConfirmationReply(
            'Yes, I think you are correct. I think the AI generated data will not be used in the real situation.',
        );

        expect(result.decision).toBe('confirm');
        expect(result.hasExtraContent).toBe(true);
        expect(result.isContentfulClarification).toBe(false);
        expect(result.extraContent).toContain('AI generated data will not be used');
    });

    it('treats a contentful answer without yes or no as clarification', () => {
        const result = analyzeTranscriptConfirmationReply(
            'The main point is that real data reflects real users better than generated data.',
        );

        expect(result.decision).toBe('unclear');
        expect(result.hasExtraContent).toBe(false);
        expect(result.isContentfulClarification).toBe(true);
    });

    it('classifies rejection', () => {
        const result = analyzeTranscriptConfirmationReply('No, that is not what I meant.');

        expect(result.decision).toBe('reject');
        expect(result.hasExtraContent).toBe(false);
        expect(result.isContentfulClarification).toBe(false);
        expect(classifyTranscriptConfirmationReply('No, that is not what I meant.')).toBe('reject');
    });

    it('does not treat short unclear replies as contentful clarification', () => {
        const result = analyzeTranscriptConfirmationReply('Maybe kind of.');

        expect(result.decision).toBe('unclear');
        expect(result.hasExtraContent).toBe(false);
        expect(result.isContentfulClarification).toBe(false);
    });
});