import { describe, expect, it } from 'vitest';
import { createVoiceActivityStateMachine, selectBestTranscript } from '../voiceActivityDetectionCore.js';

describe('voiceActivityDetectionCore', () => {
  it('detects speech start and speech end after enough silence', () => {
    const vad = createVoiceActivityStateMachine({
      warmupIgnoreMs: 0,
      calibrationMs: 0,
      speechStartConfirmationMs: 0,
      minSpeechMs: 500,
      silenceToStopMs: 1000,
    });
    vad.start(0);
    expect(vad.update(0.03, 100).event).toBe('speech_start');
    expect(vad.update(0.03, 700).event).toBeNull();
    expect(vad.update(0.001, 800).event).toBeNull();
    const result = vad.update(0.001, 1800);
    expect(result.event).toBe('speech_end');
    expect(result.metrics.speechDurationMs).toBeGreaterThanOrEqual(500);
    expect(result.metrics.silenceDurationMs).toBeGreaterThanOrEqual(1000);
  });

  it('does not submit very short speech', () => {
    const vad = createVoiceActivityStateMachine({
      warmupIgnoreMs: 0,
      calibrationMs: 0,
      speechStartConfirmationMs: 0,
      minSpeechMs: 700,
      silenceToStopMs: 1000,
    });
    vad.start(0);
    expect(vad.update(0.03, 100).event).toBe('speech_start');
    expect(vad.update(0.001, 200).event).toBeNull();
    expect(vad.update(0.001, 1300).event).toBeNull();
  });

  it('ignores short noise spikes before confirming speech start', () => {
    const vad = createVoiceActivityStateMachine({
      warmupIgnoreMs: 0,
      calibrationMs: 300,
      speechStartConfirmationMs: 150,
      minSpeechMs: 500,
      silenceToStopMs: 1000,
    });
    vad.start(0);

    expect(vad.update(0.016, 50).event).toBeNull();
    expect(vad.update(0.016, 100).event).toBeNull();
    expect(vad.update(0.06, 200).event).toBeNull();
    expect(vad.update(0.001, 250).event).toBeNull();
    expect(vad.update(0.06, 400).event).toBeNull();

    const result = vad.update(0.06, 560);
    expect(result.event).toBe('speech_start');
    expect(result.metrics.confirmationMs).toBeGreaterThanOrEqual(150);
  });

  it('uses final transcript before partial fallback', () => {
    const best = selectBestTranscript({
      finalTranscript: { displayText: 'Final answer' },
      partialTranscript: 'Partial answer',
      timeoutUsed: true,
    });
    expect(best.displayText).toBe('Final answer');
    expect(best.usedPartialFallback).toBe(false);
  });

  it('uses partial transcript when final is missing', () => {
    const best = selectBestTranscript({ finalTranscript: null, partialTranscript: 'Partial answer', timeoutUsed: true });
    expect(best.displayText).toBe('Partial answer');
    expect(best.usedPartialFallback).toBe(true);
    expect(best.source).toBe('partial_fallback');
  });
});
