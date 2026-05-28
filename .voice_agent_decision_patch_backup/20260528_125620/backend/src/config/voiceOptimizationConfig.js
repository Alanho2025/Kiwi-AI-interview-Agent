/**
 * File responsibility: Voice optimization feature flags and configuration.
 * Main responsibilities:
 * - Centralize voice latency optimization feature flags
 * - Support gradual rollout with percentage-based enablement
 * - Provide safe defaults and rollback mechanisms
 */

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  const str = String(value).toLowerCase().trim();
  return str === 'true' || str === '1' || str === 'yes';
};

const parseInt = (value, defaultValue = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

/**
 * Hash string to number for consistent rollout
 */
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

class VoiceOptimizationConfig {
  constructor() {
    this.warmContextEnabled = parseBoolean(process.env.VOICE_WARM_CONTEXT_ENABLED, true);
    this.fastPathEnabled = parseBoolean(process.env.VOICE_FAST_PATH_ENABLED, false);
    this.backgroundQualityEnabled = parseBoolean(process.env.VOICE_BACKGROUND_QUALITY_ENABLED, true);
    this.warmContextTTL = parseInt(process.env.WARM_CONTEXT_TTL_MS, 90000);
    this.rolloutPercentage = Math.min(100, Math.max(0, parseInt(process.env.WARM_CONTEXT_ROLLOUT_PERCENTAGE, 100)));
  }

  /**
   * Check if warm context is enabled for a specific session
   * Uses consistent hashing for gradual rollout
   */
  isEnabledForSession(sessionId) {
    if (!this.warmContextEnabled) return false;
    if (this.rolloutPercentage >= 100) return true;
    if (this.rolloutPercentage <= 0) return false;

    const hash = hashString(sessionId);
    const bucket = hash % 100;
    return bucket < this.rolloutPercentage;
  }

  /**
   * Check if fast path (rule-based action + local understanding) is enabled
   */
  isFastPathEnabled() {
    return this.fastPathEnabled && this.warmContextEnabled;
  }

  /**
   * Check if background quality path is enabled
   */
  isBackgroundQualityEnabled() {
    return this.backgroundQualityEnabled;
  }

  /**
   * Get warm context TTL in milliseconds
   */
  getWarmContextTTL() {
    return this.warmContextTTL;
  }

  /**
   * Get current rollout percentage
   */
  getRolloutPercentage() {
    return this.rolloutPercentage;
  }

  /**
   * Get configuration summary for logging
   */
  getSummary() {
    return {
      warmContextEnabled: this.warmContextEnabled,
      fastPathEnabled: this.fastPathEnabled,
      backgroundQualityEnabled: this.backgroundQualityEnabled,
      warmContextTTL: this.warmContextTTL,
      rolloutPercentage: this.rolloutPercentage,
    };
  }

  /**
   * Disable all optimizations (emergency rollback)
   */
  disableAll() {
    this.warmContextEnabled = false;
    this.fastPathEnabled = false;
    this.backgroundQualityEnabled = false;
  }

  /**
   * Enable all optimizations
   */
  enableAll() {
    this.warmContextEnabled = true;
    this.fastPathEnabled = true;
    this.backgroundQualityEnabled = true;
    this.rolloutPercentage = 100;
  }
}

// Singleton instance
const voiceOptimizationConfig = new VoiceOptimizationConfig();

export default voiceOptimizationConfig;

// Named export for testing
export { VoiceOptimizationConfig };

// Made with Bob
