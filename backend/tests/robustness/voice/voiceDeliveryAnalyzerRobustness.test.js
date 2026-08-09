import { describe, expect, it } from 'vitest';

import { analyzeVoiceDelivery, buildVoiceDeliverySummaryFromTranscript } from '../../../src/services/voice/voiceDeliveryAnalyzerService.js';

describe('voice delivery analyzer robustness', () => {
  it('extracts pace, filler, pause, and clarity signals from voice transcript metadata', () => {
    const metrics = analyzeVoiceDelivery({
      transcriptText: 'Um I mean I implemented the React dashboard and like reduced load time by 20 percent.',
      vad: {
        speechDurationMs: 6000,
        longPauseCount: 2,
      },
      asrConfidence: 0.92,
    });

    expect(metrics.wordCount).toBeGreaterThan(10);
    expect(metrics.wordsPerMinute).toBeGreaterThan(120);
    expect(metrics.fillerCount).toBeGreaterThanOrEqual(2);
    expect(metrics.longPauseCount).toBe(2);
    expect(metrics.fillerLevel).toBe('medium');
    expect(metrics.feedback).toEqual(expect.arrayContaining(['Replace filler words with short pauses.']));
  });

  it('summarizes per-turn voice delivery from transcript metadata when no persisted summary exists', () => {
    const summary = buildVoiceDeliverySummaryFromTranscript([
      {
        role: 'user',
        text: 'I implemented the React dashboard.',
        metadata: {
          voiceDelivery: {
            speakingDurationSeconds: 8,
            wordsPerMinute: 100,
            fillerCount: 1,
            longPauseCount: 0,
            repeatedCorrections: 0,
            unclearSpeechSegments: 0,
            deliveryConfidence: 'high',
            feedback: [],
          },
        },
      },
      {
        role: 'user',
        text: 'Um I mean I reduced load time.',
        metadata: {
          voiceDelivery: {
            speakingDurationSeconds: 6,
            wordsPerMinute: 80,
            fillerCount: 3,
            longPauseCount: 1,
            repeatedCorrections: 1,
            unclearSpeechSegments: 1,
            deliveryConfidence: 'low',
            feedback: ['Check microphone clarity or repeat key terms more distinctly.'],
          },
        },
      },
    ]);

    expect(summary).toMatchObject({
      turnCount: 2,
      averageWordsPerMinute: 90,
      averageSpeakingDurationSeconds: 7,
      totalFillerCount: 4,
      totalLongPauseCount: 1,
      totalRepeatedCorrections: 1,
      totalUnclearSpeechSegments: 1,
      deliveryConfidence: 'low',
    });
    expect(summary.feedback).toEqual(['Check microphone clarity or repeat key terms more distinctly.']);
  });

  it('keeps VAD duration as the per-turn source and treats missing duration as unavailable', () => {
    expect(analyzeVoiceDelivery({
      transcriptText: 'I delivered the project and verified the result.',
      vad: { speechDurationMs: 90000 },
      asrConfidence: 0.9,
    })).toMatchObject({ speakingDurationSeconds: 90 });

    expect(analyzeVoiceDelivery({
      transcriptText: 'I delivered the project.',
      vad: { speechDurationMs: 0 },
      asrConfidence: 0.9,
    })).toMatchObject({ speakingDurationSeconds: null });
  });
});
