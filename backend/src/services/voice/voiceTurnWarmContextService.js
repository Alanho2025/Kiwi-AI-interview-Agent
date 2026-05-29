/**
 * File responsibility: Voice turn warm context cache service.
 * Main responsibilities:
 * - Prepare and cache context during user speech to reduce latency
 * - Validate cached context before use to prevent stale data issues
 * - Manage cache lifecycle with TTL and cleanup
 */

import { logger } from '../../utils/logger.js';

const DEFAULT_CACHE_TTL_MS = 90000; // 90 seconds
const CACHE_CLEANUP_INTERVAL_MS = 30000; // 30 seconds

class VoiceTurnWarmContextService {
  constructor() {
    this.cache = new Map();
    this.cleanupInterval = null;
    this.startCleanupTimer();
  }

  /**
   * Generate cache key from session and turn identifiers
   */
  buildCacheKey({ sessionId, questionId, clientTurnId }) {
    return `${sessionId}:${questionId}:${clientTurnId}`;
  }

  /**
   * Start periodic cleanup of expired cache entries
   */
  startCleanupTimer() {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        logger.info('Warm context cache cleanup completed', {
          expiredCount,
          remainingCount: this.cache.size,
        });
      }
    }, CACHE_CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop cleanup timer (for testing or shutdown)
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Prepare warm context during user speech
   * @param {Object} params
   * @param {Object} params.session - Interview session
   * @param {string} params.userId - User ID
   * @param {string} params.currentQuestionId - Current question ID
   * @param {string} params.clientTurnId - Client turn identifier
   * @param {number} params.currentQuestionIndex - Current question index
   * @param {number} params.transcriptLength - Current transcript length
   * @returns {Promise<string>} Cache key
   */
  async prepareWarmContext({
    session,
    userId,
    currentQuestionId,
    clientTurnId,
    currentQuestionIndex,
    transcriptLength = 0,
  }) {
    const startedAt = Date.now();
    
    try {
      // Import services dynamically to avoid circular dependencies
      const [
        { ensureSessionArtifactsIndexed },
        { retrieveForInterviewTurn },
        { buildInterviewEnvironment },
        { buildEvidenceBundle },
      ] = await Promise.all([
        import('../ragIndexService.js'),
        import('../ragRetrievalService.js'),
        import('../aiControl/interviewEnvironmentService.js'),
        import('../aiControl/evidenceBundleService.js'),
      ]);

      logger.info('Warm context preparation started', {
        sessionId: session.id,
        userId,
        currentQuestionId,
        clientTurnId,
        currentQuestionIndex,
      });

      // Prepare context in parallel
      const [retrievalBundle, baseEnvironment, evidenceBundle] = await Promise.all([
        (async () => {
          await ensureSessionArtifactsIndexed(session.id, userId);
          return retrieveForInterviewTurn({
            session,
            userId,
            currentQuestionId,
          });
        })(),
        buildInterviewEnvironment({ session, userId }),
        buildEvidenceBundle({ session, userId }),
      ]);

      const cacheKey = this.buildCacheKey({
        sessionId: session.id,
        questionId: currentQuestionId,
        clientTurnId,
      });

      const ttlMs = parseInt(process.env.WARM_CONTEXT_TTL_MS || DEFAULT_CACHE_TTL_MS, 10);
      const now = Date.now();

      const cacheEntry = {
        sessionId: session.id,
        questionId: currentQuestionId,
        clientTurnId,
        currentQuestionIndex,
        transcriptLengthAtWarmup: transcriptLength,
        retrievalBundle,
        baseEnvironment,
        evidenceBundle,
        createdAt: now,
        expiresAt: now + ttlMs,
        preparationDurationMs: Date.now() - startedAt,
      };

      this.cache.set(cacheKey, cacheEntry);

      logger.info('Warm context preparation completed', {
        sessionId: session.id,
        clientTurnId,
        cacheKey,
        durationMs: Date.now() - startedAt,
        ttlMs,
        cacheSize: this.cache.size,
      });

      return cacheKey;
    } catch (error) {
      logger.error('Warm context preparation failed', {
        sessionId: session.id,
        clientTurnId,
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  /**
   * Validate warm context is still usable
   * @param {Object} cache - Cached context entry
   * @param {Object} currentState - Current session state
   * @returns {Object} Validation result with ok flag and reason
   */
  validateWarmContext(cache, currentState, { allowClientTurnMismatch = false } = {}) {
    const now = Date.now();

    // Check session ID matches
    if (cache.sessionId !== currentState.sessionId) {
      return {
        ok: false,
        reason: 'session_id_mismatch',
        message: 'Cache session ID does not match current session',
      };
    }

    // Check question ID matches
    if (cache.questionId !== currentState.questionId) {
      return {
        ok: false,
        reason: 'question_id_mismatch',
        message: 'Cache question ID does not match current question',
      };
    }

    // Check turn ID matches
    if (!allowClientTurnMismatch && cache.clientTurnId !== currentState.clientTurnId) {
      return {
        ok: false,
        reason: 'turn_id_mismatch',
        message: 'Cache turn ID does not match current turn',
      };
    }

    // Check question index matches
    if (cache.currentQuestionIndex !== currentState.currentQuestionIndex) {
      return {
        ok: false,
        reason: 'question_index_mismatch',
        message: 'Cache question index does not match current index',
      };
    }

    // Check cache not expired
    if (now > cache.expiresAt) {
      return {
        ok: false,
        reason: 'cache_expired',
        message: 'Cache has expired',
        ageMs: now - cache.createdAt,
      };
    }

    // Check session status is still in progress
    if (currentState.sessionStatus !== 'in_progress') {
      return {
        ok: false,
        reason: 'session_not_in_progress',
        message: 'Session is no longer in progress',
        sessionStatus: currentState.sessionStatus,
      };
    }

    // All validations passed
    return {
      ok: true,
      reason: 'valid',
      message: 'Cache is valid',
      ageMs: now - cache.createdAt,
    };
  }

  findCompatibleWarmContext({ sessionId, questionId, currentQuestionIndex }) {
    const now = Date.now();
    const candidates = [...this.cache.values()]
      .filter((entry) => (
        entry.sessionId === sessionId
        && entry.questionId === questionId
        && entry.currentQuestionIndex === currentQuestionIndex
        && now <= entry.expiresAt
      ))
      .sort((a, b) => b.createdAt - a.createdAt);

    return candidates[0] || null;
  }

  /**
   * Retrieve warm context if valid
   * @param {Object} params
   * @param {string} params.sessionId - Session ID
   * @param {string} params.questionId - Question ID
   * @param {string} params.clientTurnId - Client turn identifier
   * @param {number} params.currentQuestionIndex - Current question index
   * @param {string} params.sessionStatus - Current session status
   * @returns {Promise<Object|null>} Warm context or null if invalid
   */
  async getWarmContext({
    sessionId,
    questionId,
    clientTurnId,
    currentQuestionIndex,
    sessionStatus = 'in_progress',
  }) {
    const cacheKey = this.buildCacheKey({ sessionId, questionId, clientTurnId });
    let cache = this.cache.get(cacheKey);
    let resolvedCacheKey = cacheKey;
    let allowClientTurnMismatch = false;

    if (!cache) {
      cache = this.findCompatibleWarmContext({ sessionId, questionId, currentQuestionIndex });
      if (cache) {
        resolvedCacheKey = this.buildCacheKey({
          sessionId: cache.sessionId,
          questionId: cache.questionId,
          clientTurnId: cache.clientTurnId,
        });
        allowClientTurnMismatch = true;
      } else {
        logger.info('Warm context cache miss', {
          sessionId,
          clientTurnId,
          cacheKey,
          reason: 'not_found',
        });
        return null;
      }
    }

    const validation = this.validateWarmContext(cache, {
      sessionId,
      questionId,
      clientTurnId,
      currentQuestionIndex,
      sessionStatus,
    }, { allowClientTurnMismatch });

    if (!validation.ok) {
      logger.warn('Warm context validation failed', {
        sessionId,
        clientTurnId,
        cacheKey: resolvedCacheKey,
        reason: validation.reason,
        message: validation.message,
        cacheAge: validation.ageMs,
      });
      
      // Remove invalid cache entry
      this.cache.delete(cacheKey);
      return null;
    }

    logger.info('Warm context cache hit', {
      sessionId,
      clientTurnId,
      cacheKey: resolvedCacheKey,
      cacheAge: validation.ageMs,
      preparationDuration: cache.preparationDurationMs,
      matchMode: allowClientTurnMismatch ? 'question_index_fallback' : 'exact',
    });

    return {
      retrievalBundle: cache.retrievalBundle,
      baseEnvironment: cache.baseEnvironment,
      evidenceBundle: cache.evidenceBundle,
      metadata: {
        cacheAge: validation.ageMs,
        preparationDuration: cache.preparationDurationMs,
        createdAt: cache.createdAt,
        cacheClientTurnId: cache.clientTurnId,
        requestedClientTurnId: clientTurnId,
        matchMode: allowClientTurnMismatch ? 'question_index_fallback' : 'exact',
      },
    };
  }

  /**
   * Clear warm context for session
   * @param {Object} params
   * @param {string} params.sessionId - Session ID
   */
  async clearWarmContext({ sessionId }) {
    let clearedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.sessionId === sessionId) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.info('Warm context cleared for session', {
        sessionId,
        clearedCount,
        remainingCount: this.cache.size,
      });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    const ages = [];

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
        ages.push(now - entry.createdAt);
      }
    }

    const avgAge = ages.length > 0
      ? ages.reduce((sum, age) => sum + age, 0) / ages.length
      : 0;

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      averageAgeMs: Math.round(avgAge),
    };
  }

  /**
   * Clear all cache entries (for testing)
   */
  clearAll() {
    const count = this.cache.size;
    this.cache.clear();
    logger.info('All warm context cache cleared', { clearedCount: count });
  }
}

// Singleton instance
const warmContextService = new VoiceTurnWarmContextService();

export default warmContextService;

// Named exports for testing
export { VoiceTurnWarmContextService };

// Made with Bob
