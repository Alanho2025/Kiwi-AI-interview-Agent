# Phase 2: Safe Detailed Refactoring Plan

**Date:** 2026-05-28  
**Version:** 3.2  
**Status:** Ready for Bob review and staged execution  
**Goal:** Reduce large files toward maintainable size without changing product behaviour  
**Primary target:** All files over 200 lines, especially voice, agent orchestration, parsing, matching, reporting, retrieval, and frontend hooks

---

## 1. Purpose

This plan replaces the previous Phase 2 refactoring proposal.

The current codebase has several files that are too large to maintain safely. Some files exceed 200 lines and mix multiple responsibilities. This makes debugging slow, testing harder, and AI-assisted code changes riskier.

Refactoring is necessary. However, the refactor must be behaviour-preserving. The goal is to make the code easier to maintain, not to rewrite working flows.

The most important rule is simple:

> Split files safely. Do not change runtime behaviour unless the change is explicitly approved and tested.

This plan applies to **all files selected for refactoring**, not only the voice service. Before Bob changes any target file, Bob must write down that file's current behaviour and map it to tests.

---

## 2. Non-Negotiable Rule: Every Target File Needs a Behaviour Contract First

Before refactoring any file over 200 lines, Bob must create a behaviour contract for that file.

A behaviour contract is a short checklist that describes what the file currently does. It must be written before code is moved.

### 2.1 Required Behaviour Contract Template

For every target file, document these items:

```txt
File path:
Current line count:
Risk level: High / Medium / Low
Current responsibility:
Public exports:
External callers:
Inputs accepted:
Outputs returned:
Events/messages emitted:
State owned:
Side effects:
Database writes/reads:
Network calls:
LLM calls:
STT/TTS/audio calls:
Environment variables used:
Error handling behaviour:
Fallback behaviour:
Logging/telemetry emitted:
Security/privacy behaviour:
Existing tests covering this file:
Missing tests that must be added before refactor:
Behaviours that must not change:
Allowed extraction candidates:
Disallowed changes:
Post-refactor test commands:
```

### 2.2 Hard Rule

Bob must not refactor a file until this contract is completed.

If a behaviour is unknown, Bob must stop and inspect the current code/tests instead of guessing.

---

## 3. Pre-Refactor Large File Inventory

Before changing code, generate a large-file inventory.

Run from the repository root:

```bash
find backend/src frontend/src -type f \( -name "*.js" -o -name "*.jsx" \) -print0 | xargs -0 wc -l | sort -nr | head -60
```

Create a working table:

```txt
File | Lines | Risk | Existing tests | Behaviour contract status | Refactor phase | Owner
```

Classify every large file as:

```txt
High risk runtime orchestration
Medium risk business logic
Low risk pure helpers or UI sections
Do not touch yet
```

Rules:

- Do not refactor files only because they are long.
- Prioritise files that are long and hard to test.
- Prioritise files where pure extraction can reduce risk.
- Do not start with high-risk lifecycle rewrites.
- Do not refactor multiple high-risk files in one commit.

---

## 4. Global Refactoring Principles

1. **Preserve external APIs**
   - Do not change exported function names.
   - Do not change route contracts.
   - Do not change WebSocket contracts.
   - Do not change response schemas unless explicitly approved.

2. **Preserve runtime sequence**
   - Move code only when event order stays the same.
   - Do not move stateful logic unless tests prove the same behaviour.

3. **Extract pure logic first**
   - Pure helpers first.
   - Payload builders second.
   - Guard/validation helpers third.
   - Stateful coordination last.

4. **Keep files focused**
   - Target files should move toward under 200 lines where practical.
   - Critical orchestrators may remain 180-260 lines if forced splitting would hide state and increase risk.

5. **Do not delete regression tests**
   - Existing behaviour tests are safety rails.
   - Add tests around extracted modules.
   - Do not replace integration or robustness tests with weaker helper-only tests.

6. **No assumed performance gain**
   - Refactoring improves maintainability.
   - Performance improvement is optional and must be measured.
   - p95 latency must not regress.

---

## 5. Global Behaviour Categories That Must Be Preserved

The following behaviour categories apply to all refactored files.

### 5.1 API and Schema Behaviour

Preserve:

- exported function names
- function parameter names and defaults
- response object shape
- route response schema
- WebSocket message schema
- report schema
- parsed CV/JD schema
- match result schema
- error response shape

Do not rename fields unless all downstream code and tests are updated in the same commit.

### 5.2 State Behaviour

Preserve:

- module-level state
- closure state
- session state updates
- current turn state
- cached values
- pending queues
- retry counters
- fallback state
- confirmation state

If state is moved into a helper, add tests for the old state transition sequence.

### 5.3 Side Effects

Preserve:

- database writes
- database reads
- file reads
- file writes
- network calls
- LLM calls
- STT/TTS provider calls
- analytics or telemetry calls
- auth/session/cookie behaviour

Side effects must not run earlier, later, more often, or fewer times unless explicitly approved.

### 5.4 Error and Fallback Behaviour

Preserve:

- thrown error types
- returned error payloads
- fallback provider logic
- deterministic fallback text
- transcript repair fallback
- missing field handling
- retry behaviour
- timeout behaviour
- human-review flags
- unsupported evidence handling

Do not turn a recoverable error into a fatal error.

Do not turn an uncertain result into a confident result.

### 5.5 Logging and Telemetry Behaviour

Preserve:

- trace event names
- latency fields
- provider names
- session IDs
- user-safe metadata
- redaction behaviour
- error logging
- p50/p95/p99 metric collection if present

Do not remove logs needed for debugging voice latency, parsing quality, retrieval grounding, or report hallucination control.

### 5.6 Security and Privacy Behaviour

Preserve:

- auth checks
- ownership checks
- CSRF protection
- cookie-based auth behaviour
- WebSocket origin checks
- rate limiting
- redaction of sensitive fields
- human-review safeguards
- no token leakage into logs

Security code must not be moved into weaker helper abstractions without tests.

---

## 6. Required Test Gate Strategy

Use staged gates. Do not run the heaviest eval suite after every tiny helper extraction.

### 6.1 Every Small Refactor Commit

```bash
npm run lint
```

Also run the most relevant focused suite:

```bash
npm run test:voice
npm run test:match
npm run test:jd
npm run test:cv
npm run test:report
npm run test:retrieval
npm run test:agent
```

### 6.2 Every Backend Voice Phase

```bash
npm run lint
npm run test:voice
npm run eval:voice-robustness
```

### 6.3 Voice Phase 4-6

These phases touch audio buffering, STT lifecycle, or the main voice orchestrator. Also run:

```bash
npm run benchmark:voice-latency:gate
```

### 6.4 Full Phase 2 Completion Gate

```bash
npm run test:all
npm run eval:local
```

Run real evals only when API keys and environment are available:

```bash
npm run eval:real
```

### 6.5 Test Style

Use Vitest style:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

Do not write new Jest-style tests such as `jest.fn()` or `jest.mock()`.

### 6.6 Test Location Rules

- Voice helper and robustness tests go under `backend/tests/robustness/voice`.
- WebSocket integration tests go under `backend/tests/integration/voice`.
- `npm run test:voice` runs robustness voice tests.
- `npm run test:voice` does not cover all WebSocket integration tests.
- Use `npm run test:all` before major phase completion.

---

## 7. Required Behaviour Contracts by Area

The following sections define what Bob must document and preserve for each major target area.

---

## 8. Voice Behaviour Contract

This applies to:

```txt
backend/src/services/voice/duplexVoiceAgentService.js
backend/src/services/voice/duplexTurnCoordinator.js
backend/src/services/voice/realtimeSpeechProviderRouter.js
backend/src/services/voice/ttsStreamQueue.js
backend/src/services/voice/bargeInController.js
frontend voice hooks and voice UI files
```

### 8.1 Public Voice Contract

Preserve:

```js
createDuplexVoiceAgentSession({ context, session, userId, logger, sendJson })
return { handleJsonMessage, handleBinaryAudio, close }
```

Preserve handlers:

```txt
handleJsonMessage(payload)
handleBinaryAudio(message)
close()
```

### 8.2 Current Voice Defaults and State

Preserve:

```txt
language defaults to en-NZ
sampleRate defaults to 16000
voiceName from context.voiceName
VOICE_STT_TURN_STOP_TIMEOUT_MS fallback to 2500
MAX_PENDING_AUDIO_CHUNKS = 1200
PCM encoding = pcm_s16le
PCM channels = 1
PCM bytes per sample = 2
AUDIO_CONTRACT_TRACE_EVERY = 25
```

Preserve runtime state or equivalent tested behaviour:

```txt
speechSession
isSpeechSessionStarted
sessionStartPromise
activeSession
finalTranscriptSegments
latestPartialTranscript
isProcessingBufferedTurn
isCapturingSpeech
ignoredPreSpeechAudioChunks
pendingAudioChunks
audioChunksWritten
audioChunksDropped
audioBytesWritten
currentClientTurnId
lastFinalizedClientTurnId
pendingTranscriptConfirmation
activeSttProviderName
speechCaptureSequence
activeSpeechCaptureId
context.lastVad
```

### 8.3 Voice Message Behaviour

Preserve JSON message handling:

```txt
session_start -> send session_ready
audio_chunk + audioBase64 -> decode and queue audio
speech_start -> start/restart capture and send listening_started
speech_end -> validate clientTurnId and finalize captured speech
speak_text -> stream assistant speech and send assistant_speech_done
barge_in -> cancel assistant audio
cancel_assistant_audio -> cancel assistant audio
ping -> pong
session_stop -> finalize active speech or stop session, then send session_stopped
stop -> same cleanup path as session_stop
unknown type -> no behaviour change
handler error -> send MESSAGE_HANDLING_FAILED
```

Preserve binary audio behaviour:

```txt
binary message -> queueCapturedAudio(message)
errors are logged but do not crash socket process
```

Preserve close behaviour:

```txt
if capturing speech -> finalizeCapturedSpeech(reason: socket_close)
else -> clear pending audio and stop speech session
```

### 8.4 `session_ready` Behaviour

Preserve double ready behaviour until frontend is reviewed:

```txt
send session_ready when duplex agent session is created
send session_ready again when session_start arrives
```

Payload must preserve:

```txt
type: session_ready
tool: AGENT_TOOL_NAMES.ORCHESTRATE_DUPLEX_VOICE
sessionId
language
sampleRate
audioContract.encoding: pcm_s16le
audioContract.sampleRate
audioContract.channels
audioContract.bytesPerSample
timestamp
```

### 8.5 STT Session Behaviour

Preserve:

```txt
buildSessionSpeechPhraseList(activeSession)
extraPhrases passed to createRoutedRealtimeSpeechSession
usageContext.userId
usageContext.sessionId
usageContext.stage = interview
usageContext.source = duplex_voice_stt
captureId increment per session
activeSpeechCaptureId guard
sessionStartPromise guard
activeSttProviderName after start
provider name in logs
```

Preserve callbacks:

```txt
onPartialTranscript -> stale guard, normalize, set latestPartialTranscript if text, send stt_partial
onFinalTranscript -> stale guard, normalize, send stt_final, append final segment if text
onError -> send STT_ERROR
onSessionStarted -> send speech_session_started or payload.type
onSessionStopped -> send speech_session_stopped
```

### 8.6 Audio Buffer Behaviour

Preserve:

```txt
audio before speech_start is ignored and counted
first ignored pre-speech audio emits warning
audio during capture is accepted
if pending buffer is full, chunk is dropped and counted
if STT is ready, audio writes live immediately
if STT is starting, audio is buffered
pending audio flushes before STT stop
writeAudioChunk increments audioChunksWritten
writeAudioChunk increments audioBytesWritten
writeAudioChunk logs first chunk and every 25th chunk
audio duration is estimated from PCM bytes
```

### 8.7 Finalization Behaviour

Preserve:

```txt
finalize does nothing if not currently capturing
processingClientTurnId uses provided clientTurnId or currentClientTurnId
context.lastVad is updated with stopReason
isCapturingSpeech becomes false before STT stop
pending audio flushes before stopSpeechSession
stopSpeechSession is wrapped with timeout
STT stop errors are captured but do not block turn processing
activeSpeechCaptureId resets to 0 after stop attempt
if no final transcript exists, latestPartialTranscript is used
finalTranscriptSegments and latestPartialTranscript reset after capture
asrSource is resolved from segments or active provider name
isProcessingBufferedTurn prevents duplicate processing
processFinalTranscript receives transcriptText, asrConfidence, asrSource, clientTurnId, vad metadata
vad includes sttSegmentCount, sttSource, sttProvider, sttStopError, usedPartialFallback, ignoredPreSpeechAudioChunks, audioChunksWritten, audioChunksDropped, audioMsWritten
turn errors emit DUPLEX_TURN_FAILED
currentClientTurnId resets after matching finalized turn
lastFinalizedClientTurnId updates after finalization
```

### 8.8 Turn Coordinator Behaviour

Preserve:

```txt
createDuplexTurnCoordinator is created inside processFinalTranscript
activeSession is passed at processing time
asrSource is passed at processing time
clientTurnId is passed at processing time
pendingTranscriptConfirmation getter/setter are passed through
updatedSession updates activeSession
```

Do not pre-create the turn coordinator unless tests prove no stale session, stale asrSource, or stale clientTurnId bug.

### 8.9 Voice Existing Tests To Preserve

Do not delete or weaken:

```txt
backend/tests/robustness/voice/duplexVoiceBufferedTurn.test.js
backend/tests/integration/voice/duplexVoiceSocket.integration.test.js
```

These tests protect:

```txt
final transcript segments process only after speech_end
binary audio writes during active capture
session_stop finalizes long answer
STT stop failure still processes turn
hung STT stop does not block repair/processing
latest partial transcript is used when no final exists
WebSocket route passes JSON and binary messages to the agent contract
unauthenticated socket is rejected
```

---

## 9. Agent Orchestration Behaviour Contract

This applies to large files such as:

```txt
backend/src/services/masterAiService.js
backend/src/services/interviewController*.js
backend/src/services/agent*.js
backend/src/services/*orchestrator*.js
```

Bob must document and preserve:

```txt
public exports and callers
agent/tool selection order
intent detection behaviour
fallback model/provider behaviour
retrieval call order
reasoning/evaluation steps
response schema
streaming or non-streaming behaviour
tool names used in traces
error handling
retry behaviour
human-review or uncertainty flags
latency trace fields
```

Disallowed changes unless explicitly approved:

```txt
changing tool selection policy
removing retrieval/evidence grounding
removing deterministic fallback
changing response schema
changing confidence or uncertainty handling
removing trace fields used by evals
```

Required tests before/after refactor:

```bash
npm run test:agent
npm run eval:agent-trajectory
npm run eval:retrieval
npm run eval:stability
```

If interview behaviour is affected, also run:

```bash
npm run eval:interview
npm run eval:e2e
```

---

## 10. CV Parsing Behaviour Contract

This applies to large CV parsing files.

Bob must document and preserve:

```txt
accepted input formats
file parsing behaviour
text normalization
section detection
name/contact extraction
education extraction
experience extraction
technical skill extraction
soft skill extraction
project extraction
certification extraction
missing field handling
schema returned to frontend/match pipeline
confidence or quality indicators
fallback parsing behaviour
error payloads
```

Disallowed changes unless explicitly approved:

```txt
removing extracted fields
renaming schema keys
weakening missing-field handling
reducing extraction coverage
turning uncertain extraction into confident extraction
```

Required tests:

```bash
npm run test:cv
npm run eval:cv
```

If CV-JD downstream is affected, also run:

```bash
npm run test:match
npm run eval:match
```

---

## 11. JD Parsing Behaviour Contract

This applies to large JD parsing files.

Bob must document and preserve:

```txt
raw JD text input handling
URL/source handling if present
job title extraction
company extraction
location extraction
work type extraction
seniority extraction
responsibility extraction
must-have requirement extraction
nice-to-have extraction
technical skill extraction
soft skill extraction
education requirement extraction
experience requirement extraction
missing evidence handling
schema returned to match pipeline
error handling and fallback behaviour
```

Disallowed changes unless explicitly approved:

```txt
weakening must-have vs nice-to-have detection
treating missing evidence as matched
renaming JD schema fields
removing education or experience requirements
removing human-review flags
```

Required tests:

```bash
npm run test:jd
npm run eval:jd
npm run eval:seek
```

If match output is affected, also run:

```bash
npm run test:match
npm run eval:match
```

---

## 12. CV-JD Matching Behaviour Contract

This applies to large matching files.

Bob must document and preserve:

```txt
input CV schema
input JD schema
technical skill matching
soft skill matching
education matching
experience matching
gap detection
matched evidence anchors
missing evidence handling
score calculation
score normalization
confidence flags
human-review flags
recommendation generation
frontend output schema
```

Critical rule:

```txt
Do not mark education as matched unless at least one education requirement is actually satisfied.
```

Disallowed changes unless explicitly approved:

```txt
renaming match output fields
changing scoring weights silently
removing evidence anchors
removing gap reasons
removing human-review flags
turning partial matches into full matches
```

Required tests:

```bash
npm run test:match
npm run eval:match
npm run eval:cv-jd-match
```

If guarded safeguards are touched, also run:

```bash
npm run test:match-safeguard
```

---

## 13. Report Generation Behaviour Contract

This applies to large report files.

Bob must document and preserve:

```txt
input interview transcript schema
input CV/JD/match schema
section generation order
STAR feedback logic
evidence anchor usage
risk labels
unsupported claim handling
recommendation generation
uncertainty wording
report output schema
export behaviour
error handling
redaction behaviour
```

Disallowed changes unless explicitly approved:

```txt
allowing unsupported claims
removing evidence anchors
removing uncertainty labels
changing report schema
removing hallucination safeguards
removing redaction
```

Required tests:

```bash
npm run test:report
npm run eval:report
```

If interview output feeds report generation, also run:

```bash
npm run eval:interview
npm run eval:e2e
```

---

## 14. Retrieval and Evidence Behaviour Contract

This applies to large retrieval/RAG/evidence files.

Bob must document and preserve:

```txt
query construction
retrieval source selection
ranking logic
top-k behaviour
fallback when no evidence exists
evidence anchor format
source attribution
NZ workplace/localisation retrieval
filtering logic
error handling
latency trace fields
```

Disallowed changes unless explicitly approved:

```txt
removing evidence grounding
changing source ranking silently
returning unsupported evidence
removing no-evidence fallback
removing trace fields
```

Required tests:

```bash
npm run test:retrieval
npm run eval:retrieval
```

---

## 15. Auth, Server, Contract, and Security Behaviour Contract

This applies to large auth/server/route/contract files.

Bob must document and preserve:

```txt
route paths
HTTP methods
request body schemas
response schemas
auth ownership checks
cookie behaviour
CSRF checks
JWT secret fail-fast behaviour
WebSocket auth behaviour
Origin checks
rate limits
error codes
redaction
logging
```

Disallowed changes unless explicitly approved:

```txt
weakening auth
removing ownership checks
allowing query token leakage where cookie auth is required
removing CSRF checks
changing route prefixes silently
changing error codes used by frontend
```

Required tests:

```bash
npm run test:server
npm run test:contracts
```

For WebSocket voice routes, also run:

```bash
npm run test:voice
npm run test:all
```

---

## 16. Frontend Hook Behaviour Contract

This applies to large frontend hooks, especially voice hooks.

Bob must document and preserve:

```txt
hook public return values
state names exposed to components
callback names
side effects in useEffect
cleanup behaviour
WebSocket connection timing
microphone permission flow
audio capture timing
first audio chunk sending
speech_start timing
speech_end timing
TTS playback start
latency trace fields
error state behaviour
loading state behaviour
```

Disallowed changes unless explicitly approved:

```txt
renaming returned hook fields
changing speech_start/speech_end timing
removing cleanup
removing latency traces
breaking TTS playback start
changing user-facing status messages without UI review
```

Required tests:

```bash
npm run lint
```

If frontend test scripts exist, run the relevant frontend test suite. If no test exists for the refactored hook, add one or add a clear manual QA checklist.

Manual QA for voice UI:

```txt
mic permission prompt appears correctly
speech_start sends before first intended audio chunk
first audio chunk reaches backend
partial transcript displays if enabled
assistant TTS starts after backend response
barge-in/cancel works
session_stop cleans up microphone and socket
error banner appears for backend errors
```

---

## 17. Frontend Page and Component Behaviour Contract

This applies to large pages such as:

```txt
AnalyzePage.jsx
InterviewPage.jsx
ReportPage.jsx
DashboardPage.jsx
```

Bob must document and preserve:

```txt
route path
props passed to child components
API calls
loading state
error state
empty state
success state
form validation
button actions
navigation behaviour
accessibility labels
responsive layout
admin-only visibility
```

Disallowed changes unless explicitly approved:

```txt
moving business logic into visual-only components
renaming props without updating callers
removing accessibility labels
changing admin visibility
changing route behaviour
changing empty/error state behaviour
```

Manual QA:

```txt
page loads
main action works
error state renders
empty state renders
mobile layout still usable
admin-only areas remain hidden from non-admin users
```

---

## 18. Safe Extraction Order

For each file:

```txt
1. Write behaviour contract
2. Identify existing tests
3. Add missing regression tests
4. Extract pure helpers
5. Extract constants only if shared safely
6. Extract payload builders
7. Extract validation guards
8. Extract metrics/trace helpers
9. Extract stateful coordination last
10. Run focused tests
11. Run phase gate tests
12. Commit
```

Do not start by extracting lifecycle managers or orchestration classes.

---

## 19. Voice-Specific Safe Extraction Order

Recommended order:

```txt
0. Confirm current voice behaviour contract
1. transcriptSegmentProcessor.js
2. audioDurationUtils.js
3. voicePayloadBuilders.js
4. voiceTurnGuards.js
5. voiceAudioMetrics.js and voiceTracePayloads.js
6. audioCaptureMetrics.js
7. pendingAudioQueue.js
8. duplexAudioCaptureBuffer.js only if still useful
9. duplexSpeechSessionLifecycle.js
10. final cleanup of duplexVoiceAgentService.js
```

Do not start with lifecycle extraction.

Do not start with a full rewrite of `duplexVoiceAgentService.js`.

---

## 20. Commit Strategy

Use small commits. One extraction per commit.

Suggested commit style:

```txt
refactor(voice): extract transcript segment processor
refactor(voice): extract audio duration utilities
refactor(voice): extract voice payload builders
refactor(voice): extract turn guard helpers
refactor(voice): extract pending audio queue
refactor(agent): extract tool selection policy
refactor(cv): extract section normalizer
refactor(jd): extract requirement parser
refactor(match): extract education matcher
refactor(report): extract evidence anchor builder
refactor(frontend): extract interview status panel
```

Each commit must include:

- behaviour contract update for the touched file
- extracted module
- updated imports
- focused tests
- no unrelated formatting churn

Avoid large mixed commits.

---

## 21. Rollback Strategy

For every phase:

1. Commit after tests pass.
2. If tests fail, fix before continuing.
3. If behaviour regresses, revert the last refactor commit.
4. If production behaviour is uncertain, keep old implementation behind a temporary feature flag.
5. Remove feature flags only after dev testing and evals pass.

Rollback threshold is strict for these regressions:

```txt
voice transcript becomes empty more often
STT final stops arriving
partial fallback stops working
speech_end fires duplicate turns
first TTS audio is delayed
barge-in stops working
p95 voice latency increases
session_ready timing changes unexpectedly
VAD metadata disappears from turn processing
CV parser returns fewer fields
JD parser loses must-have requirements
education match becomes over-permissive
match evidence anchors disappear
report includes unsupported claims
auth or ownership checks weaken
frontend route/action breaks
admin-only UI becomes visible to non-admin users
```

Any of these should block the phase.

---

## 22. Definition of Done

Phase 2 refactoring is done only when:

- large-file inventory has been reviewed
- every touched file has a behaviour contract
- large files are reduced where practical
- extracted modules have clear responsibility
- public APIs remain stable
- route/WebSocket contracts remain stable
- existing regression tests are preserved
- focused tests pass
- relevant grouped tests pass
- evals pass
- voice latency gate passes for risky voice phases
- no p95 latency regression is observed
- no known transcript quality regression exists
- no known parsing/matching/report regression exists
- documentation reflects the new module boundaries

---

## 23. Final Note

This refactor is approved in direction, but only under a behaviour-preserving execution model.

The codebase does need smaller files. The 200-line maintainability target is valid. However, critical files must be split like surgery, not like a blind rewrite.

For every target file, Bob must first write down the current behaviour, then refactor, then prove the same behaviour still works with tests.
