# Resumable Voice Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make completed voice interviews open reports without waiting for audio conversion while preserving resumable, downloadable recordings across reload, network interruption, and backend restarts.

**Architecture:** A continuous MediaRecorder emits small chunks into an IndexedDB queue. A single low-priority upload manager sends idempotent chunks to a persistent backend manifest; a durable worker assembles and converts them while interview/report UI reads an explicit status state machine.

**Tech Stack:** React 19, Vite, Vitest, IndexedDB, MediaRecorder, Express, Multer, PostgreSQL, filesystem storage adapter, FFmpeg.

---

## File map

Frontend runtime:

- Create `frontend/src/runtime/recording/recordingConstants.js`: shared client states, IndexedDB names, chunk interval.
- Create `frontend/src/runtime/recording/indexedDbRecordingChunkStore.js`: IndexedDB durability boundary.
- Create `frontend/src/runtime/recording/recordingUploadManager.js`: one-flight uploader, recovery and finalization.
- Create `frontend/src/runtime/recording/recordingUploadRegistry.js`: session-keyed manager ownership across pages.
- Create `frontend/public/recording-upload-worker.js`: best-effort Background Sync using the same IndexedDB records.
- Modify `frontend/src/main.jsx`: safe service-worker registration.
- Modify `frontend/src/hooks/voice/useSessionAudioRecorder.js`: continuous chunk capture and local durability.
- Modify `frontend/src/hooks/voice/useVoiceSessionLifecycleController.js`: idempotent local finalization without waiting for conversion.
- Modify `frontend/src/hooks/useVoiceInterviewSession.js`: expose shared recording status/finalization.
- Modify `frontend/src/api/recordingApi.js`: normalized upload manifest/chunk/finalize/status API.

Frontend UI:

- Create `frontend/src/components/report/RecordingStatusCard.jsx`: accessible upload/conversion progress and retry.
- Modify `frontend/src/pages/InterviewPage.jsx`: await local durability only, then navigate.
- Modify `frontend/src/pages/ReportPage.jsx`: mount status/recovery UI.
- Modify `frontend/src/hooks/useReportData.js`: poll explicit backend states and resume local work.
- Modify `frontend/src/components/interview/InterviewRightRail.jsx` and `MobileInterviewDetails.jsx`: authoritative recording labels.

Backend:

- Modify `backend/src/config/postgresSchemaStatements.js`: manifest and chunk tables/indexes.
- Create `backend/src/config/recordingConfig.js`: storage root, limits, worker timing.
- Create `backend/src/repositories/recordingUploadRepository.js`: manifest/chunk/job persistence.
- Create `backend/src/services/recording/recordingChunkStorageService.js`: atomic chunk and MP3 filesystem operations.
- Create `backend/src/services/recording/recordingUploadService.js`: ownership, validation and idempotent domain flow.
- Create `backend/src/services/recording/recordingConversionWorker.js`: durable claim/retry/conversion loop.
- Modify `backend/src/controllers/recordingController.js`: thin endpoint orchestration.
- Modify `backend/src/api/routes/recordingRoutes.js`: chunk upload routes and limits.
- Modify `backend/src/services/recording/sessionRecordingService.js`: retain legacy download compatibility and expose conversion helper.
- Modify `backend/index.js` and `backend/.env.example`: worker startup/configuration.
- Modify `backend/src/services/voice/realtimeVoiceTurnService.js` and `duplexTurnCoordinator.js`: current report readiness in `turn_done`.

## Task 1: Lock current regressions with failing tests

**Files:**
- Modify: `frontend/src/pages/__tests__/InterviewPage.voiceMode.test.jsx`
- Modify: `backend/tests/robustness/voice/realtimeVoiceTurnMocked.test.js`

- [ ] **Step 1: Write frontend RED test with the real header**

Capture the header `onViewReport` prop instead of replacing the behavior under test, return a pending remote upload promise from the voice shell, and assert navigation occurs after a separate local-finalization promise resolves. The test name is:

```js
it('navigates after local recording durability without waiting for remote conversion', async () => {
  render(<InterviewPage />);
  await capturedHeaderProps.onViewReport();
  expect(stopVoiceSession).toHaveBeenCalledWith('view_report');
  expect(navigate).toHaveBeenCalledWith('/report/session-1');
});
```

- [ ] **Step 2: Run frontend RED**

Run: `npm run test -- src/pages/__tests__/InterviewPage.voiceMode.test.jsx`

Expected: FAIL because current `stopVoiceSession()` waits for remote upload/conversion and the test cannot observe navigation.

- [ ] **Step 3: Write backend RED report-readiness test**

```js
it('returns completed session report readiness generated in the same realtime turn', async () => {
  const result = await processRealtimeVoiceTurn(buildCompletedTurnInput());
  expect(result.updatedSession.hasReport).toBe(true);
  expect(result.updatedSession.reportStatus).toBe('ready');
});
```

- [ ] **Step 4: Run backend RED**

Run: `npm run test:all -- tests/robustness/voice/realtimeVoiceTurnMocked.test.js`

Expected: FAIL with `hasReport` undefined/false because `updatedSession` is built before report generation.

## Task 2: Add backend schema and repository contracts

**Files:**
- Modify: `backend/src/config/postgresSchemaStatements.js`
- Modify: `backend/tests/unit/initPostgresSchema.test.js`
- Create: `backend/src/repositories/recordingUploadRepository.js`
- Create: `backend/tests/unit/recordingUploadRepository.test.js`

- [ ] **Step 1: Write schema RED tests**

Assert schema statements create `recording_uploads` and `recording_upload_chunks`, unique `(upload_id, sequence)`, session ownership index, status index, worker lease fields, byte counters and timestamps.

- [ ] **Step 2: Run schema RED**

Run: `npm run test:all -- tests/unit/initPostgresSchema.test.js`

Expected: FAIL because recording tables do not exist.

- [ ] **Step 3: Add minimal DDL**

Add UUID manifest/chunk tables referencing `interview_sessions` and `users`, constrained status text, counters, checksum, storage key, retry/lease metadata, unique active session upload, and indexes.

- [ ] **Step 4: Verify schema GREEN**

Run the same command; expected PASS.

- [ ] **Step 5: Write repository RED tests**

Use an injected `queryFn` and verify SQL/shape for:

```js
createRecordingUploadRepository({ queryFn }).findOrCreateActive({ sessionId, userId, mimeType });
repository.upsertChunk({ uploadId, sequence, checksum, byteLength, storageKey });
repository.finalizeManifest({ uploadId, totalChunks, totalBytes });
repository.claimReadyJob({ workerId, leaseMs });
repository.markReady({ uploadId, storageKey });
```

Include identical duplicate success and conflicting checksum result mapping.

- [ ] **Step 6: Run repository RED, implement minimal repository, verify GREEN**

Run: `npm run test:all -- tests/unit/recordingUploadRepository.test.js`

Expected RED: module missing. Expected GREEN: all repository tests pass.

## Task 3: Add idempotent chunk API and storage

**Files:**
- Create: `backend/src/config/recordingConfig.js`
- Create: `backend/src/services/recording/recordingChunkStorageService.js`
- Create: `backend/src/services/recording/recordingUploadService.js`
- Modify: `backend/src/controllers/recordingController.js`
- Modify: `backend/src/api/routes/recordingRoutes.js`
- Create: `backend/tests/robustness/recording/resumableRecordingUpload.test.js`

- [ ] **Step 1: Write service/route RED tests**

Cover authenticated owned initialization, repeated initialization, persisted-before-ack chunk upload, identical duplicate, checksum conflict, cross-user denial, MIME/size/sequence rejection, missing chunk finalize, and repeated finalize.

Expected normalized status shape:

```js
{
  uploadId,
  sessionId,
  state: 'receiving',
  receivedChunks: 2,
  totalChunks: null,
  receivedBytes: 2048,
  totalBytes: null,
  missingSequences: [],
  available: false,
  retryable: true,
}
```

- [ ] **Step 2: Run RED**

Run: `npm run test:all -- tests/robustness/recording/resumableRecordingUpload.test.js`

Expected: FAIL because routes/services do not exist.

- [ ] **Step 3: Implement minimal config/storage/service/controller/routes**

Routes:

```text
POST /session-audio/uploads
PUT  /session-audio/uploads/:uploadId/chunks/:sequence
POST /session-audio/uploads/:uploadId/finalize
POST /session-audio/uploads/:uploadId/retry
GET  /session-audio/uploads/:uploadId/status
```

Use Multer disk storage for one bounded chunk, atomically rename it into `chunks/<uploadId>/<sequence>`, and persist metadata only after storage succeeds. Keep existing legacy upload/download endpoints.

- [ ] **Step 4: Verify GREEN and recording regression suite**

Run focused resumable and existing recording guard tests; expected PASS.

## Task 4: Add durable conversion worker

**Files:**
- Create: `backend/src/services/recording/recordingConversionWorker.js`
- Modify: `backend/src/services/recording/sessionRecordingService.js`
- Modify: `backend/index.js`
- Modify: `backend/.env.example`
- Create: `backend/tests/robustness/recording/recordingConversionWorker.test.js`

- [ ] **Step 1: Write worker RED tests**

Test single claim, expired lease reclaim, ordered chunk assembly, FFmpeg failure retention, bounded retry, atomic MP3 publication, ready state, and no source deletion before success. Inject repository, storage and `convertToMp3` boundaries.

- [ ] **Step 2: Run RED**

Run: `npm run test:all -- tests/robustness/recording/recordingConversionWorker.test.js`

Expected: FAIL because worker module is missing.

- [ ] **Step 3: Implement worker GREEN**

Expose `createRecordingConversionWorker({ repository, storage, convertToMp3, config })` with `runOnce/start/stop`, matching the retention worker lifecycle. Start only when Postgres is available and `RECORDING_WORKER_ENABLED=true`.

- [ ] **Step 4: Verify GREEN**

Run worker, recording, and schema tests; expected PASS.

## Task 5: Add browser durable chunk queue

**Files:**
- Create: `frontend/src/runtime/recording/recordingConstants.js`
- Create: `frontend/src/runtime/recording/indexedDbRecordingChunkStore.js`
- Create: `frontend/src/runtime/recording/recordingUploadManager.js`
- Create: `frontend/src/runtime/recording/recordingUploadRegistry.js`
- Create: `frontend/src/runtime/recording/__tests__/recordingUploadManager.test.js`

- [ ] **Step 1: Write queue/manager RED tests**

With an in-memory store implementing the same public contract, verify local commit before eligibility, ordered recovery, interrupted upload reset, deletion after ack, duplicate sequence idempotency, quota failure state, one in-flight request, offline retention, and shared finalization promise.

Public manager API:

```js
const manager = createRecordingUploadManager({ sessionId, store, api, getVoicePriorityState });
await manager.enqueueChunk({ sequence, blob, mimeType });
const localResult = await manager.finalizeLocalCapture({ totalChunks, totalBytes });
manager.start();
manager.stop();
manager.subscribe(listener);
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- src/runtime/recording/__tests__/recordingUploadManager.test.js`

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement pure manager and IndexedDB adapter**

Use one object store keyed by `[sessionId, sequence]` plus manifest records keyed by `sessionId`. Transactions must commit before `enqueueChunk` resolves. Reset stale `uploading` records to `pending` on recovery.

- [ ] **Step 4: Verify GREEN**

Run the focused runtime tests; expected PASS.

## Task 6: Convert MediaRecorder to continuous locally durable chunks

**Files:**
- Modify: `frontend/src/hooks/voice/useSessionAudioRecorder.js`
- Modify: `frontend/src/hooks/voice/useVoiceSessionLifecycleController.js`
- Modify: `frontend/src/hooks/useVoiceInterviewSession.js`
- Create: `frontend/src/hooks/voice/__tests__/useSessionAudioRecorder.test.jsx`

- [ ] **Step 1: Write capture RED tests**

Use a deterministic MediaRecorder test double. Verify `start(4000)` is called once, each `dataavailable` Blob is enqueued, final stop waits only for the last local commit, concurrent stop calls return the same promise, and unmount does not delete unacknowledged chunks.

- [ ] **Step 2: Run RED**

Run: `npm run test -- src/hooks/voice/__tests__/useSessionAudioRecorder.test.jsx`

Expected: FAIL because current recorder accumulates one in-memory Blob and clears it on reset.

- [ ] **Step 3: Implement minimal capture integration**

Replace `chunksRef/segmentsRef` accumulation with monotonically sequenced enqueue calls into the registry manager. Make `finalizeLocalRecording()` idempotent and keep `stopVoiceSession()` responsible for device/socket cleanup only; remote upload continues independently.

- [ ] **Step 4: Verify GREEN and voice tests**

Run focused capture and existing frontend voice tests; expected PASS.

## Task 7: Normalize frontend API and recovery polling

**Files:**
- Modify: `frontend/src/api/recordingApi.js`
- Modify: `frontend/src/api/__tests__/recordingApi.test.js`
- Modify: `frontend/src/hooks/useReportData.js`
- Modify: `frontend/src/hooks/__tests__/useReportData.test.jsx`

- [ ] **Step 1: Write API/status RED tests**

Test initialize, chunk FormData upload, finalize, retry, and normalized states. Test report hook resumes the session manager, polls while state is non-terminal, stops polling at ready/non-retryable failure, and preserves report content while recording changes.

- [ ] **Step 2: Run RED**

Run the two focused test files; expected FAIL on missing API methods/state mapping.

- [ ] **Step 3: Implement normalized API and hook integration**

Keep API response normalization in `recordingApi.js`; `useReportData` consumes only `{ state, progressPercent, available, retryable, message }` and exposes `handleRetryRecording`.

- [ ] **Step 4: Verify GREEN**

Run focused API/hook tests; expected PASS.

## Task 8: Fix report readiness and non-blocking navigation

**Files:**
- Modify: `backend/src/services/voice/realtimeVoiceTurnService.js`
- Modify: `backend/src/services/voice/duplexTurnCoordinator.js`
- Modify: `frontend/src/pages/InterviewPage.jsx`
- Modify: `frontend/src/pages/__tests__/InterviewPage.voiceMode.test.jsx`

- [ ] **Step 1: Implement minimal backend GREEN for Task 1**

After completion report generation, return:

```js
updatedSession: {
  ...updatedSession,
  hasReport: Boolean(generatedReport?.stored?.report),
  reportStatus: generatedReport?.stored?.latestStatus || null,
}
```

The coordinator sends this enriched session unchanged.

- [ ] **Step 2: Implement minimal frontend GREEN for Task 1**

`handleViewReport` awaits `voiceShell.finalizeLocalRecording('view_report')`, triggers background upload without awaiting it, closes live voice resources, and navigates. Errors in local durability show an actionable status and prevent a false safe-save claim.

- [ ] **Step 3: Run both Task 1 regression tests**

Expected: PASS.

## Task 9: Add recording progress UI

**Files:**
- Create: `frontend/src/components/report/RecordingStatusCard.jsx`
- Create: `frontend/src/components/report/__tests__/RecordingStatusCard.test.jsx`
- Modify: `frontend/src/pages/ReportPage.jsx`
- Modify: `frontend/src/components/report/ReportActionBar.jsx`
- Modify: `frontend/src/components/interview/InterviewRightRail.jsx`
- Modify: `frontend/src/components/interview/MobileInterviewDetails.jsx`

- [ ] **Step 1: Write UI RED tests**

Test user-visible states: saving locally, uploading percent, waiting for connection, processing, ready/download enabled, recoverable failure/retry, originating-device missing chunks, and safe-close copy only after all chunks are acknowledged. Assert `role="status"`/`aria-live="polite"`.

- [ ] **Step 2: Run RED**

Run: `npm run test -- src/components/report/__tests__/RecordingStatusCard.test.jsx`

Expected: FAIL because component is missing.

- [ ] **Step 3: Implement component and page wiring**

Use existing glass-card/accent styles. Keep report content visible and download disabled until `available === true`.

- [ ] **Step 4: Verify GREEN and page tests**

Run component, report hook, and InterviewPage tests; expected PASS.

## Task 10: Add best-effort Background Sync

**Files:**
- Create: `frontend/public/recording-upload-worker.js`
- Modify: `frontend/src/main.jsx`
- Create: `frontend/src/runtime/recording/__tests__/recordingBackgroundSyncRegistration.test.js`

- [ ] **Step 1: Write registration RED tests**

Verify supported browsers register `/recording-upload-worker.js`, unsupported browsers remain functional, and an upload manager requests the `kiwi-recording-upload` sync tag only after a chunk is locally committed. Do not store bearer tokens in IndexedDB; the worker uses same-origin cookie authentication and requests a CSRF token before unsafe requests.

- [ ] **Step 2: Run RED**

Run: `npm run test -- src/runtime/recording/__tests__/recordingBackgroundSyncRegistration.test.js`

Expected: FAIL because registration and worker are missing.

- [ ] **Step 3: Implement minimal worker**

The worker opens the same IndexedDB schema, resets stale `uploading` records, fetches `/api/auth/csrf` with credentials, uploads pending chunks sequentially, acknowledges successful chunks, and leaves failed chunks pending. It never converts audio or changes interview state.

- [ ] **Step 4: Verify GREEN**

Run registration and upload-manager tests; expected PASS. Browser support remains progressive enhancement: unsupported browsers resume when the application reopens.

## Task 11: Recovery integration and final verification

**Files:**
- Create: `frontend/e2e/recording-recovery.playwright.mjs`
- Modify: `frontend/package.json` to add a script for the existing Playwright runtime; do not add dependencies.

- [ ] **Step 1: Write deterministic browser RED flow**

Use fake MediaRecorder and mocked authenticated backend endpoints to verify completion opens report, reload restores pending chunks, offline/online resumes, duplicate completion stays idempotent, and ready MP3 downloads non-empty bytes.

- [ ] **Step 2: Run RED, complete only missing integration wiring, verify GREEN**

Run the dedicated Playwright file with the existing Playwright runtime; expected final PASS without real AI, Azure, or microphone credentials.

- [ ] **Step 3: Run focused quality gates**

Frontend:

```bash
npm run test:voice
npm run lint
```

Backend:

```bash
npm run lint
npm run test:all
```

- [ ] **Step 4: Run broad feasible gates**

Run `npm run quality:all` in frontend. Do not run backend real AI evals or `quality:all` without separate credential/cost approval.

- [ ] **Step 5: Review git diff and record limitations**

Verify no `.env`, recordings, tokens, generated MP3s, database dumps, or temporary chunks are tracked. Confirm the documented limitation: device-local chunks require the originating browser to reopen if Background Sync cannot finish them.
