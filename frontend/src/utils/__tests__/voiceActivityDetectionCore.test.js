import { describe, expect, it } from 'vitest';
import { DEFAULT_VAD_CONFIG, createVoiceActivityStateMachine, selectBestTranscript } from '../voiceActivityDetectionCore.js';

describe('voiceActivityDetectionCore', () => {
  it('has base silenceToStopMs set to 1000ms SLA target', () => {
    expect(DEFAULT_VAD_CONFIG.silenceToStopMs).toBe(1000);
  });

  it('detects speech start and speech end after 1000ms base silence', () => {
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

  it('dynamically extends silence deadline on vocalized pause and caps at 2500ms', () => {
    const vad = createVoiceActivityStateMachine({
      warmupIgnoreMs: 0,
      calibrationMs: 0,
      speechStartConfirmationMs: 0,
      minSpeechMs: 500,
      silenceToStopMs: 1000,
    });
    vad.start(0);
    expect(vad.update(0.03, 100).event).toBe('speech_start');
    vad.update(0.03, 700); // 600ms valid speech duration
    vad.update(0.001, 800); // silence starts

    // Extend by 2500ms
    const extension = vad.extendCurrentSilenceDeadline({ durationMs: 2500, reason: 'vocalized_pause' });
    expect(extension.extended).toBe(true);
    expect(extension.totalDeadlineMs).toBe(3500); // 1000 + 2500

    // At 1800ms (1000ms silence), speech_end MUST NOT fire because deadline is 3500ms!
    expect(vad.update(0.001, 1800).event).toBeNull();

    // At 4300ms (3500ms silence), speech_end FIRES and resets extension!
    const endResult = vad.update(0.001, 4300);
    expect(endResult.event).toBe('speech_end');

    // After reset, next turn uses base 1000ms deadline again
    vad.start(5000);
    vad.update(0.03, 5100);
    vad.update(0.03, 5700);
    vad.update(0.001, 5800);
    const nextResult = vad.update(0.001, 6800);
    expect(nextResult.event).toBe('speech_end');
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

  it('uses final transcript before partial fallback', () => {
    const best = selectBestTranscript({
      finalTranscript: { displayText: 'Final answer' },
      partialTranscript: 'Partial answer',
      timeoutUsed: true,
    });
    expect(best.displayText).toBe('Final answer');
    expect(best.usedPartialFallback).toBe(false);
  });
});
