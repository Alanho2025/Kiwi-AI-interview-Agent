# M1 H1 Persistence and Backend Trace Evidence

- Date: 2026-07-15 Pacific/Auckland
- Goal: G2/M1 `interview_next_turn` shadow foundation
- Mode: local authenticated voice session, `ENABLE_HARNESS_SHADOW=true`
- Verdict: `AUTOMATED_H1_PASS_HUMAN_LIVE_PENDING`

## 實際觀察

同一個 voice workflow 在 `10:44:05.160Z` 完成並排入背景工作；diagnostics 在 `10:44:30.857Z` 查詢時仍回傳 0 筆，`persist-harness-workflow-run` 則在 `10:44:31.957Z` 完成。這代表第一次空結果是 query 比 durable persistence 早約 1.1 秒，不是 run 完全遺失。共享背景 queue 當時有 8 個工作，讓 task completion 到 durable append 約延遲 27 秒。

稍後再次查詢可取得 completed voice run。該 run 的 action、gate、state、result、latency 和三類 memory write 都可重建，但 `qualityStatus` 是 `invalid`：`session_agent_memory` 與 `session_reflection` 已完成，`user_coaching_memory` 被標成 `orphaned`。

## Root Cause

`UserCoachingMemory` 用 normalized pattern + lesson 去重。舊實作保留第一筆重複資料，所以相同 lesson 再次出現時，舊 record 留下，新 record 的 `sourceWorkflowRunId` 被丟掉。Correlation 查不到本次 workflow lineage，因而產生 `background_memory_write_orphaned`。這是實際 provenance bug，不是單純 diagnostics 顯示問題。

Mongoose `new` deprecation warning 與空結果、orphan 判定沒有因果關係；它是另外的相容性噪音，本次沒有用大範圍 model rewrite 混入修復。

## 修復

1. Task 完成並排入背景 persistence 時，backend 立即輸出 `Harness workflow trace`，`traceStage=task_completed`、`persistenceStatus=queued`、`correlationStatus=pending`；此時 correlation 為 `null`，不會用假 0 冒充已完成計數。
2. Correlation 與 durable append 完成後，再輸出 `traceStage=durable_persisted`、`persistenceStatus=persisted`；失敗則明確輸出 `persistence_failed/failed`。
3. Trace 使用 allowlist，只包含 IDs、status、action、gate/memory/failure code、計數、result refs、timeline event type 和 controller latency；不包含 owner ID、answer、question、prompt、context 或 memory 內容。
4. Coaching memory 去重改為保留最新一筆，讓重複 lesson 仍保有本次 `sourceWorkflowRunId`。
5. Durable `HarnessWorkflowRun` 仍是 diagnostics 唯一 source of truth；即時 trace 不建立第二套 pending persistence/query state。

## Automated Evidence

- Focused tests: 3 files / 5 tests passed。
- Backend contracts: 15 files / 43 tests passed。
- Backend agent: 14 files / 82 tests passed。
- Backend voice: 22 files / 84 tests passed。
- Backend `npm run test:all`: 15 groups passed。
- Backend lint: passed。
- `npm run eval:harness-m1`: 11/11 passed，包含 `backend_trace_immediate_redacted` 與 `repeated_memory_keeps_latest_provenance`。

## Post-fix Automated Browser H1

同一個 Playwright flow 分別在 harness OFF/ON 完成兩個 voice turns，然後使用實際 UI 的 `End -> Confirm End` 正式結束 session 並載入 report。Question-limit fixture 仍遵守產品允許的 `8/12/15`，測試不是把 limit 偷改成 2，而是在兩個 turns 後走正式 manual-end path。

| Mode | Session | Durable result | Memory correlation | Candidate privacy | First-audio latency |
| --- | --- | --- | --- | --- | --- |
| OFF | `1c6081ae-9d75-4bab-b792-5b9c804f4110` | Harness disabled；report loaded | Not applicable | No internal trace | 3492 ms, 2268 ms |
| ON | `6be66482-73fb-4c20-bd29-a475c1652862` | 2 runs，兩者 completed/valid | 4/4 actual writes completed，`canAffectScoring=false` | No internal trace | 3493 ms, 2069 ms |

ON/OFF 第一 turn 相差 +1 ms、第二 turn相差 -199 ms，這一個 sample 沒有顯示 harness-specific latency regression；但兩組第一 turn 都超過 3 秒產品 SLO，所以不能宣稱 voice latency gate 通過。ON 的每筆 run 都可重建 decision 4、trajectory 1、trace 3 的 correlation。兩 turn 後的 report 是 `needs_review`，原因是 8 題計畫只完成 2 題且 role-fit artifact 不完整，符合此短 fixture 的既有 report policy，不是 harness persistence failure。

執行命令：`npm run test:e2e:harness-h1-voice`。這個 flow 使用真實 browser/frontend/backend/WebSocket/UI，但 STT/TTS 是 test provider、AI 是 mock；artifact 在 ignored `output/playwright/harness-h1-voice-{off,on}.latest.json`。

## Remaining Human And External Gates

真人麥克風 H1、live speech provider latency 和 production shadow storage/access/retention telemetry 仍未執行。舊 run 的 `invalid/orphaned` 結果不會被回寫修正，也不能取代修復後的 evidence。G2/M1 因此維持 `ready_for_human_validation`，不是 `verified`。
