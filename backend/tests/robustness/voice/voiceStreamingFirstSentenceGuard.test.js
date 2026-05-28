import { describe, expect, it } from 'vitest';
import { guardGeneratedTextForInterviewMode } from '../../../src/services/aiControl/interviewModeGuard.js';

const sanitizeStreamedSentence = (text, focusArea = 'combined') => guardGeneratedTextForInterviewMode({
  focusArea,
  generatedText: text,
  fallbackText: 'Can you give me one specific example with your action and the result?',
});

describe('voice streaming first sentence guard', () => {
  it('sanitizes ungrounded entity framing before the first streamed sentence is sent', () => {
    const firstSentence = "I see you've worked with TypeScript. Let's talk about Python.";
    const result = sanitizeStreamedSentence(firstSentence);

    expect(result).not.toMatch(/i see you.*worked with/i);
    expect(result).not.toMatch(/you mentioned/i);
  });

  it('sanitizes direct you-mentioned framing in first streamed sentence', () => {
    const firstSentence = 'You mentioned Python. How did you validate your model?';
    const result = sanitizeStreamedSentence(firstSentence);

    expect(result).not.toMatch(/^you mentioned/i);
    expect(result).toMatch(/let us focus|how did/i);
  });

  it('keeps grounded first streamed sentence when it refers to current answer facts', () => {
    const firstSentence = 'You compared 70/30 with 60/40 and 80/20. How did you validate the final split?';
    const result = sanitizeStreamedSentence(firstSentence);

    expect(result).toBe(firstSentence);
  });

  it('blocks technical first streamed sentence in behavioural mode', () => {
    const firstSentence = 'How did you implement the model training and testing pipeline?';
    const result = sanitizeStreamedSentence(firstSentence, 'behavioural');

    expect(result).not.toMatch(/model training and testing pipeline/i);
    expect(result).toMatch(/specific example|action|result|challenge/i);
  });

  it('blocks behavioural first streamed sentence in technical mode when fallback is technical', () => {
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'technical',
      generatedText: 'Tell me about a time you worked with a team under pressure.',
      fallbackText: 'Could you walk me through the technical approach you used for model validation?',
      selectedQuestion: { topic: 'model_validation', category: 'technical' },
    });

    expect(result).toMatch(/technical approach|model validation/i);
    expect(result).not.toMatch(/worked with a team under pressure/i);
  });
});
