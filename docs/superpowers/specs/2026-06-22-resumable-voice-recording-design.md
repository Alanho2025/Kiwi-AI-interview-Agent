# Resumable Voice Recording and Non-Blocking Report Navigation

Status: Proposed for user review
Date: 2026-06-22

## Problem

At automatic voice-interview completion, the report button waits for `stopVoiceSession()` to upload the entire browser recording and for the backend to finish synchronous FFmpeg conversion before navigating. The completion effect can call the same non-idempotent finalization path at the same time. The final WebSocket payload also contains a session view built before report generation, so `hasReport` remains stale until reload.

This creates four user-visible failures:

- `Generate Report` appears clickable but navigation can remain pending without progress feedback.
- Reload can abort the recording upload and clear browser-held audio.
- A completed report can still be labelled `Generate Report` until session data is reloaded.
- Report generation and audio availability are coupled even though they are independent outputs.

## Goals

- Open the report page immediately after the final audio chunk is durably saved on the device.
- Continue recording upload and MP3 conversion without blocking report viewing.
- Resume unacknowledged uploads after reload, browser restart, or temporary network failure.
- Preserve acknowledged chunks across frontend and backend restarts.
- Make duplicate completion events, retries, and chunk uploads idempotent.
- Show accurate, accessible recording progress and clear safe-to-close guidance.
- Preserve the voice state machine and the three-second next-question audio target.
- Keep report generation independent from recording upload and conversion.

## Non-goals

- Guarantee background execution after every browser has been permanently closed. Browsers cannot upload device-only data if the user never reopens the originating device.
- Record system audio or provide speaker isolation.
- Perform audio merging or MP3 conversion in the browser.
- Run real AI evaluations as part of routine verification.

## Selected Approach

Use continuous, resumable chunk recording with a device-local durable queue, idempotent backend chunk storage, and durable asynchronous server-side finalization.

A single long Blob stored only in React refs is rejected because it retains the current reload-loss risk and places long recordings near browser memory, IndexedDB quota, request-size, and backend upload limits. Waiting for the complete recording request is rejected because it preserves the report-navigation block.

## Reliability Boundary

The solution distinguishes three durability levels:

1. `captured_locally`: the chunk is committed to IndexedDB on the originating device.
2. `uploaded`: the backend has acknowledged the chunk and stored it durably.
3. `ready`: all chunks have been assembled, converted, and atomically published as an MP3.

Report navigation requires only that the final chunk reaches `captured_locally`. The UI may say the browser can be closed safely only after all chunks reach `uploaded`. If the browser is closed earlier, the local queue resumes when the same browser profile opens the application again.

## Architecture

```text
Microphone MediaStream
├── latency-critical PCM path
│   └── AudioContext -> VAD -> STT WebSocket -> interview controller
└── recording path
    └── one continuous MediaRecorder
        -> 3-5 second chunks
        -> IndexedDB durable queue
        -> low-priority resumable uploader
        -> persistent chunk storage
        -> durable conversion job
        -> atomic MP3 publication
```

The recording path must never be awaited by the interview-turn path. The only completion-time wait is the bounded local operation that stops the recorder, receives its final `dataavailable` event, and commits the final chunk to IndexedDB.

### Frontend boundaries

- `SessionRecordingCapture`: owns one continuous `MediaRecorder` and emits ordered chunks without restarting the microphone.
- `RecordingChunkQueue`: persists chunks and upload metadata in IndexedDB before they become eligible for upload.
- `RecordingUploadScheduler`: uploads one chunk at a time, retries recoverable failures, and yields to latency-critical voice states.
- `RecordingBackgroundSyncBridge`: lets a service worker continue eligible uploads after tab close where Background Sync is supported; correctness does not depend on browser support.
- `RecordingFinalizationCoordinator`: provides one shared idempotent finalization promise for automatic completion, manual end, and report navigation.
- `RecordingStatusStore`: exposes session-level progress independently of the mounted interview page so the report page can continue or resume work.

The current React component unmount cleanup may close the microphone, VAD, audio context, and WebSocket. It must not delete unacknowledged recording chunks.

### Backend boundaries

- `RecordingUploadService`: creates or returns the active upload manifest owned by the authenticated user and session.
- `RecordingChunkService`: validates and idempotently persists ordered chunks.
- `RecordingFinalizationService`: validates manifest completeness and queues one conversion job.
- `RecordingConversionWorker`: claims durable jobs, assembles chunks, runs FFmpeg, and atomically publishes the MP3.
- `RecordingStatusService`: returns upload, missing-chunk, conversion, and download readiness state.

Chunk payloads belong in persistent object/file storage. PostgreSQL stores manifests, chunk metadata, ownership, state, attempts, and worker leases. The storage adapter may use a persistent local directory in development; production must not rely on ephemeral instance storage.

The existing in-process background queue is insufficient for conversion durability because a process restart can discard queued work. Conversion state must be persisted and reclaimed by a worker after lease expiry.

## Recording State Machines

### Frontend state

```text
idle
-> recording
-> final_chunk_pending
-> locally_durable
-> uploading
-> waiting_for_network
-> server_processing
-> ready

Any upload state -> recoverable_failed -> uploading
Any capture/storage failure -> local_storage_failed
```

Rules:

- `recording` continues independently of interview question turns.
- Every chunk is written to IndexedDB before upload begins.
- A backend acknowledgement changes a local chunk to `acked`; acknowledged payloads may then be deleted locally.
- An interrupted `uploading` chunk returns to `pending` on manager recreation.
- `final_chunk_pending` blocks only session teardown, not report generation.
- `local_storage_failed` must be visible and must not claim the recording is protected.

### Backend state

```text
created
-> receiving
-> awaiting_missing_chunks
-> queued
-> processing
-> ready

receiving/queued/processing -> recoverable_failed -> queued
invalid or exhausted retry budget -> failed
```

Every transition must be persisted. Repeating initialization, chunk upload, finalize, or worker claim must not duplicate data or conversion work.

## Upload Scheduling and Interview Isolation

- Use one continuous `MediaRecorder` with a 3-5 second `timeslice`; do not stop and restart it for each chunk.
- Permit at most one in-flight recording request.
- Persist chunks asynchronously through IndexedDB and avoid Blob concatenation on the main thread.
- Pause or abort low-priority upload while the voice controller is in `user_speaking`, `stt_finalizing`, `answer_processing`, `assistant_speaking`, or `next_question_speaking` when network quality is degraded.
- Resume when the latency-critical state ends or the network-quality gate recovers.
- Never await upload, hashing, manifest status, or conversion from the voice turn state machine.
- If checksums are required, compute them on small chunks outside the latency-critical callback, preferably in a worker.
- Record scheduler decisions and queue depth without logging audio contents or transcript secrets.

This preserves `user speech end -> next question first audio <= 3 seconds`. The upload scheduler must be included in voice latency regression tests so recording work cannot silently consume the turn latency budget.

## API Contract

The implementation uses the following route contracts:

### Initialize or recover upload

`POST /api/recordings/session-audio/uploads`

Request:

```json
{
  "sessionId": "session-id",
  "mimeType": "audio/webm;codecs=opus"
}
```

Response includes `uploadId`, state, acknowledged sequences, limits, and retry guidance. Repeating the request for the same active session returns the existing manifest.

### Upload a chunk

`PUT /api/recordings/session-audio/uploads/:uploadId/chunks/:sequence`

The request includes the chunk body, byte length, MIME type, and checksum. The backend must:

- authenticate session ownership;
- enforce per-chunk and per-session limits;
- accept an identical duplicate as success;
- reject the same sequence with different content as a conflict;
- persist the payload before returning acknowledgement.

### Finalize

`POST /api/recordings/session-audio/uploads/:uploadId/finalize`

Request includes `totalChunks`, `totalBytes`, and final MIME type. If chunks are missing, return `awaiting_missing_chunks` and the missing sequences. Repeated finalize calls return the same current state and never queue duplicate work.

### Status

`GET /api/recordings/session-audio/uploads/:uploadId/status`

Response includes:

- upload and conversion state;
- acknowledged and missing chunk counts;
- uploaded and total bytes once finalization defines the total;
- retryability and safe user-facing error information;
- `available` and download metadata when ready.

The existing session-level status endpoint may resolve the active upload internally so the report page does not need to retain `uploadId` in the URL.

### Retry

`POST /api/recordings/session-audio/uploads/:uploadId/retry`

This requeues only recoverable server-side failures. Client-side missing chunks remain the responsibility of the originating browser queue.

## Data Model

### Recording upload manifest

- `id`
- `session_id` with one active/finalized recording per session
- `user_id`
- `status`
- `mime_type`
- `total_chunks`
- `received_chunks`
- `total_bytes`
- `received_bytes`
- `finalized_at`
- `processing_attempts`
- `lease_owner`
- `lease_expires_at`
- `last_error_code`
- timestamps

### Recording chunk metadata

- `upload_id`
- `sequence`
- `storage_key`
- `byte_length`
- `checksum`
- timestamp

The unique key is `(upload_id, sequence)`. Chunk payloads are deleted only after the MP3 is atomically published and retention rules permit cleanup.

## Report and Completion Flow

1. The final accepted answer completes the interview and report generation proceeds independently.
2. The frontend marks the voice session complete and requests one idempotent recording finalization.
3. MediaRecorder emits the final chunk and `RecordingChunkQueue` commits it locally.
4. The report action navigates immediately after local durability succeeds. It does not await remote upload or FFmpeg.
5. `turn_done` carries current `hasReport` and `reportStatus`, or the frontend refreshes the session once report generation finishes, so the label is `View Report` when a report exists.
6. The report page mounts `RecordingStatusStore`, resumes pending uploads, and polls backend status using the existing polling pattern.
7. The backend queues conversion after all expected chunks are present.
8. The report page enables download only when the backend reports `ready` and `available: true`.

## UI/UX Design

### User problem

Users cannot tell whether the report button is broken, whether the recording is safe, or whether they may close the page. Reload can make the report accessible while silently losing audio.

### Affected screens and components

- Interview header report action.
- Interview voice-recording card in the right rail and mobile details.
- Report action bar or a recording-status card immediately below it.
- Existing interview completion banner.

### Layout and interactions

- The completed interview header uses `View Report` once report persistence is confirmed.
- Clicking it performs the bounded final local flush and navigates; it never waits for remote conversion.
- The recording card shows one authoritative state and progress, not the ambiguous default `Recording is still being processed`.
- The report page shows:
  - `Saving recording on this device` during final local flush;
  - `Uploading recording — 72%` when total size is known;
  - `Waiting for connection — upload will resume automatically` while offline;
  - `Processing recording` after the server has all chunks;
  - `Recording ready` with enabled download;
  - `Upload needs attention` with retry for recoverable errors;
  - `Open this report on the original device to finish uploading` when the server is missing device-local chunks.
- Safe-close copy appears only after all chunks are acknowledged: `Recording uploaded safely. You can close this page.`
- Report content remains available throughout recording processing.

### Visual direction

Reuse the current glass cards, accent green success state, muted progress treatment, and existing button hierarchy. Use a compact progress bar and text status rather than a blocking modal. Error states use the existing warning/error palette and expose a focused retry action. Progress and state text require an accessible live region; colour is not the only status signal.

## Edge Cases

| Case | Required behaviour |
|---|---|
| Automatic question-limit completion | One local finalization, immediate report navigation after local durability |
| Manual end and report click overlap | Both callers receive the same finalization promise |
| Duplicate WebSocket completion event | No duplicate manifest, finalization, or report generation |
| Reload during upload | Rebuild queue, reconcile acknowledged sequences, resume missing chunks |
| Browser closes after local durability | Resume on next open in the same browser profile |
| Browser supports Background Sync | Continue queued uploads after tab close without requiring the report page to stay mounted |
| Browser does not support Background Sync | Retain chunks in IndexedDB and resume on the next application open |
| Browser closes after all acknowledgements | Server finishes conversion without the browser |
| Browser never reopens with local-only chunks | Server reports missing chunks; UI identifies the originating-device requirement |
| Network offline during interview | Continue local capture while quota allows; upload resumes later |
| Network degrades during a voice turn | Pause recording upload and preserve STT/TTS priority |
| IndexedDB unavailable or quota exceeded | Show an explicit protection failure; never claim safe upload |
| Chunk request times out after server commit | Retry is accepted idempotently |
| Same sequence has different checksum | Reject conflict and stop finalization until reconciled |
| Backend restarts during conversion | Durable lease expires and another worker resumes the job |
| FFmpeg fails | Persist recoverable failure, retain chunks, permit bounded retry |
| MP3 publication interrupted | Do not expose partial file; publish by atomic rename/object promotion |
| User opens report on another device | Show server state; do not claim missing local chunks can upload there |
| Upload exceeds limits or invalid MIME type | Fail with a clear non-retryable status and retain audit metadata |
| User signs out | Stop authenticated upload; retain encrypted-at-rest claims only if actually enforced; resume after reauthentication |

## Security and Privacy

- Authenticate every manifest, chunk, status, retry, and download action.
- Enforce session ownership at the service boundary.
- Validate MIME type, extension, byte size, chunk count, sequence range, and total limits.
- Sanitize storage keys and never construct paths directly from client identifiers.
- Do not log audio payloads, signed URLs, tokens, or transcript contents in recording telemetry.
- Apply existing recording retention policy; do not add deletion or encryption guarantees unless the backend enforces them.
- Keep CSRF and bearer-token behaviour aligned with the existing API client.

## Observability

Record structured milestones:

- `recording_chunk_captured`
- `recording_chunk_local_commit`
- `recording_chunk_upload_started`
- `recording_chunk_acknowledged`
- `recording_upload_paused_for_voice_latency`
- `recording_finalize_local_complete`
- `recording_manifest_finalized`
- `recording_conversion_started`
- `recording_conversion_ready`
- `recording_conversion_failed`

Metrics include queue depth, oldest pending age, uploaded bytes, retry count, local finalization duration, upload duration, conversion duration, and voice latency while uploading. Audio content is excluded.

## TDD Strategy

Every production change follows RED -> verify expected failure -> GREEN with minimal code -> verify focused test and related suite -> REFACTOR while green. Tests written after implementation do not satisfy this design.

Tests should exercise real state transitions and storage/service boundaries. Mock only browser primitives, network transport, FFmpeg execution, and external storage where unavoidable. Do not mock the page header when verifying report navigation.

### Slice 1: Reproduce current regressions

RED tests:

- `completed voice session navigates to report while remote recording conversion is pending`
- `automatic completion and report click share one recording finalization`
- `completed turn exposes current report readiness without reload`
- `unmount does not delete unacknowledged recording chunks`

These must fail against the current implementation for the observed reasons.

### Slice 2: Deterministic recording state machine

RED tests:

- capture transitions from `idle` to `recording` once;
- chunk emission does not restart MediaRecorder or microphone tracks;
- duplicate completion calls return one finalization promise;
- finalization resolves after final local commit, not server conversion;
- local storage failure produces `local_storage_failed`.

GREEN introduces only the pure transition reducer/coordinator required by these tests.

### Slice 3: IndexedDB durable queue

RED tests:

- a chunk is not uploadable before its IndexedDB transaction commits;
- manager recreation restores pending chunks in sequence order;
- an interrupted `uploading` chunk becomes `pending` on recovery;
- acknowledged chunks are removed only after backend acknowledgement;
- duplicate enqueue does not duplicate a sequence;
- quota failure preserves an explicit failure state.

Use a real IndexedDB-compatible test environment where feasible rather than asserting mock calls.

### Slice 4: Latency-aware upload scheduler

RED tests:

- scheduler permits only one in-flight chunk;
- upload pauses or aborts when a latency-critical voice state begins on a degraded network;
- upload resumes after the critical state or network degradation ends;
- retries use bounded exponential backoff with jitter control supplied by the test clock;
- offline state does not delete pending chunks;
- upload work is never awaited by STT finalization or next-question playback.

### Slice 5: Backend manifest and idempotent chunks

RED integration tests:

- initialization requires authentication and owned session;
- repeated initialization returns the active manifest;
- chunk upload persists bytes before acknowledgement;
- identical duplicate chunk returns success without duplication;
- conflicting duplicate checksum returns conflict;
- cross-user chunk, status, retry, and download access is denied;
- invalid MIME, sequence, size, and aggregate limits are rejected;
- finalize with missing sequences returns `awaiting_missing_chunks`;
- repeated finalize queues one conversion job.

Prefer the real Express route, service, test database, and temporary storage adapter. Mock only the conversion process boundary.

### Slice 6: Durable conversion worker

RED integration tests:

- a queued complete manifest is claimed once;
- an expired worker lease can be reclaimed after simulated restart;
- conversion failure preserves chunks and records a recoverable error;
- retry budget prevents an infinite conversion loop;
- download remains unavailable until atomic publication;
- successful publication marks status ready and permits download;
- cleanup does not remove source chunks before publication succeeds.

### Slice 7: Interview and report UI

RED component/page tests:

- completed voice report action navigates after local durability while upload remains pending;
- report page renders accurate uploading, offline, processing, ready, and failed states;
- progress status uses an accessible live region;
- download remains disabled until ready;
- retry is available only for recoverable failures;
- safe-close copy appears only after all chunks are acknowledged;
- the existing report remains readable during recording processing.

Render the real header and recording status components. Mock only router navigation and the storage/network boundary required to control asynchronous state.

### Slice 8: Recovery end-to-end flows

Automated browser tests with fake AI/STT and deterministic MediaRecorder fixtures:

- fifteenth accepted answer completes, report route opens, and upload continues;
- reload with pending chunks restores and resumes the upload;
- offline completion opens the report, shows waiting state, and resumes when online;
- duplicate completion events do not duplicate chunks or jobs;
- report opened in a second browser context shows server state but not device-only progress;
- conversion completion enables MP3 download and the downloaded file is non-empty audio.

Voice tests must not require real AI credentials, Azure quota, or microphone access unless the user separately approves a real-backend test.

## Verification Gates

For each TDD slice:

1. Run the smallest new test and capture the expected RED failure.
2. Implement the minimum behavior.
3. Re-run the focused test to GREEN.
4. Run the affected package lint and nearest related tests.
5. Refactor only after green and re-run the same checks.

Before completion, when feasible:

- frontend voice, hook, page, and report tests;
- frontend lint and `npm run quality:all`;
- focused backend recording, authorization, persistence, and worker tests;
- backend lint and `npm run test:all`;
- deterministic browser recovery flows;
- no real AI evaluations without credentials and explicit approval.

## Migration and Rollout

- Preserve existing ready MP3 downloads.
- Treat legacy sessions without an upload manifest as `missing`, not indefinitely `processing`.
- Introduce the new recording pipeline behind a scoped feature flag until deterministic recovery tests pass.
- During rollout, record manifest and worker failures separately from voice-turn failures.
- Remove the legacy single-Blob synchronous path only after completed-session navigation, reload recovery, and download verification pass in the new path.
- Any new package, object-storage provider, service worker, or durable worker deployment requires explicit approval before installation or architecture mutation.

## Acceptance Criteria

- A completed voice interview opens its report without waiting for full recording upload or FFmpeg conversion.
- The final local recording chunk is durable before leaving the interview page.
- Reload, browser restart, and network interruption recover pending chunks on the originating device.
- Server-acknowledged chunks survive frontend and backend restarts.
- Duplicate completion and retry events cannot duplicate chunks, reports, or conversion jobs.
- Recording upload does not regress the voice latency target.
- The report page communicates upload, offline, processing, ready, and failure states accurately.
- MP3 download is enabled only after an atomically published, non-empty recording is available.
- All new behavior is implemented through observed RED-GREEN-REFACTOR cycles.
