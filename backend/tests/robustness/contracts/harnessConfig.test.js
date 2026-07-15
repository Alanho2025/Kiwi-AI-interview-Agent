import { afterEach, describe, expect, it } from 'vitest';

import { isHarnessShadowEnabled } from '../../../src/config/harnessConfig.js';

describe('M1 harness feature flag', () => {
  const originalValue = process.env.ENABLE_HARNESS_SHADOW;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.ENABLE_HARNESS_SHADOW;
    else process.env.ENABLE_HARNESS_SHADOW = originalValue;
  });

  it('defaults to disabled', () => {
    delete process.env.ENABLE_HARNESS_SHADOW;
    expect(isHarnessShadowEnabled()).toBe(false);
  });

  it('enables only through the explicit environment flag', () => {
    process.env.ENABLE_HARNESS_SHADOW = 'true';
    expect(isHarnessShadowEnabled()).toBe(true);
  });
});
