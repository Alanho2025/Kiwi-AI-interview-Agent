import { describe, expect, it } from 'vitest';

import { evaluateVoiceLatencyReport } from '../../../benchmarks/voice-asr-fallback/checkVoiceLatencyAcceptance.js';

describe('voice latency acceptance gate', () => {
  it('passes real benchmark reports only when final transcript and first audio targets are met', () => {
    const report = {
      results: [{
        provider: 'azure',
        fixture: 'self-introduction',
        acceptance: {
          pass: true,
          noAsrErrors: true,
          aiPipelineProducedOutput: true,
          speechEndToAsrFinalMs: 640,
          speechEndToFirstAudioReadyMs: 2900,
        },
      }],
    };

    const summary = evaluateVoiceLatencyReport(report);

    expect(summary.passed).toBe(true);
    expect(summary.thresholds).toEqual({
      speechEndToAsrFinalMs: 1000,
      speechEndToFirstAudioReadyMs: 3000,
    });
  });

  it('fails benchmark reports with slow final ASR, slow first audio, skipped cases, or missing output', () => {
    const report = {
      results: [
        {
          provider: 'azure',
          fixture: 'slow-asr',
          acceptance: {
            pass: false,
            noAsrErrors: true,
            aiPipelineProducedOutput: true,
            speechEndToAsrFinalMs: 1200,
            speechEndToFirstAudioReadyMs: 3001,
          },
        },
        {
          provider: 'azure',
          fixture: 'slow-tts',
          acceptance: {
            pass: false,
            noAsrErrors: true,
            aiPipelineProducedOutput: false,
            speechEndToAsrFinalMs: 800,
            speechEndToFirstAudioReadyMs: 5400,
          },
        },
        {
          provider: 'elevenlabs-realtime',
          fixture: 'skipped',
          skipped: true,
          error: 'missing provider key',
          acceptance: { pass: false },
        },
      ],
    };

    const summary = evaluateVoiceLatencyReport(report);

    expect(summary.passed).toBe(false);
    expect(summary.failedCases).toHaveLength(3);
    expect(summary.failedCases[0].failures).toEqual(expect.arrayContaining(['final_transcript_over_1s']));
    expect(summary.failedCases[0].failures).toEqual(expect.arrayContaining(['first_audio_over_3s']));
    expect(summary.failedCases[1].failures).toEqual(expect.arrayContaining(['first_audio_over_3s', 'ai_pipeline_output_missing']));
    expect(summary.failedCases[2].failures).toEqual(expect.arrayContaining(['benchmark_case_skipped', 'benchmark_case_error']));
  });
});
