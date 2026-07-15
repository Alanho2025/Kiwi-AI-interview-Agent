import { getBooleanEnv } from './env.js';

export const isHarnessShadowEnabled = () => getBooleanEnv('ENABLE_HARNESS_SHADOW', false);
