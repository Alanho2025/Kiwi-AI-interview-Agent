import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildE2eRefineReleaseGateSummary, runE2eRefineReleaseGateEvaluation } from '../../../eval/helpers/e2eRefineReleaseGateEvaluator.js';

const requiredArtifacts = {
  reviewLock: {
    schemaVersion: 'review_lock_bypass_e2e_report_v1',
    passed: true,
    truthLevel: 'hybrid_backend',
    resultType: 'review_lock_bypass_blocked',
    assertions: ['review_lock_bypass_blocked'],
    blockers: [],
    knownIssues: [],
    browserErrors: [],
  },
  voiceLowConfidence: {
    schemaVersion: 'voice_low_confidence_ui_e2e_report_v1',
    passed: true,
    truthLevel: 'real_backend_voice',
    resultType: 'low_confidence_confirmation_visible',
    assertions: ['low_confidence_confirmation_visible', 'question_count_unchanged'],
    blockers: [],
    knownIssues: [],
    browserErrors: [],
  },
  retentionDeletion: {
    schemaVersion: 'retention_deletion_lifecycle_e2e_report_v1',
    passed: true,
    truthLevel: 'hybrid_backend',
    resultType: 'retention_deletion_access_denied',
    assertions: ['deleted_session_not_readable', 'deleted_cv_not_reusable'],
    blockers: [],
    knownIssues: [],
    browserErrors: [],
  },
  voiceNetworkBargeIn: {
    schemaVersion: 'voice_network_barge_in_e2e_report_v1',
    passed: true,
    truthLevel: 'real_backend_voice',
    resultType: 'voice_network_barge_in_recoverable',
    assertions: ['bounded_slow_network_completed', 'barge_in_acknowledged'],
    blockers: [],
    knownIssues: ['voice_next_question_3s_slo_exceeded'],
    browserErrors: [],
    networkProfile: { rttMs: 300 },
    nextQuestionFirstAudioMs: 4200,
    bargeInAck: { interrupted: true },
  },
};

describe('E2E refine release gate evaluator', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-e2e-refine-gate-'));
  });

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('marks the E2E refine gate ready with known issues when required artifacts pass and only voice 3s SLO is exceeded', () => {
    const summary = buildE2eRefineReleaseGateSummary(requiredArtifacts);

    expect(summary.releaseStatus).toBe('ready_with_known_issues');
    expect(summary.releaseBlockers).toEqual([]);
    expect(summary.knownIssues).toContain('voice_next_question_3s_slo_exceeded');
    expect(summary.gates.reviewLock.status).toBe('passed');
    expect(summary.gates.retentionDeletion.status).toBe('passed');
    expect(summary.gates.voiceNetworkBargeIn.status).toBe('passed');
    expect(summary.external).toEqual(expect.arrayContaining([
      'live_azure_stt_not_run',
      'live_elevenlabs_tts_not_run',
      'production_retention_telemetry_unavailable',
    ]));
  });

  it('blocks when a required artifact is missing or reports browser errors', () => {
    const summary = buildE2eRefineReleaseGateSummary({
      ...requiredArtifacts,
      reviewLock: null,
      voiceLowConfidence: {
        ...requiredArtifacts.voiceLowConfidence,
        browserErrors: ['[pageerror] simulated'],
      },
    });

    expect(summary.releaseStatus).toBe('blocked');
    expect(summary.releaseBlockers).toContain('missing_required_artifact:reviewLock');
    expect(summary.releaseBlockers).toContain('browser_errors_present:voiceLowConfidence');
    expect(summary.gates.reviewLock.status).toBe('missing');
    expect(summary.gates.voiceLowConfidence.status).toBe('failed');
  });

  it('writes JSON and Markdown reports from artifact files', async () => {
    const artifactRoot = path.join(tempRoot, 'output', 'playwright');
    const reportRoot = path.join(tempRoot, 'backend', 'eval', 'reports');
    await fs.mkdir(artifactRoot, { recursive: true });

    const filenames = {
      reviewLock: 'review-lock-bypass.latest.json',
      voiceLowConfidence: 'voice-low-confidence-ui.latest.json',
      retentionDeletion: 'retention-deletion-lifecycle.latest.json',
      voiceNetworkBargeIn: 'voice-network-barge-in.latest.json',
    };

    await Promise.all(Object.entries(filenames).map(([key, filename]) =>
      fs.writeFile(path.join(artifactRoot, filename), `${JSON.stringify(requiredArtifacts[key], null, 2)}\n`)
    ));

    const summary = await runE2eRefineReleaseGateEvaluation({ artifactRoot, reportRoot });

    expect(summary.releaseStatus).toBe('ready_with_known_issues');
    await expect(fs.readFile(path.join(reportRoot, 'e2e-refine-release-gate.latest.json'), 'utf8')).resolves.toContain('e2e_refine_release_gate_report_v1');
    await expect(fs.readFile(path.join(reportRoot, 'e2e-refine-release-gate.latest.md'), 'utf8')).resolves.toContain('# E2E Refine Release Gate');
  });
});
