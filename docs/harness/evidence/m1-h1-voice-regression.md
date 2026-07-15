# M1 H1 Voice Regression Evidence

- Incident date: 2026-07-15
- Current verdict: `AUTOMATED_FIX_PASS_HUMAN_RETEST_PENDING`
- Scope: local G2/M1 shadow harness + duplex voice + resumable recording
- Privacy: 本文件不保存 session ID、transcript、token、錄音或 raw request payload。

## 首次 H1 看到的行為

| Surface | Observation |
| --- | --- |
| Voice turn | Backend 收到 `speech_end` 時沒有 active client turn，事件被忽略。 |
| Candidate UI | Frontend 已進入 processing，但等不到 `turn_done`，因此停在 `agent_thinking`。 |
| Harness query | 該 session 回傳空 runs；task 前的 transport failure 沒有 canonical run。 |
| Recording | 恢復後的 local chunk 重用已被 backend 接受的 sequence 0，產生 checksum conflict。 |

## Root Cause

1. WebSocket message handler 在 duplex session 建立前已開始接收事件，但使用 optional chaining；early `speech_start` 會被無聲丟棄。
2. Frontend `connect()` 在 raw socket `open` 就 resolve；VAD 可以早於 backend `session_ready` 啟動。
3. Backend 對無 active/matching turn 的 `speech_end` 只有 log；frontend 已進 processing，沒有 recovery event。
4. Recording manager remount 從 local sequence 0 開始，沒有先讀 backend `receivedChunks`。

## 修復後的契約

| Boundary | Required behavior | Automated proof |
| --- | --- | --- |
| Backend readiness | 初始化完成前的 ordered JSON/binary message 進 queue，session ready 後依序處理。 | `duplexVoiceRobustness.test.js` |
| Frontend readiness | `connect()` 只在 `session_ready` resolve；timeout/error/close 會 fail。 | `useDuplexVoiceSocket.test.jsx` |
| Rejection recovery | 無 active/matching turn 時回傳 retryable `turn_rejected`；frontend 清掉 processing 並留在同一題。 | `duplexVoiceBufferedTurn.test.js`、`useDuplexSocketController.test.jsx` |
| Harness diagnostics | Pre-task rejection 產生 redacted failed run、block gate、reason code 和 `voice_turn_rejected` timeline event。 | `interviewNextTurnShadowHarness.test.js`、M1 replay |
| Recording recovery | Chunk 先保存到 IndexedDB；remote status 可用時，重疊的 pending sequence 先 rebase 再 upload。 | `recordingUploadManager.test.js` |

## Verification

- Backend `npm run test:all`: 15 groups all passed.
- Backend focused: voice 84/84, contracts 39/39, recording 17/17.
- Backend `npm run lint`: passed.
- Frontend `npm run quality:all`: 54 files, 304 tests, lint and production build passed.
- `npm run eval:harness-m1`: 9/9 scenarios passed, including `voice_pretask_rejection_traceable`.
- Deterministic debug proxy: 5/5 correct; median reduction 99.99%.

## Human H1 Rerun Still Required

Local tests cannot prove microphone permission, browser timing, live STT/TTS provider health, or the actual authenticated developer query. H1 must still run at least two voice turns with `ENABLE_HARNESS_SHADOW=true`, enter report, and verify:

1. UI does not remain in `agent_thinking` after success or rejection.
2. Successful turns produce completed runs in `/api/interview/harness-runs?sessionId=<SESSION_ID>`.
3. Any rejected transport turn produces a failed run and leaves the same question active.
4. Recording upload does not report a sequence checksum conflict.
5. Candidate-facing UI does not expose internal failure/gate/memory detail.

Until this rerun passes, G2/M1 is `ready_for_human_validation`, not `verified`.
