import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordTokenUsageMock = vi.hoisted(() => vi.fn());
const recordLlmUsageMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/usageTrackingService.js', () => ({
  recordTokenUsage: recordTokenUsageMock,
}));

vi.mock('../../../src/services/aiUsageTrackingService.js', () => ({
  recordLlmUsage: recordLlmUsageMock,
}));

import {
  autoRecordUsage,
  getUsageContextStore,
  runWithUsageContextPatch,
} from '../../../src/services/deepseekService.js';

describe('DeepSeek harness usage correlation', () => {
  beforeEach(() => {
    recordTokenUsageMock.mockReset().mockResolvedValue(null);
    recordLlmUsageMock.mockReset().mockResolvedValue({ estimatedCost: 0.0042 });
  });

  it('merges nested task and capability context and emits safe usage totals', async () => {
    const usageCollector = vi.fn();

    await runWithUsageContextPatch({
      userId: 'user-usage',
      sessionId: 'session-usage',
      workflowRunId: 'run-usage',
      harnessUsageCollector: usageCollector,
    }, () => runWithUsageContextPatch({
      harnessCapabilityId: 'reportGenerator',
    }, async () => {
      expect(getUsageContextStore()).toMatchObject({
        userId: 'user-usage',
        sessionId: 'session-usage',
        workflowRunId: 'run-usage',
        harnessCapabilityId: 'reportGenerator',
      });
      await autoRecordUsage({
        promptTokens: 300,
        completionTokens: 75,
      }, 'callDeepSeek', {
        stage: 'report_generated',
        feature: 'candidate_feedback',
        privateMetadata: 'must not reach harness usage',
      });
    }));

    expect(usageCollector).toHaveBeenCalledWith({
      provider: 'deepseek',
      model: 'deepseek-chat',
      capabilityId: 'reportGenerator',
      promptTokens: 300,
      completionTokens: 75,
      estimatedCost: 0.0042,
    });
    expect(JSON.stringify(usageCollector.mock.calls)).not.toContain('privateMetadata');
  });
});
