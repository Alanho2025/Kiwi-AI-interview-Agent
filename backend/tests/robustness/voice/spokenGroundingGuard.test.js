import { describe, expect, it } from 'vitest';
import { guardGeneratedTextForInterviewMode } from '../../../src/services/aiControl/interviewModeGuard.js';

describe('spoken grounding guard', () => {
  it('removes ungrounded "you mentioned" framing from generated text', () => {
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'combined',
      generatedText: 'You mentioned TypeScript. Let\'s talk about Python. What did you build with it?',
      fallbackText: 'Tell me about one Python example from your CV.',
    });

    expect(result).not.toMatch(/you mentioned/i);
    expect(result).toMatch(/let us focus on typescript|let us move to/i);
  });

  it('removes ungrounded "I see you have worked with" framing', () => {
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'combined',
      generatedText: "I see you've worked with TypeScript. Let's talk about Python. What did you implement yourself?",
      fallbackText: 'Tell me about one Python example from your CV.',
    });

    expect(result).not.toMatch(/i see you.*worked with/i);
    expect(result).toMatch(/let us focus on typescript|let us move to/i);
  });

  it('keeps normal grounded follow-up text unchanged', () => {
    const text = 'You compared 70/30 with 60/40 and 80/20. How did you decide which split worked best?';
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'combined',
      generatedText: text,
      fallbackText: 'How did you validate the split?',
    });

    expect(result).toBe(text);
  });

  it('uses behavioural fallback when behavioural mode receives technical generated text', () => {
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'behavioral',
      generatedText: 'How did you implement the model training and testing pipeline?',
      fallbackText: 'Using that project as the context, tell me about one challenge you faced. What action did you personally take, and what result did it lead to?',
    });

    expect(result).toMatch(/challenge/i);
    expect(result).toMatch(/action/i);
    expect(result).not.toMatch(/model training and testing pipeline/i);
  });

  it('uses technical fallback when technical mode receives purely behavioural generated text', () => {
    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'technical',
      generatedText: 'Tell me about a time you worked with a team under pressure.',
      fallbackText: 'Could you walk me through the technical approach you used for API security?',
      selectedQuestion: { topic: 'api_security', category: 'technical' },
    });

    expect(result).toMatch(/technical approach|api security/i);
    expect(result).not.toMatch(/worked with a team under pressure/i);
  });
});
