# M1 H1 Persistence and Backend Trace Evidence

- Date: 2026-07-15 Pacific/Auckland
- Goal: G2/M1 `interview_next_turn` shadow foundation
- Mode: local authenticated voice session, `ENABLE_HARNESS_SHADOW=true`
- Verdict: `LOCAL_FIX_PASS_H1_RETEST_REQUIRED`

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

## Remaining Human Gate

需要重啟 backend 後再完成至少兩個 voice turns。每個 turn 應先看到 `task_completed/queued` trace，之後看到 `durable_persisted/persisted`；durable run 應為 completed，所有實際列出的 memory writes 都應為 `completed`。舊 run 的 `invalid/orphaned` 結果不會被回寫修正，也不能作為新程式已通過 H1 的證據。
