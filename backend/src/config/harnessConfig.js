import { getBooleanEnv } from './env.js';

import { normalizeLocalHarnessExecutionMode } from '../services/harness/harnessObservedContractPolicy.js';

export const isHarnessShadowEnabled = () => getBooleanEnv('ENABLE_HARNESS_SHADOW', false);

export const getHarnessExecutionMode = () => normalizeLocalHarnessExecutionMode(
  process.env.HARNESS_EXECUTION_MODE
);

export const isUserInterviewMemoryPlanningEnabled = () => (
  isHarnessShadowEnabled()
  && getHarnessExecutionMode() === 'observe'
  && getBooleanEnv('ENABLE_USER_INTERVIEW_MEMORY_PLANNING', false)
);
