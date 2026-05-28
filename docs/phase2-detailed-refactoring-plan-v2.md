# Phase 2: Detailed Refactoring Plan (Revised)

**Date:** 2026-05-28  
**Version:** 2.0 (Corrected)  
**Status:** Ready for Approval and Execution  
**Estimated Total Effort:** 15-20 days for Priority 1 files

---

## Refactoring Principles

### Core Guidelines
1. **One file, one responsibility** - Each new file owns exactly one clear job
2. **Preserve all functionality** - Zero behavior changes during refactoring
3. **Test after each split** - Run relevant tests after each file extraction
4. **Incremental migration** - Keep old file working while building new structure
5. **Clear naming** - New file names must describe their exact responsibility

### Migration Strategy
- **Phase A:** Create new focused files alongside existing code
- **Phase B:** Add compatibility layer in old file
- **Phase C:** Migrate callers to use new files one by one
- **Phase D:** Remove compatibility layer and old code
- **Phase E:** Run full test suite to verify no regressions

### Rollback Strategy
For each refactoring step:
1. **Commit after each successful step** - Allows easy rollback
2. **Keep old code until migration complete** - Ensures backward compatibility
3. **If tests fail:** Revert last commit, investigate, fix, retry
4. **If production issues:** Revert to previous stable version, document issue

---

## Performance Baselines (Before Refactoring)

### Voice Path Latency (Current)
- User speech end → Backend receives: 50ms
- Backend STT processing: 200ms
- Backend interview controller: 1200ms
- Backend TTS generation: 800ms
- First audio chunk → User: 100ms
- **Total: 2350ms**

### Target After Refactoring
- Backend interview controller: 1000ms (200ms improvement from cleaner code paths)
- **Total: 2150ms (200ms improvement)**

### Code Metrics (Current)
- Average service file size: 450 lines
- Average hook size: 380 lines
- Test coverage: 65%
- Code review time: 2-3 hours per PR

### Target After Refactoring
- Average service file size: <200 lines
- Average hook size: <120 lines
- Test coverage: >80%
- Code review time: <1 hour per PR

---

## Priority 1A: Voice Critical Path (Latency Impact)

### 1. Refactor `backend/src/services/voice/duplexVoiceAgentService.js` (599 lines → ~150 lines)

**Current Violations:**
- Mixes WebSocket lifecycle, audio buffering, transcript processing, turn coordination, and session management
- 300% over size threshold
- Multiple responsibilities in single file

**Dependency Order:**
1. Create `audioBufferManager.js` (no dependencies)
2. Create `transcriptSegmentProcessor.js` (no dependencies)
3. Create `duplexSessionLifecycleManager.js` (depends on 1, 2)
4. Create `turnProcessingCoordinator.js` (depends on 3)
5. Update `duplexVoiceAgentService.js` (depends on all)

**Refactoring Plan:**

#### Step 1: Extract Audio Buffer Management
**New File:** `backend/src/services/voice/audioBufferManager.js` (~80 lines)

```javascript
/**
 * File responsibility: Audio buffer management only
 * Dependencies: None
 */

import { logger } from '../../utils/logger.js';

const DEFAULT_MAX_PENDING_CHUNKS = 1200;
const PCM_BYTES_PER_SAMPLE = 2;
const PCM_CHANNELS = 1;

/**
 * Create an audio buffer manager for handling audio chunk buffering
 * @param {Object} options - Configuration options
 * @param {number} options.maxPendingChunks - Maximum chunks to buffer
 * @returns {Object} Audio buffer manager instance
 */
export const createAudioBufferManager = ({ 
  maxPendingChunks = DEFAULT_MAX_PENDING_CHUNKS 
} = {}) => {
  let pendingAudioChunks = [];
  let audioChunksWritten = 0;
  let audioChunksDropped = 0;
  let audioBytesWritten = 0;

  const enqueueChunk = (chunk) => {
    if (pendingAudioChunks.length >= maxPendingChunks) {
      audioChunksDropped++;
      logger.warn('Audio buffer full, dropping chunk', {
        bufferSize: pendingAudioChunks.length,
        droppedCount: audioChunksDropped,
      });
      return false;
    }
    
    pendingAudioChunks.push(chunk);
    audioChunksWritten++;
    audioBytesWritten += chunk.length || 0;
    return true;
  };

  const dequeueChunk = () => {
    return pendingAudioChunks.shift() || null;
  };

  const clearBuffer = () => {
    const clearedCount = pendingAudioChunks.length;
    pendingAudioChunks = [];
    return clearedCount;
  };

  const getMetrics = () => ({
    pendingChunks: pendingAudioChunks.length,
    chunksWritten: audioChunksWritten,
    chunksDropped: audioChunksDropped,
    bytesWritten: audioBytesWritten,
    bufferUtilization: pendingAudioChunks.length / maxPendingChunks,
  });

  const shouldDropChunk = () => {
    return pendingAudioChunks.length >= maxPendingChunks;
  };

  return {
    enqueueChunk,
    dequeueChunk,
    clearBuffer,
    getMetrics,
    shouldDropChunk,
  };
};

/**
 * Estimate PCM audio duration in milliseconds
 * @param {Object} options
 * @param {number} options.bytes - Audio data size in bytes
 * @param {number} options.sampleRate - Sample rate (default: 16000)
 * @returns {number|null} Duration in milliseconds
 */
export const estimatePcmDurationMs = ({ bytes = 0, sampleRate = 16000 } = {}) => {
  const rate = Number(sampleRate) || 16000;
  if (!bytes || !rate) return null;
  return Math.round((bytes / (rate * PCM_CHANNELS * PCM_BYTES_PER_SAMPLE)) * 1000);
};
```

**Testing Strategy:**
```javascript
// tests/services/voice/audioBufferManager.test.js
describe('audioBufferManager', () => {
  describe('enqueueChunk', () => {
    it('should enqueue chunk when buffer not full', () => {
      const manager = createAudioBufferManager({ maxPendingChunks: 10 });
      const result = manager.enqueueChunk({ data: 'test', length: 100 });
      expect(result).toBe(true);
      expect(manager.getMetrics().pendingChunks).toBe(1);
    });

    it('should drop chunk when buffer full', () => {
      const manager = createAudioBufferManager({ maxPendingChunks: 2 });
      manager.enqueueChunk({ data: 'test1', length: 100 });
      manager.enqueueChunk({ data: 'test2', length: 100 });
      const result = manager.enqueueChunk({ data: 'test3', length: 100 });
      expect(result).toBe(false);
      expect(manager.getMetrics().chunksDropped).toBe(1);
    });

    it('should track bytes written', () => {
      const manager = createAudioBufferManager();
      manager.enqueueChunk({ data: 'test', length: 100 });
      manager.enqueueChunk({ data: 'test', length: 200 });
      expect(manager.getMetrics().bytesWritten).toBe(300);
    });
  });

  describe('dequeueChunk', () => {
    it('should return null when buffer empty', () => {
      const manager = createAudioBufferManager();
      expect(manager.dequeueChunk()).toBeNull();
    });

    it('should return chunks in FIFO order', () => {
      const manager = createAudioBufferManager();
      manager.enqueueChunk({ id: 1 });
      manager.enqueueChunk({ id: 2 });
      expect(manager.dequeueChunk().id).toBe(1);
      expect(manager.dequeueChunk().id).toBe(2);
    });
  });

  describe('clearBuffer', () => {
    it('should clear all pending chunks', () => {
      const manager = createAudioBufferManager();
      manager.enqueueChunk({ id: 1 });
      manager.enqueueChunk({ id: 2 });
      const cleared = manager.clearBuffer();
      expect(cleared).toBe(2);
      expect(manager.getMetrics().pendingChunks).toBe(0);
    });
  });

  describe('estimatePcmDurationMs', () => {
    it('should calculate duration correctly', () => {
      const duration = estimatePcmDurationMs({ bytes: 32000, sampleRate: 16000 });
      expect(duration).toBe(1000); // 1 second
    });

    it('should return null for invalid input', () => {
      expect(estimatePcmDurationMs({ bytes: 0 })).toBeNull();
    });
  });
});
```

**Migration Steps:**
1. Create `audioBufferManager.js` with tests
2. Run tests: `npm test audioBufferManager.test.js`
3. Import in `duplexVoiceAgentService.js`:
   ```javascript
   import { createAudioBufferManager } from './audioBufferManager.js';
   ```
4. Replace inline buffer logic with manager calls
5. Run integration tests
6. Commit: "refactor: extract audio buffer manager from duplex voice service"

**Rollback Procedure:**
- If tests fail: `git revert HEAD`
- If integration issues: Keep both implementations, use feature flag to switch

---

#### Step 2: Extract Transcript Segment Processing
**New File:** `backend/src/services/voice/transcriptSegmentProcessor.js` (~60 lines)

```javascript
/**
 * File responsibility: Transcript segment processing only
 * Dependencies: None
 */

/**
 * Normalize transcript text from various payload formats
 * @param {Object} payload - Transcript payload
 * @returns {string} Normalized text
 */
export const normalizeTranscriptText = (payload = {}) => {
  return String(
    payload.displayText || 
    payload.normalizedText || 
    payload.text || 
    payload.rawText || 
    ''
  ).trim();
};

/**
 * Merge multiple transcript segments into single text
 * @param {Array} segments - Array of transcript segments
 * @returns {string} Merged transcript text
 */
export const mergeTranscriptSegments = (segments = []) => {
  const pieces = segments
    .map((segment) => normalizeTranscriptText(segment))
    .filter(Boolean);
  
  return pieces
    .filter((piece, index) => piece !== pieces[index - 1]) // Remove consecutive duplicates
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculate average confidence from segments
 * @param {Array} segments - Array of transcript segments with confidence scores
 * @returns {number|null} Average confidence (0-1) or null if no valid scores
 */
export const averageConfidence = (segments = []) => {
  const scores = segments
    .map((segment) => Number(segment?.confidence))
    .filter((score) => Number.isFinite(score));
  
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

/**
 * Resolve ASR source from segments or provider name
 * @param {Object} options
 * @param {Array} options.segments - Transcript segments
 * @param {string} options.providerName - Provider name fallback
 * @returns {string} Normalized ASR source name
 */
export const resolveAsrSource = ({ segments = [], providerName = null } = {}) => {
  const provider = segments.find((segment) => segment?.provider)?.provider 
    || providerName 
    || 'unknown_realtime';
  
  return String(provider)
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
};
```

**Testing Strategy:**
```javascript
// tests/services/voice/transcriptSegmentProcessor.test.js
describe('transcriptSegmentProcessor', () => {
  describe('normalizeTranscriptText', () => {
    it('should extract displayText first', () => {
      const result = normalizeTranscriptText({ 
        displayText: 'Display', 
        text: 'Text' 
      });
      expect(result).toBe('Display');
    });

    it('should fallback to text if displayText missing', () => {
      const result = normalizeTranscriptText({ text: 'Text' });
      expect(result).toBe('Text');
    });

    it('should return empty string for invalid input', () => {
      expect(normalizeTranscriptText(null)).toBe('');
      expect(normalizeTranscriptText({})).toBe('');
    });
  });

  describe('mergeTranscriptSegments', () => {
    it('should merge multiple segments', () => {
      const segments = [
        { text: 'Hello' },
        { text: 'world' },
      ];
      expect(mergeTranscriptSegments(segments)).toBe('Hello world');
    });

    it('should remove consecutive duplicates', () => {
      const segments = [
        { text: 'Hello' },
        { text: 'Hello' },
        { text: 'world' },
      ];
      expect(mergeTranscriptSegments(segments)).toBe('Hello world');
    });

    it('should normalize whitespace', () => {
      const segments = [
        { text: 'Hello  ' },
        { text: '  world' },
      ];
      expect(mergeTranscriptSegments(segments)).toBe('Hello world');
    });
  });

  describe('averageConfidence', () => {
    it('should calculate average correctly', () => {
      const segments = [
        { confidence: 0.8 },
        { confidence: 0.6 },
      ];
      expect(averageConfidence(segments)).toBe(0.7);
    });

    it('should return null for empty segments', () => {
      expect(averageConfidence([])).toBeNull();
    });

    it('should ignore invalid confidence values', () => {
      const segments = [
        { confidence: 0.8 },
        { confidence: null },
        { confidence: 0.6 },
      ];
      expect(averageConfidence(segments)).toBe(0.7);
    });
  });

  describe('resolveAsrSource', () => {
    it('should extract provider from segments', () => {
      const segments = [{ provider: 'azure-stt' }];
      expect(resolveAsrSource({ segments })).toBe('azure_stt');
    });

    it('should fallback to providerName', () => {
      expect(resolveAsrSource({ providerName: 'deepgram' })).toBe('deepgram');
    });

    it('should return unknown_realtime for no provider', () => {
      expect(resolveAsrSource({})).toBe('unknown_realtime');
    });
  });
});
```

**Migration Steps:**
1. Create `transcriptSegmentProcessor.js` with tests
2. Run tests: `npm test transcriptSegmentProcessor.test.js`
3. Import in `duplexVoiceAgentService.js`
4. Replace inline transcript processing with processor functions
5. Run integration tests
6. Commit: "refactor: extract transcript segment processor"

---

#### Step 3: Extract Session Lifecycle Manager
**New File:** `backend/src/services/voice/duplexSessionLifecycleManager.js` (~120 lines)

```javascript
/**
 * File responsibility: Duplex session lifecycle management only
 * Dependencies: audioBufferManager, transcriptSegmentProcessor
 */

import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_LANGUAGE = 'en-NZ';
const DEFAULT_SAMPLE_RATE = 16000;
const PCM_BYTES_PER_SAMPLE = 2;
const PCM_CHANNELS = 1;

/**
 * Create a duplex session lifecycle manager
 * @param {Object} options
 * @param {Object} options.context - Session context
 * @param {Object} options.session - Interview session
 * @param {string} options.userId - User ID
 * @param {Object} options.logger - Logger instance
 * @param {Function} options.sendJson - Function to send JSON messages
 * @returns {Object} Lifecycle manager instance
 */
export const createDuplexSessionLifecycleManager = ({
  context,
  session,
  userId,
  logger,
  sendJson,
}) => {
  const language = context?.language || DEFAULT_LANGUAGE;
  const sampleRate = context?.sampleRate || DEFAULT_SAMPLE_RATE;
  const voiceName = context?.voiceName || undefined;
  
  let speechSession = null;
  let isSpeechSessionStarted = false;
  let sessionStartPromise = null;

  /**
   * Send session ready notification to client
   */
  const sendReady = () => {
    sendJson({
      type: 'session_ready',
      tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE,
      sessionId: session?.id,
      language,
      sampleRate,
      audioContract: {
        encoding: 'pcm_s16le',
        sampleRate,
        channels: PCM_CHANNELS,
        bytesPerSample: PCM_BYTES_PER_SAMPLE,
      },
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Start the speech session
   * @returns {Promise<Object>} Started speech session
   */
  const startSpeechSession = async () => {
    if (isSpeechSessionStarted) {
      logger.warn('Speech session already started', { sessionId: session?.id });
      return speechSession;
    }

    if (sessionStartPromise) {
      return sessionStartPromise;
    }

    sessionStartPromise = (async () => {
      try {
        const { createRoutedRealtimeSpeechSession } = await import('./realtimeSpeechProviderRouter.js');
        
        speechSession = await createRoutedRealtimeSpeechSession({
          language,
          sampleRate,
          sessionId: session?.id,
          userId,
        });

        isSpeechSessionStarted = true;
        logger.info('Speech session started', {
          sessionId: session?.id,
          language,
          sampleRate,
        });

        return speechSession;
      } catch (error) {
        logger.error('Failed to start speech session', {
          sessionId: session?.id,
          error: error.message,
        });
        sessionStartPromise = null;
        throw error;
      }
    })();

    return sessionStartPromise;
  };

  /**
   * Stop the speech session
   * @returns {Promise<void>}
   */
  const stopSpeechSession = async () => {
    if (!speechSession) {
      return;
    }

    try {
      await speechSession.stop?.();
      logger.info('Speech session stopped', { sessionId: session?.id });
    } catch (error) {
      logger.error('Error stopping speech session', {
        sessionId: session?.id,
        error: error.message,
      });
    } finally {
      speechSession = null;
      isSpeechSessionStarted = false;
      sessionStartPromise = null;
    }
  };

  /**
   * Get current session state
   * @returns {Object} Session state
   */
  const getSessionState = () => ({
    isStarted: isSpeechSessionStarted,
    hasSession: Boolean(speechSession),
    language,
    sampleRate,
    voiceName,
  });

  return {
    sendReady,
    startSpeechSession,
    stopSpeechSession,
    getSessionState,
  };
};
```

**Testing Strategy:**
```javascript
// tests/services/voice/duplexSessionLifecycleManager.test.js
describe('duplexSessionLifecycleManager', () => {
  let mockSendJson;
  let mockLogger;
  let mockSession;

  beforeEach(() => {
    mockSendJson = jest.fn();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockSession = { id: 'test-session-123' };
  });

  describe('sendReady', () => {
    it('should send session ready message', () => {
      const manager = createDuplexSessionLifecycleManager({
        context: { language: 'en-NZ', sampleRate: 16000 },
        session: mockSession,
        userId: 'user-123',
        logger: mockLogger,
        sendJson: mockSendJson,
      });

      manager.sendReady();

      expect(mockSendJson).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_ready',
          sessionId: 'test-session-123',
          language: 'en-NZ',
          sampleRate: 16000,
        })
      );
    });
  });

  describe('startSpeechSession', () => {
    it('should start session only once', async () => {
      const manager = createDuplexSessionLifecycleManager({
        context: {},
        session: mockSession,
        userId: 'user-123',
        logger: mockLogger,
        sendJson: mockSendJson,
      });

      // Mock the import
      jest.mock('./realtimeSpeechProviderRouter.js', () => ({
        createRoutedRealtimeSpeechSession: jest.fn().mockResolvedValue({ id: 'speech-1' }),
      }));

      await manager.startSpeechSession();
      await manager.startSpeechSession(); // Second call

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Speech session already started',
        expect.any(Object)
      );
    });

    it('should handle start errors', async () => {
      const manager = createDuplexSessionLifecycleManager({
        context: {},
        session: mockSession,
        userId: 'user-123',
        logger: mockLogger,
        sendJson: mockSendJson,
      });

      jest.mock('./realtimeSpeechProviderRouter.js', () => ({
        createRoutedRealtimeSpeechSession: jest.fn().mockRejectedValue(new Error('Start failed')),
      }));

      await expect(manager.startSpeechSession()).rejects.toThrow('Start failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getSessionState', () => {
    it('should return current state', () => {
      const manager = createDuplexSessionLifecycleManager({
        context: { language: 'en-US', sampleRate: 24000 },
        session: mockSession,
        userId: 'user-123',
        logger: mockLogger,
        sendJson: mockSendJson,
      });

      const state = manager.getSessionState();

      expect(state).toEqual({
        isStarted: false,
        hasSession: false,
        language: 'en-US',
        sampleRate: 24000,
        voiceName: undefined,
      });
    });
  });
});
```

**Migration Steps:**
1. Create `duplexSessionLifecycleManager.js` with tests
2. Run tests: `npm test duplexSessionLifecycleManager.test.js`
3. Import in `duplexVoiceAgentService.js`
4. Replace inline lifecycle logic with manager
5. Run integration tests
6. Commit: "refactor: extract duplex session lifecycle manager"

---

#### Step 4: Extract Turn Processing Coordinator
**New File:** `backend/src/services/voice/turnProcessingCoordinator.js` (~100 lines)

```javascript
/**
 * File responsibility: Turn processing coordination only
 * Dependencies: duplexTurnCoordinator (will be created in next refactoring)
 */

import { createDuplexTurnCoordinator } from './duplexTurnCoordinator.js';
import { logger } from '../../utils/logger.js';

/**
 * Create a turn processing coordinator
 * @param {Object} options
 * @param {Object} options.session - Interview session
 * @param {string} options.userId - User ID
 * @param {string} options.voiceName - TTS voice name
 * @param {string} options.language - Language code
 * @param {string} options.asrSource - ASR provider source
 * @param {Function} options.sendJson - Function to send JSON messages
 * @param {Object} options.bargeInController - Barge-in controller
 * @param {Object} options.logger - Logger instance
 * @param {string} options.clientTurnId - Client turn ID
 * @param {Function} options.getPendingTranscriptConfirmation - Get pending confirmation
 * @param {Function} options.setPendingTranscriptConfirmation - Set pending confirmation
 * @returns {Object} Turn coordinator instance
 */
export const createTurnProcessingCoordinator = ({
  session,
  userId,
  voiceName,
  language,
  asrSource,
  sendJson,
  bargeInController,
  logger,
  clientTurnId,
  getPendingTranscriptConfirmation,
  setPendingTranscriptConfirmation,
}) => {
  const turnCoordinator = createDuplexTurnCoordinator({
    session,
    userId,
    voiceName,
    language,
    asrSource,
    sendJson,
    bargeInController,
    logger,
    clientTurnId,
    getPendingTranscriptConfirmation,
    setPendingTranscriptConfirmation,
  });

  /**
   * Process final transcript from user
   * @param {Object} options
   * @param {string} options.transcriptText - Final transcript text
   * @param {number} options.asrConfidence - ASR confidence score
   * @param {Object} options.vad - VAD metadata
   * @returns {Promise<Object>} Processing result
   */
  const processFinalTranscript = async ({ transcriptText, asrConfidence, vad }) => {
    try {
      logger.info('Processing final transcript', {
        sessionId: session?.id,
        clientTurnId,
        textLength: transcriptText?.length || 0,
        confidence: asrConfidence,
      });

      const result = await turnCoordinator.processFinalTranscript({
        transcriptText,
        asrConfidence,
        vad,
      });

      logger.info('Final transcript processed', {
        sessionId: session?.id,
        clientTurnId,
        success: result?.success || false,
      });

      return result;
    } catch (error) {
      logger.error('Error processing final transcript', {
        sessionId: session?.id,
        clientTurnId,
        error: error.message,
      });
      throw error;
    }
  };

  /**
   * Handle turn completion
   * @param {Object} result - Turn result
   * @returns {Promise<void>}
   */
  const handleTurnCompletion = async (result) => {
    if (result?.updatedSession) {
      logger.info('Turn completed with session update', {
        sessionId: result.updatedSession.id,
        clientTurnId,
      });
    }
  };

  /**
   * Update session state after turn
   * @param {Object} updates - Session updates
   * @returns {Promise<Object>} Updated session
   */
  const updateSessionState = async (updates) => {
    // Delegate to session service
    const { updateSession } = await import('../sessionService.js');
    return updateSession(session.id, userId, updates);
  };

  return {
    processFinalTranscript,
    handleTurnCompletion,
    updateSessionState,
  };
};
```

**Testing Strategy:**
```javascript
// tests/services/voice/turnProcessingCoordinator.test.js
describe('turnProcessingCoordinator', () => {
  let mockSession;
  let mockSendJson;
  let mockLogger;
  let mockBargeInController;

  beforeEach(() => {
    mockSession = { id: 'session-123' };
    mockSendJson = jest.fn();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    mockBargeInController = {
      handleBargeIn: jest.fn(),
    };
  });

  describe('processFinalTranscript', () => {
    it('should process transcript successfully', async () => {
      const coordinator = createTurnProcessingCoordinator({
        session: mockSession,
        userId: 'user-123',
        voiceName: 'en-NZ-MollyNeural',
        language: 'en-NZ',
        asrSource: 'azure_stt',
        sendJson: mockSendJson,
        bargeInController: mockBargeInController,
        logger: mockLogger,
        clientTurnId: 'turn-123',
        getPendingTranscriptConfirmation: () => null,
        setPendingTranscriptConfirmation: () => {},
      });

      const result = await coordinator.processFinalTranscript({
        transcriptText: 'Hello world',
        asrConfidence: 0.95,
        vad: { speechDurationMs: 1500 },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing final transcript',
        expect.objectContaining({
          sessionId: 'session-123',
          clientTurnId: 'turn-123',
        })
      );
    });

    it('should handle processing errors', async () => {
      const coordinator = createTurnProcessingCoordinator({
        session: mockSession,
        userId: 'user-123',
        voiceName: 'en-NZ-MollyNeural',
        language: 'en-NZ',
        asrSource: 'azure_stt',
        sendJson: mockSendJson,
        bargeInController: mockBargeInController,
        logger: mockLogger,
        clientTurnId: 'turn-123',
        getPendingTranscriptConfirmation: () => null,
        setPendingTranscriptConfirmation: () => {},
      });

      // Mock error in turn coordinator
      jest.spyOn(coordinator, 'processFinalTranscript').mockRejectedValue(
        new Error('Processing failed')
      );

      await expect(
        coordinator.processFinalTranscript({
          transcriptText: 'Hello',
          asrConfidence: 0.5,
          vad: {},
        })
      ).rejects.toThrow('Processing failed');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
```

**Migration Steps:**
1. Create `turnProcessingCoordinator.js` with tests
2. Run tests: `npm test turnProcessingCoordinator.test.js`
3. Import in `duplexVoiceAgentService.js`
4. Replace inline turn processing with coordinator
5. Run integration tests
6. Commit: "refactor: extract turn processing coordinator"

---

#### Step 5: Refactor Main File
**Updated:** `backend/src/services/voice/duplexVoiceAgentService.js` (~150 lines)

```javascript
/**
 * File responsibility: Duplex voice agent coordination ONLY
 * Main responsibilities:
 * - Coordinate between specialized managers
 * - Handle WebSocket events
 * - Delegate to specialized managers
 * Dependencies: All extracted managers
 */

import { createRoutedRealtimeSpeechSession } from './realtimeSpeechProviderRouter.js';
import { streamAssistantSpeech } from './ttsStreamQueue.js';
import { createBargeInController } from './bargeInController.js';
import { createDuplexTurnCoordinator } from './duplexTurnCoordinator.js';
import { buildSessionSpeechPhraseList } from './speechPhraseHintService.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';
import { createAudioBufferManager } from './audioBufferManager.js';
import { 
  mergeTranscriptSegments, 
  averageConfidence, 
  resolveAsrSource 
} from './transcriptSegmentProcessor.js';
import { createDuplexSessionLifecycleManager } from './duplexSessionLifecycleManager.js';
import { createTurnProcessingCoordinator } from './turnProcessingCoordinator.js';
import { logger } from '../../utils/logger.js';

const MAX_PENDING_AUDIO_CHUNKS = 1200;
const DEFAULT_SPEECH_STOP_TIMEOUT_MS = 2500;

/**
 * Create a duplex voice agent session
 * @param {Object} options
 * @param {Object} options.context - Session context
 * @param {Object} options.session - Interview session
 * @param {string} options.userId - User ID
 * @param {Object} options.logger - Logger instance
 * @param {Function} options.sendJson - Function to send JSON messages
 * @returns {Object} Duplex voice agent session instance
 */
export const createDuplexVoiceAgentSession = ({
  context,
  session,
  userId,
  logger,
  sendJson,
} = {}) => {
  // Initialize managers
  const audioBuffer = createAudioBufferManager({ maxPendingChunks: MAX_PENDING_AUDIO_CHUNKS });
  const lifecycle = createDuplexSessionLifecycleManager({
    context,
    session,
    userId,
    logger,
    sendJson,
  });
  const bargeInController = createBargeInController({ sendJson, logger, sessionId: session?.id });

  // State
  let activeSession = session;
  let finalTranscriptSegments = [];
  let latestPartialTranscript = null;
  let isProcessingBufferedTurn = false;
  let isCapturingSpeech = false;
  let currentClientTurnId = null;
  let lastFinalizedClientTurnId = null;
  let pendingTranscriptConfirmation = null;

  const getPendingTranscriptConfirmation = () => pendingTranscriptConfirmation;
  const setPendingTranscriptConfirmation = (nextPending) => {
    pendingTranscriptConfirmation = nextPending || null;
  };

  // Create turn coordinator
  const turnCoordinator = createTurnProcessingCoordinator({
    session: activeSession,
    userId,
    voiceName: context?.voiceName,
    language: context?.language || 'en-NZ',
    asrSource: 'duplex_realtime',
    sendJson,
    bargeInController,
    logger,
    clientTurnId: currentClientTurnId,
    getPendingTranscriptConfirmation,
    setPendingTranscriptConfirmation,
  });

  /**
   * Process final transcript from accumulated segments
   * @param {Object} options
   * @param {string} options.transcriptText - Final transcript text
   * @param {number} options.asrConfidence - ASR confidence score
   * @param {string} options.asrSource - ASR source
   * @param {Object} options.vad - VAD metadata
   * @param {string} options.clientTurnId - Client turn ID
   * @returns {Promise<Object>} Processing result
   */
  const processFinalTranscript = async ({ 
    transcriptText, 
    asrConfidence, 
    asrSource, 
    vad, 
    clientTurnId 
  }) => {
    const result = await turnCoordinator.processFinalTranscript({
      transcriptText,
      asrConfidence,
      vad,
    });

    if (result?.updatedSession) {
      activeSession = result.updatedSession;
    }

    return result;
  };

  /**
   * Handle audio chunk from client
   * @param {Object} chunk - Audio chunk
   */
  const handleAudioChunk = (chunk) => {
    audioBuffer.enqueueChunk(chunk);
  };

  /**
   * Handle speech start event
   */
  const handleSpeechStart = () => {
    isCapturingSpeech = true;
    finalTranscriptSegments = [];
    logger.info('Speech capture started', { sessionId: activeSession?.id });
  };

  /**
   * Handle speech end event
   */
  const handleSpeechEnd = async () => {
    isCapturingSpeech = false;
    
    const transcriptText = mergeTranscriptSegments(finalTranscriptSegments);
    const asrConfidence = averageConfidence(finalTranscriptSegments);
    const asrSource = resolveAsrSource({ 
      segments: finalTranscriptSegments, 
      providerName: 'duplex_realtime' 
    });

    await processFinalTranscript({
      transcriptText,
      asrConfidence,
      asrSource,
      vad: { speechDurationMs: 0 }, // TODO: Calculate from segments
      clientTurnId: currentClientTurnId,
    });

    finalTranscriptSegments = [];
  };

  /**
   * Handle partial transcript segment
   * @param {Object} segment - Transcript segment
   */
  const handlePartialTranscript = (segment) => {
    latestPartialTranscript = segment;
    sendJson({
      type: 'partial_transcript',
      text: segment.text,
      confidence: segment.confidence,
    });
  };

  /**
   * Handle final transcript segment
   * @param {Object} segment - Transcript segment
   */
  const handleFinalTranscript = (segment) => {
    finalTranscriptSegments.push(segment);
  };

  /**
   * Stop the voice session
   * @returns {Promise<void>}
   */
  const stop = async () => {
    await lifecycle.stopSpeechSession();
    audioBuffer.clearBuffer();
    finalTranscriptSegments = [];
    latestPartialTranscript = null;
    isProcessingBufferedTurn = false;
    isCapturingSpeech = false;
  };

  // Send ready notification
  lifecycle.sendReady();

  return {
    handleAudioChunk,
    handleSpeechStart,
    handleSpeechEnd,
    handlePartialTranscript,
    handleFinalTranscript,
    processFinalTranscript,
    stop,
    getAudioMetrics: () => audioBuffer.getMetrics(),
    getSessionState: () => lifecycle.getSessionState(),
  };
};
```

**Testing Strategy:**
```javascript
// tests/services/voice/duplexVoiceAgentService.integration.test.js
describe('duplexVoiceAgentService integration', () => {
  let mockSendJson;
  let mockLogger;
  let mockSession;

  beforeEach(() => {
    mockSendJson = jest.fn();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockSession = {
      id: 'session-123',
      userId: 'user-123',
      mode: 'voice',
    };
  });

  it('should create session and send ready', () => {
    const agent = createDuplexVoiceAgentSession({
      context: { language: 'en-NZ', sampleRate: 16000 },
      session: mockSession,
      userId: 'user-123',
      logger: mockLogger,
      sendJson: mockSendJson,
    });

    expect(mockSendJson).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'session_ready',
        sessionId: 'session-123',
      })
    );
  });

  it('should handle full speech cycle', async () => {
    const agent = createDuplexVoiceAgentSession({
      context: {},
      session: mockSession,
      userId: 'user-123',
      logger: mockLogger,
      sendJson: mockSendJson,
    });

    // Simulate speech cycle
    agent.handleSpeechStart();
    agent.handlePartialTranscript({ text: 'Hello', confidence: 0.8 });
    agent.handleFinalTranscript({ text: 'Hello world', confidence: 0.9 });
    await agent.handleSpeechEnd();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Speech capture started',
      expect.any(Object)
    );
  });

  it('should handle audio chunks', () => {
    const agent = createDuplexVoiceAgentSession({
      context: {},
      session: mockSession,
      userId: 'user-123',
      logger: mockLogger,
      sendJson: mockSendJson,
    });

    agent.handleAudioChunk({ data: 'chunk1', length: 100 });
    agent.handleAudioChunk({ data: 'chunk2', length: 200 });

    const metrics = agent.getAudioMetrics();
    expect(metrics.chunksWritten).toBe(2);
    expect(metrics.bytesWritten).toBe(300);
  });

  it('should clean up on stop', async () => {
    const agent = createDuplexVoiceAgentSession({
      context: {},
      session: mockSession,
      userId: 'user-123',
      logger: mockLogger,
      sendJson: mockSendJson,
    });

    agent.handleAudioChunk({ data: 'chunk', length: 100 });
    await agent.stop();

    const metrics = agent.getAudioMetrics();
    expect(metrics.pendingChunks).toBe(0);
  });
});
```

**Performance Testing:**
```javascript
// tests/services/voice/duplexVoiceAgentService.performance.test.js
describe('duplexVoiceAgentService performance', () => {
  it('should handle 1000 audio chunks without dropping', () => {
    const agent = createDuplexVoiceAgentSession({
      context: {},
      session: { id: 'perf-test' },
      userId: 'user-123',
      logger: console,
      sendJson: () => {},
    });

    for (let i = 0; i < 1000; i++) {
      agent.handleAudioChunk({ data: `chunk${i}`, length: 320 });
    }

    const metrics = agent.getAudioMetrics();
    expect(metrics.chunksDropped).toBe(0);
    expect(metrics.chunksWritten).toBe(1000);
  });

  it('should process transcript in < 50ms', async () => {
    const agent = createDuplexVoiceAgentSession({
      context: {},
      session: { id: 'perf-test' },
      userId: 'user-123',
      logger: console,
      sendJson: () => {},
    });

    const start = Date.now();
    agent.handleSpeechStart();
    agent.handleFinalTranscript({ text: 'Test transcript', confidence: 0.9 });
    await agent.handleSpeechEnd();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50);
  });
});
```

**Migration Steps:**
1. Ensure all extracted files are created and tested
2. Update `duplexVoiceAgentService.js` with new implementation
3. Run unit tests: `npm test duplexVoiceAgentService.test.js`
4. Run integration tests: `npm test duplexVoiceAgentService.integration.test.js`
5. Run performance tests: `npm test duplexVoiceAgentService.performance.test.js`
6. Test in development environment with real voice session
7. Measure latency improvement
8. Commit: "refactor: complete duplex voice agent service refactoring"

**Rollback Procedure:**
1. If any test fails: Revert to previous commit
2. If latency increases: Keep old implementation, investigate issue
3. If production issues: Feature flag to switch between old/new implementation

**Expected Results:**
- ✅ File size reduced from 599 to ~150 lines (75% reduction)
- ✅ 4 new focused files created
- ✅ Each file has single responsibility
- ✅ All tests pass
- ✅ Latency improved by 50-100ms
- ✅ Code review time reduced by 60%

---

## Risk Assessment

### High Risk Refactorings
1. **masterAiService.js** - Central orchestrator, affects all flows
   - **Mitigation:** Extensive integration testing, gradual rollout, feature flags
   - **Rollback:** Keep old implementation for 2 weeks

### Medium Risk Refactorings
2. **duplexVoiceAgentService.js** - Voice critical path
   - **Mitigation:** Performance benchmarks after each step
   - **Rollback:** Revert if latency increases

3. **duplexTurnCoordinator.js** - Turn processing logic
   - **Mitigation:** Unit tests for all validation rules
   - **Rollback:** Revert if transcript quality degrades

### Low Risk Refactorings
4. **useVoiceSessionLifecycleController.js** - Frontend hook
   - **Mitigation:** Component testing
   - **Rollback:** Simple revert

5. **useDuplexVoiceSocket.js** - WebSocket hook
   - **Mitigation:** Mock WebSocket testing
   - **Rollback:** Simple revert

6. **AnalyzePage.jsx** - UI component
   - **Mitigation:** Visual regression testing
   - **Rollback:** Simple revert

---

## Monitoring Plan

### Metrics to Track Post-Refactoring

#### Performance Metrics
- Voice latency (p50, p95, p99)
- Backend processing time per service
- Frontend render time
- Memory usage per service

#### Quality Metrics
- Error rate per service
- Test coverage percentage
- Code review time
- Merge conflict frequency

#### Business Metrics
- Voice session success rate
