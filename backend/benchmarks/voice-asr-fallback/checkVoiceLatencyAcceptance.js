#!/usr/bin/env node
/**
 * File responsibility: Gate real voice benchmark reports against demo latency targets.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_INPUT = path.join(__dirname, 'results.e2e-cloud-voice.json');
const DEFAULT_FINAL_TRANSCRIPT_MS = 1000;
const DEFAULT_FIRST_AUDIO_MS = 5000;

const parseArgs = (argv = process.argv.slice(2)) => {
  const options = {
    input: process.env.VOICE_LATENCY_GATE_INPUT || DEFAULT_INPUT,
    maxFinalTranscriptMs: Number(process.env.VOICE_LATENCY_MAX_FINAL_TRANSCRIPT_MS || DEFAULT_FINAL_TRANSCRIPT_MS),
    maxFirstAudioMs: Number(process.env.VOICE_LATENCY_MAX_FIRST_AUDIO_MS || DEFAULT_FIRST_AUDIO_MS),
    allowSkipped: process.env.VOICE_LATENCY_GATE_ALLOW_SKIPPED === 'true',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.input = argv[++index];
    if (arg === '--max-final-transcript-ms') options.maxFinalTranscriptMs = Number(argv[++index]);
    if (arg === '--max-first-audio-ms') options.maxFirstAudioMs = Number(argv[++index]);
    if (arg === '--allow-skipped') options.allowSkipped = true;
  }

  return options;
};

const flattenResults = (report = {}) => (report.results || []).map((item) => ({
  provider: item.provider || item.asr?.provider || 'unknown',
  fixture: item.fixture || item.asr?.fixture || 'unknown',
  skipped: Boolean(item.skipped),
  error: item.error || null,
  acceptance: item.acceptance || {},
}));

const checkResult = (item, options) => {
  const failures = [];
  const finalMs = Number(item.acceptance.speechEndToAsrFinalMs);
  const firstAudioMs = Number(item.acceptance.speechEndToFirstAudioReadyMs);

  if (item.skipped && !options.allowSkipped) failures.push('benchmark_case_skipped');
  if (item.error) failures.push('benchmark_case_error');
  if (item.acceptance.pass !== true) failures.push('acceptance_pass_false');
  if (!Number.isFinite(finalMs) || finalMs > options.maxFinalTranscriptMs) failures.push('final_transcript_over_1s');
  if (!Number.isFinite(firstAudioMs) || firstAudioMs > options.maxFirstAudioMs) failures.push('first_audio_over_5s');
  if (item.acceptance.noAsrErrors !== true) failures.push('asr_errors_present');
  if (item.acceptance.aiPipelineProducedOutput !== true) failures.push('ai_pipeline_output_missing');

  return {
    provider: item.provider,
    fixture: item.fixture,
    passed: failures.length === 0,
    failures,
    speechEndToAsrFinalMs: Number.isFinite(finalMs) ? finalMs : null,
    speechEndToFirstAudioReadyMs: Number.isFinite(firstAudioMs) ? firstAudioMs : null,
  };
};

export const evaluateVoiceLatencyReport = (report = {}, options = {}) => {
  const resolvedOptions = {
    maxFinalTranscriptMs: Number(options.maxFinalTranscriptMs || DEFAULT_FINAL_TRANSCRIPT_MS),
    maxFirstAudioMs: Number(options.maxFirstAudioMs || DEFAULT_FIRST_AUDIO_MS),
    allowSkipped: Boolean(options.allowSkipped),
  };
  const cases = flattenResults(report).map((item) => checkResult(item, resolvedOptions));
  const failedCases = cases.filter((item) => !item.passed);
  return {
    passed: cases.length > 0 && failedCases.length === 0,
    casesRun: cases.length,
    failedCases,
    thresholds: {
      speechEndToAsrFinalMs: resolvedOptions.maxFinalTranscriptMs,
      speechEndToFirstAudioReadyMs: resolvedOptions.maxFirstAudioMs,
    },
    cases,
  };
};

const main = async () => {
  const options = parseArgs();
  const report = JSON.parse(await fs.readFile(options.input, 'utf8'));
  const summary = evaluateVoiceLatencyReport(report, options);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) process.exitCode = 1;
};

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
