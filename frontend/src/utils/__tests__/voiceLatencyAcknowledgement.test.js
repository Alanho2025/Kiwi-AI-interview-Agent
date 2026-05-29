import { describe, expect, it } from 'vitest';

import {
  containsForbiddenBridgeText,
  getBridgePhrasePool,
  pickUnusedBridgePhrase,
} from '../voiceLatencyAcknowledgement.js';

describe('voice latency acknowledgement phrases', () => {
  it('blocks system-loading wording that should not be spoken by the interviewer', () => {
    expect(containsForbiddenBridgeText('Let me check your CV.')).toBe(true);
    expect(containsForbiddenBridgeText('I am reviewing your profile.')).toBe(true);
    expect(containsForbiddenBridgeText('Let me compare this with the JD.')).toBe(true);
    expect(containsForbiddenBridgeText('That helps.')).toBe(false);
  });

  it('uses interview-context phrase pools instead of one generic filler list', () => {
    const followUpPool = getBridgePhrasePool({ expectedNextAction: 'PROBE_PROJECT_DETAIL' });
    expect(followUpPool).toContain('Let me ask about that.');
    expect(followUpPool).toContain('I will ask one follow-up.');

    const projectPool = getBridgePhrasePool({ questionType: 'technical', currentSection: 'project_experience' });
    expect(projectPool).toContain('I see your approach.');
    expect(projectPool).toContain('That explains your method.');

    const behaviouralPool = getBridgePhrasePool({ questionType: 'behavioural' });
    expect(behaviouralPool).toContain('That gives me context.');
    expect(behaviouralPool).toContain('I see the situation.');
  });

  it('does not repeat a bridge phrase while unused safe phrases remain', () => {
    const usedPhrases = [
      'Thank you.',
      'I see.',
      'Understood.',
      'That helps.',
      'Thanks for that.',
      'That is useful context.',
      'I follow.',
    ];

    const phrase = pickUnusedBridgePhrase({
      usedPhrases,
      expectedNextAction: 'ASK_NEXT_PLANNED_QUESTION',
    });

    expect(phrase).toBe('That is clear.');
    expect(usedPhrases).not.toContain(phrase);
    expect(containsForbiddenBridgeText(phrase)).toBe(false);
  });
});
