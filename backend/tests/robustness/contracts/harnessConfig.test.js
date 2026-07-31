import { afterEach, describe, expect, it } from 'vitest';

import { loadEnv } from '../../../src/config/env.js';
import {
  getHarnessExecutionMode,
  isHarnessShadowEnabled,
} from '../../../src/config/harnessConfig.js';

loadEnv();

describe('M1 harness feature flag', () => {
  const originalValue = process.env.ENABLE_HARNESS_SHADOW;
  const originalMode = process.env.HARNESS_EXECUTION_MODE;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.ENABLE_HARNESS_SHADOW;
    else process.env.ENABLE_HARNESS_SHADOW = originalValue;
    if (originalMode === undefined) delete process.env.HARNESS_EXECUTION_MODE;
    else process.env.HARNESS_EXECUTION_MODE = originalMode;
  });

  it('defaults to disabled', () => {
    delete process.env.ENABLE_HARNESS_SHADOW;
    expect(isHarnessShadowEnabled()).toBe(false);
  });

  it('enables only through the explicit environment flag', () => {
    process.env.ENABLE_HARNESS_SHADOW = 'true';
    expect(isHarnessShadowEnabled()).toBe(true);
  });

  it('allows local shadow or observe mode but never promotes from config to warn or enforce', () => {
    process.env.ENABLE_HARNESS_SHADOW = 'true';
    process.env.HARNESS_EXECUTION_MODE = 'observe';
    expect(getHarnessExecutionMode()).toBe('observe');

    process.env.HARNESS_EXECUTION_MODE = 'enforce';
    expect(getHarnessExecutionMode()).toBe('shadow');
  });
});
