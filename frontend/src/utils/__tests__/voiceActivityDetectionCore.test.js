import { describe, expect, it } from 'vitest';
import { createVoiceActivityStateMachine, DEFAULT_VAD_CONFIG, selectBestTranscript } from '../voiceActivityDetectionCore.js';

describe('voiceActivityDetectionCore', () => {
  it('uses an interview-friendly soft-stop VAD default', () => {
    expect(DEFAULT_VAD_CONFIG.pauseCandidateMs).toBe(1800);
    expect(DEFAULT_VAD_CONFIG.pauseConfirmMs).toBe(800);
    expect(DEFAULT_VAD_CONFIG.silenceToStopMs).toBe(2600);
  });

  it('emits pause candidate before confirming speech end', () => {
    const vad = createVoiceActivityStateMachine({ warmupIgnoreMs: 0, minSpeechMs: 500, pauseCandidateMs: 600, pauseConfirmMs: 400, silenceToStopMs: 1000 });
    vad.start(0);
    expect(vad.update(0.03, 100).event).toBe('speech_start');
    expect(vad.update(0.03, 700).event).toBeNull();
    expect(vad.update(0.001, 800).event).toBeNull();
    const candidate = vad.update(0.001, 1400);
    expect(candidate.event).toBe('pause_candidate_start');
    expect(candidate.metrics.silenceDurationMs).toBeGreaterThanOrEqual(600);
    const result = vad.update(0.001, 1800);
    expect(result.event).toBe('speech_end');
    expect(result.metrics.speechDurationMs).toBeGreaterThanOrEqual(500);
    expect(result.metrics.silenceDurationMs).toBeGreaterThanOrEqual(1000);
  });

  it('cancels pause candidate when the user continues speaking', () => {
    const vad = createVoiceActivityStateMachine({ warmupIgnoreMs: 0, minSpeechMs: 500, pauseCandidateMs: 600, pauseConfirmMs: 400, silenceToStopMs: 1000 });
    vad.start(0);
    expect(vad.update(0.03, 100).event).toBe('speech_start');
    expect(vad.update(0.03, 700).event).toBeNull();
    expect(vad.update(0.001, 800).event).toBeNull();
    expect(vad.update(0.001, 1400).event).toBe('pause_candidate_start');
    const resumed = vad.update(0.03, 1500);
    expect(resumed.event).toBe('pause_resumed');
    expect(vad.getState()).toBe('user_speaking');
  });

  it('does not submit very short speech', () => {
    const vad = createVoiceActivityStateMachine({ warmupIgnoreMs: 0, minSpeechMs: 700, pauseCandidateMs: 600, pauseConfirmMs: 400, silenceToStopMs: 1000 });
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

  it('uses partial transcript when final is missing', () => {
    const best = selectBestTranscript({ finalTranscript: null, partialTranscript: 'Partial answer', timeoutUsed: true });
    expect(best.displayText).toBe('Partial answer');
    expect(best.usedPartialFallback).toBe(true);
    expect(best.source).toBe('partial_fallback');
  });
});
