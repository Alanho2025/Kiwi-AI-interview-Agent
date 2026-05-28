# Phase 2: Safe Detailed Refactoring Plan

**Date:** 2026-05-28  
**Version:** 3.0  
**Status:** Ready for review  
**Goal:** Reduce large files toward maintainable size without changing product behaviour  
**Primary target:** Files over 200 lines, especially voice, agent orchestration, parsing, matching, reporting, and frontend hooks

---

## 1. Purpose

This plan replaces the previous Phase 2 refactoring proposal.

The current codebase has several files that are too large to maintain safely. Some files exceed 200 lines and mix multiple responsibilities. This makes debugging slow, testing harder, and AI-assisted code changes riskier.

Refactoring is necessary. However, the refactor must be behaviour-preserving. The goal is to make the code easier to maintain, not to rewrite working flows.

The most important rule is simple:

> Split files safely. Do not change runtime behaviour unless the change is explicitly approved and tested.

This matters most for the voice interview flow. The current voice flow includes realtime STT, audio buffering, speech_start and speech_end state, partial transcript fallback, clientTurnId guards, TTS streaming, barge-in, and WebSocket message handling. These are user-facing critical behaviours. They must not be simplified away during refactoring.

---

## 2. Refactoring Principles

### 2.1 Core Rules

1. **Preserve external APIs**
   - Do not change exported function names.
   - Do not change handler return contracts.
   - Do not change request or WebSocket message contracts.

2. **Preserve runtime sequence**
   - Move code only when the order of events stays the same.
   - Do not move stateful logic into a new module unless tests prove the same behaviour.

3. **Prefer pure extraction first**
   - Extract pure functions before stateful managers.
   - Pure functions are safer because they do not own runtime state.

4. **Keep files focused**
   - Target file size should be under 200 lines where practical.
   - Some orchestration files may remain above 200 lines if reducing them would increase risk.

5. **One behaviour, one test**
   - Every extracted module needs focused unit tests.
   - Every critical flow needs at least one integration or robustness test.

6. **No assumed latency improvement**
   - Refactoring improves maintainability.
   - Latency improvement is optional and must be measured.
   - p95 latency must not regress.

---

## 3. Non-Negotiable Behaviour Preservation Gates

A refactor is only acceptable if all of the following remain true.

### 3.1 Voice Session Contract

`createDuplexVoiceAgentSession()` must continue to return:

```js
return { handleJsonMessage, handleBinaryAudio, close };
```

Do not replace this with lower-level methods such as `handleSpeechStart`, `handleSpeechEnd`, or `handleAudioChunk` unless all WebSocket callers are updated in the same commit and covered by tests.

### 3.2 Voice Event Sequence

The following sequence must remain intact:

```txt
session_ready
speech_start
restart or start realtime STT session
ignore pre-speech audio
buffer audio while STT starts
write audio live when STT is ready
stt_partial
stt_final
speech_end
flush pending audio before STT stop
stop realtime STT with timeout
use final transcript segments
fallback to latest partial transcript if no final exists
process final transcript
stream assistant TTS
support barge-in and cancel
close or session_stop cleanup
```

### 3.3 STT Quality Guards

The refactor must preserve:

- `buildSessionSpeechPhraseList(activeSession)`
- `extraPhrases` passed into realtime STT provider
- STT `usageContext`
- `activeSpeechCaptureId` guard
- `activeSttProviderName`
- provider-specific ASR source resolution
- partial transcript fallback when final transcript is missing

### 3.4 Turn Safety Guards

The refactor must preserve:

- generated fallback `clientTurnId` when frontend does not provide one
- duplicate `speech_start` protection
- speech_start ignored while previous turn is processing
- speech_end ignored when there is no active turn
- speech_end ignored when clientTurnId does not match
- duplicate or late speech_end ignored after finalization
- `lastFinalizedClientTurnId`
- `currentClientTurnId` reset rules

### 3.5 Audio Buffer Semantics

The refactor must preserve:

- audio before `speech_start` is ignored and counted
- audio after `speech_start` is accepted
- audio is buffered only while STT starts
- buffered audio is flushed before STT stop
- live audio is written directly to the active STT session
- dropped chunks are counted
- written chunks are counted
- total audio bytes and estimated audio duration are tracked
- audio trace logs remain available

---

## 4. Success Criteria

### 4.1 Maintainability Targets

- Reduce large files toward 200 lines where practical.
- Move reusable helpers into focused modules.
- Reduce mixed responsibilities in voice, agent, parsing, matching, and frontend hooks.
- Make tests easier to write and read.

### 4.2 Safety Targets

- No product behaviour regression.
- No change to public API unless explicitly approved.
- No change to WebSocket protocol.
- No voice transcript quality regression.
- No increase in p95 voice latency.
- No loss of telemetry needed for debugging.

### 4.3 Testing Targets

Before each commit:

```bash
npm run lint
npm run test:voice
```

Before completing each phase:

```bash
npm run test:all
npm run eval:voice-robustness
npm run eval:local
```

For backend tests, use Vitest style:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

Do not write new Jest-style tests such as `jest.fn()` or `jest.mock()`.

---

## 5. Risk Classification

### High Risk

These files affect user-facing critical flows. Refactor only after tests are in place.

- `backend/src/services/voice/duplexVoiceAgentService.js`
- `backend/src/services/voice/duplexTurnCoordinator.js`
- `backend/src/services/masterAiService.js`
- interview controller and adaptive planning services

### Medium Risk

These affect major product behaviour but can be refactored with focused tests.

- CV parsing services
- JD parsing services
- CV-JD matching services
- report generation services
- retrieval and evidence anchoring services

### Lower Risk

These can be refactored earlier if public props and UI behaviour are preserved.

- pure utility modules
- payload builders
- frontend formatting helpers
- isolated UI components
- non-critical hooks

---

## 6. Phase 1: Extract Pure Backend Helpers

**Purpose:** Reduce large files without changing runtime behaviour.

**Risk:** Low

### 6.1 Extract Transcript Segment Processing

Create:

```txt
backend/src/services/voice/transcriptSegmentProcessor.js
```

Move these pure functions from `duplexVoiceAgentService.js`:

```js
normalizeTranscriptText()
mergeTranscriptSegments()
averageConfidence()
resolveAsrSource()
```

Rules:

- Do not change function logic.
- Do not change fallback priority.
- Do not change duplicate segment handling.
- Export the same behaviour with unit tests.

Tests:

```txt
backend/tests/robustness/voice/transcriptSegmentProcessor.test.js
```

Required cases:

- `displayText` wins over `normalizedText`, `text`, and `rawText`
- fallback to `normalizedText`
- fallback to `text`
- fallback to `rawText`
- null payload returns empty string
- duplicate consecutive segments are removed
- whitespace is normalized
- average confidence ignores invalid scores
- ASR provider names are normalized from hyphen to underscore

Acceptance:

- `duplexVoiceAgentService.js` imports helpers.
- Existing voice tests pass.
- No event sequence changes.

---

### 6.2 Extract Audio Duration Utilities

Create:

```txt
backend/src/services/voice/audioDurationUtils.js
```

Move:

```js
estimatePcmDurationMs()
parsePositiveInteger()
```

Rules:

- Preserve default sample rate of 16000.
- Preserve mono PCM s16le assumptions.
- Preserve null return for invalid byte input.

Tests:

```txt
backend/tests/robustness/voice/audioDurationUtils.test.js
```

Required cases:

- 32000 bytes at 16000 Hz returns 1000 ms
- invalid bytes returns null
- invalid sample rate falls back safely
- positive integer parsing accepts valid positive values
- zero, negative, or invalid values return fallback

Acceptance:

- Existing trace logs still show estimated chunk duration and total audio duration.

---

### 6.3 Extract Voice Payload Builders

Create:

```txt
backend/src/services/voice/voicePayloadBuilders.js
```

Move only payload construction, not control flow.

Candidate builders:

```js
buildSessionReadyPayload()
buildListeningStartedPayload()
buildPongPayload()
buildSessionStoppedPayload()
buildVoiceErrorPayload()
buildAssistantTextDeltaPayload()
buildAssistantSpeechDonePayload()
```

Rules:

- Builders must be stateless.
- Builders must not call `sendJson`.
- Builders must not read or mutate session state.
- Builders only return plain objects.

Acceptance:

- `handleJsonMessage()` still controls when messages are sent.
- Message shapes remain identical.

---

## 7. Phase 2: Extract Voice Guards Without Changing Handler Contract

**Purpose:** Reduce complexity inside `handleJsonMessage()` while preserving WebSocket behaviour.

**Risk:** Medium

Create:

```txt
backend/src/services/voice/voiceTurnGuards.js
```

Move guard decision helpers only.

Candidate helpers:

```js
shouldIgnoreDuplicateSpeechStart()
shouldIgnoreSpeechStartWhileProcessing()
shouldIgnoreSpeechEndWithoutClientTurnId()
shouldIgnoreSpeechEndWithNoActiveTurn()
shouldIgnoreLateSpeechEnd()
shouldIgnoreMismatchedSpeechEnd()
```

Rules:

- Helpers return decisions only.
- Helpers do not log by themselves unless a logger is explicitly passed.
- Helpers do not mutate `currentClientTurnId`.
- Helpers do not mutate `lastFinalizedClientTurnId`.
- `handleJsonMessage()` remains the owner of state transitions.

Required tests:

```txt
backend/tests/robustness/voice/voiceTurnGuards.test.js
```

Required cases:

- duplicate speech_start is rejected while capturing
- speech_start is rejected while previous turn is processing
- speech_end with missing clientTurnId is rejected
- speech_end with no current turn is rejected
- late duplicate speech_end is rejected
- mismatched speech_end is rejected
- matching speech_end is accepted

Acceptance:

- `createDuplexVoiceAgentSession()` still returns `{ handleJsonMessage, handleBinaryAudio, close }`.
- Existing WebSocket route needs no change.
- Existing frontend needs no change.

---

## 8. Phase 3: Extract Voice Metrics and Trace Helpers

**Purpose:** Reduce logging noise in `duplexVoiceAgentService.js` while keeping debug visibility.

**Risk:** Low to medium

Create:

```txt
backend/src/services/voice/voiceAudioMetrics.js
backend/src/services/voice/voiceTracePayloads.js
```

Move metrics calculations and trace payload construction.

Candidate responsibilities:

```js
createInitialAudioMetrics()
recordWrittenAudioChunk()
recordDroppedAudioChunk()
recordIgnoredPreSpeechChunk()
resetAudioMetrics()
buildAudioChunkTracePayload()
buildAudioFlushTracePayload()
buildTurnFailureTracePayload()
```

Rules:

- Do not move STT write timing yet.
- Do not move `writeAudioChunk()` completely in this phase unless tests cover it.
- Keep trace fields stable.
- Keep `AUDIO_CONTRACT_TRACE_EVERY` behaviour stable.

Acceptance:

- Logs still include provider, source, chunk index, bytes, estimated duration, total audio ms, sample rate, and encoding.
- Voice debugging remains possible.

---

## 9. Phase 4: Extract Audio Capture Buffer Carefully

**Purpose:** Reduce audio buffering complexity after pure helpers and guards are stable.

**Risk:** High

Do not use a generic queue-only `audioBufferManager`. The current voice flow needs a capture-aware buffer.

Create:

```txt
backend/src/services/voice/duplexAudioCaptureBuffer.js
```

This module may own:

```js
queueCapturedAudio()
flushPendingAudioChunks()
clearPendingAudioChunks()
getAudioMetrics()
```

But it must preserve current semantics:

```txt
if not capturing, ignore and count pre-speech audio
if STT is ready, write live immediately
if STT is starting, buffer pending audio
if buffer is full, drop and count chunk
on speech_end, flush pending chunks before stopping STT
```

Suggested factory:

```js
export const createDuplexAudioCaptureBuffer = ({
  logger,
  getSessionId,
  getProviderName,
  getSampleRate,
  isCapturingSpeech,
  isSpeechSessionReady,
  getSpeechSession,
  startSpeechSession,
  writeAudioChunk,
  maxPendingChunks,
}) => {
  // preserve current behaviour
};
```

Important:

- The module can call injected functions.
- It should not create STT sessions directly.
- It should not know about interview turn processing.
- It should not call `processFinalTranscript()`.

Required tests:

```txt
backend/tests/robustness/voice/duplexAudioCaptureBuffer.test.js
```

Required cases:

- audio before speech_start is ignored
- first ignored pre-speech audio can be logged
- audio is buffered while STT starts
- buffered chunks flush in order
- audio writes live when STT is ready
- buffer full drops new chunks and increments dropped count
- metrics reset between turns
- flush happens before stop in integration test

Acceptance:

- No transcript loss.
- No increase in dropped chunks in normal cases.
- No regression in `eval:voice-robustness`.

---

## 10. Phase 5: Extract Speech Session Lifecycle Only After Buffer Tests Pass

**Purpose:** Reduce STT lifecycle complexity while preserving provider behaviour.

**Risk:** High

Create only after Phase 4 passes:

```txt
backend/src/services/voice/duplexSpeechSessionLifecycle.js
```

This module may own:

```js
startSpeechSession()
stopSpeechSession()
restartSpeechSessionForNewTurn()
```

It must preserve:

- `buildSessionSpeechPhraseList(activeSession)`
- `extraPhrases`
- `usageContext`
- `onPartialTranscript`
- `onFinalTranscript`
- `onError`
- `onSessionStarted`
- `onSessionStopped`
- `activeSpeechCaptureId`
- `activeSttProviderName`
- `sessionStartPromise`
- stop timeout behaviour when used by caller

Rules:

- Do not hide transcript callback behaviour inside unclear abstractions.
- Do not remove `captureId !== activeSpeechCaptureId` checks.
- Do not remove phrase hints.
- Do not remove provider name tracking.
- Do not change message type names such as `stt_partial` or `stt_final`.

Acceptance:

- STT final and partial payloads remain identical.
- Phrase hints are still sent.
- Provider-specific logs still work.
- Realtime STT restart per turn still works.

---

## 11. Phase 6: Clean Main `duplexVoiceAgentService.js`

**Purpose:** Reduce the main file after safe extractions are complete.

**Risk:** Medium to high

At this phase, `duplexVoiceAgentService.js` should mainly coordinate:

- WebSocket JSON message routing
- binary audio routing
- turn-level state transitions
- calls to extracted helper modules
- final cleanup

It should still own or clearly coordinate:

- `activeSession`
- `currentClientTurnId`
- `lastFinalizedClientTurnId`
- `isCapturingSpeech`
- `isProcessingBufferedTurn`
- `pendingTranscriptConfirmation`

Do not move all state out just to reduce line count. A smaller file with hidden state spread across too many modules is worse than a slightly larger but clear orchestrator.

Target:

```txt
duplexVoiceAgentService.js: ideally 180-260 lines after safe extraction
```

Note: The hard target is not always under 200 for critical orchestrators. For this file, safety is more important than a forced line count.

Acceptance:

- public API unchanged
- voice event sequence unchanged
- all voice tests pass
- voice robustness eval passes
- p95 voice latency does not increase

---

## 12. Phase 7: Refactor Other Large Backend Files

After voice helper extraction is stable, apply the same pattern to other files over 200 lines.

### 12.1 General Pattern

For each large file:

1. Identify pure functions.
2. Extract pure functions first.
3. Extract payload builders next.
4. Extract validation guards next.
5. Extract stateful coordination last.
6. Keep public APIs stable.
7. Add focused tests.
8. Run relevant grouped tests.

### 12.2 Candidate Areas

#### Master AI Orchestration

Potential modules:

```txt
agentIntentResolver.js
agentToolSelectionPolicy.js
agentExecutionTraceBuilder.js
agentFallbackPolicy.js
agentResponseShapeValidator.js
```

Rules:

- Do not change tool selection behaviour without eval approval.
- Do not weaken fallback behaviour.
- Do not remove evidence anchoring.

#### CV Parsing

Potential modules:

```txt
cvSectionNormalizer.js
cvSkillExtractor.js
cvExperienceExtractor.js
cvEducationExtractor.js
cvParseQualityGuards.js
```

Rules:

- Do not reduce extraction coverage.
- Do not change schema fields without updating downstream match tests.

#### JD Parsing

Potential modules:

```txt
jdRequirementExtractor.js
jdSkillNormalizer.js
jdEducationRequirementParser.js
jdSeniorityDetector.js
jdParseQualityGuards.js
```

Rules:

- Do not weaken must-have vs nice-to-have detection.
- Do not treat missing evidence as matched.

#### CV-JD Matching

Potential modules:

```txt
technicalSkillMatcher.js
softSkillMatcher.js
educationMatcher.js
experienceMatcher.js
gapEvidenceBuilder.js
matchScoreNormalizer.js
```

Rules:

- Do not mark education as matched unless at least one requirement is actually satisfied.
- Preserve evidence-based reasoning.
- Preserve human-review flags.

#### Report Generation

Potential modules:

```txt
reportSectionBuilder.js
reportEvidenceAnchorBuilder.js
reportRiskLabeler.js
reportRecommendationBuilder.js
reportHallucinationGuard.js
```

Rules:

- Do not allow unsupported claims.
- Preserve labels such as CV evidence, JD requirement, or needs user confirmation if implemented.

---

## 13. Phase 8: Frontend Hook and Component Refactoring

Frontend refactoring should also target files over 200 lines, but it must preserve UI behaviour.

### 13.1 Voice Hooks

Candidate split:

```txt
useVoiceSessionLifecycleController.js
useVoiceTurnState.js
useVoiceTranscriptState.js
useVoiceLatencyTrace.js
useVoicePlaybackState.js
useVoiceErrorState.js
```

Rules:

- Do not change microphone permission flow.
- Do not change speech_start timing.
- Do not change speech_end timing.
- Do not change first audio chunk sending behaviour.
- Do not break TTS playback start.
- Do not remove latency trace fields.

### 13.2 UI Components

For large pages:

```txt
AnalyzePage.jsx
InterviewPage.jsx
ReportPage.jsx
DashboardPage.jsx
```

Extract:

```txt
Header sections
Form sections
Result cards
Status panels
Error banners
Action buttons
```

Rules:

- Keep props simple.
- Do not move business logic into visual components.
- Do not create tiny components that only wrap one div.
- Preserve accessibility labels.

---

## 14. Commit Strategy

Use small commits. One extraction per commit.

Suggested commit style:

```txt
refactor(voice): extract transcript segment processor
refactor(voice): extract audio duration utilities
refactor(voice): extract voice payload builders
refactor(voice): extract turn guard helpers
refactor(voice): extract audio metrics helpers
refactor(voice): extract capture-aware audio buffer
refactor(voice): extract speech session lifecycle
refactor(agent): extract tool selection policy
refactor(match): extract education matcher
```

Each commit must include:

- extracted module
- updated import in original file
- focused tests
- no unrelated formatting churn

Avoid large mixed commits.

---

## 15. Rollback Strategy

For every phase:

1. Commit after tests pass.
2. If tests fail, fix before continuing.
3. If voice behaviour regresses, revert the last refactor commit.
4. If production behaviour is uncertain, keep old implementation behind a temporary feature flag.
5. Remove feature flags only after dev testing and evals pass.

For voice-specific changes, rollback threshold is strict:

- transcript becomes empty more often
- STT final stops arriving
- partial fallback stops working
- speech_end fires duplicate turns
- first TTS audio is delayed
- barge-in stops working
- p95 voice latency increases

Any of these should block the phase.

---

## 16. Required Test Commands

Run these after each backend voice phase:

```bash
npm run lint
npm run test:voice
npm run eval:voice-robustness
```

Run these before marking Phase 2 complete:

```bash
npm run test:all
npm run eval:local
```

Run real evals only when API keys and environment are available:

```bash
npm run eval:real
```

---

## 17. Definition of Done

Phase 2 refactoring is done only when:

- large files are reduced where practical
- extracted modules have clear responsibility
- public APIs remain stable
- voice WebSocket contract remains stable
- voice state machine remains stable
- tests pass
- evals pass
- no p95 latency regression is observed
- no known transcript quality regression exists
- documentation reflects the new module boundaries

---

## 18. Implementation Order Summary

Recommended order:

```txt
1. transcriptSegmentProcessor.js
2. audioDurationUtils.js
3. voicePayloadBuilders.js
4. voiceTurnGuards.js
5. voiceAudioMetrics.js
6. voiceTracePayloads.js
7. duplexAudioCaptureBuffer.js
8. duplexSpeechSessionLifecycle.js
9. final cleanup of duplexVoiceAgentService.js
10. apply same pattern to master AI, parsing, matching, reports, and frontend hooks
```

Do not start with lifecycle extraction. Do not start with a full rewrite of `duplexVoiceAgentService.js`.

---

## 19. Final Note

This refactor is approved in direction, but only under a behaviour-preserving execution model.

The codebase does need smaller files. The 200-line maintainability target is valid. However, critical files must be split like surgery, not like a blind rewrite.

For voice, correctness beats line count. A 230-line orchestrator that preserves the state machine is better than a 120-line file that hides broken behaviour across four managers.
