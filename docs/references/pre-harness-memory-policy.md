# Pre-Harness Memory Policy

狀態：current-state audit + approved target product policy；不改變目前 runtime 行為。

本文件回答升級前最容易混淆的問題：Kiwi 目前 memory 可以更新，但還不是 harness-grade memory layer。產品 owner 已核准未來建立 user-scoped、cross-session interview learning memory；現在仍要先把 source、reader/writer、provenance、question-planning authority、scoring boundary、retention/deletion 和 promotion/revalidation gate 列清楚。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[共享 Contract Spine](../further_plan/product-harness-contract-spine.md)、[Kiwi Agent 現況盤點](agent-current-state-inventory.md)。

## 1. Current memory surfaces

| Memory surface | 狀態 | Current source | 目前用途 | 主要缺口 |
| --- | --- | --- | --- | --- |
| Session-local `agentMemory` | 已確認 | [agentMemoryService](../../backend/src/services/aiControl/agentMemoryService.js)、[SessionAnalysis](../../backend/src/db/models/sessionAnalysisModel.js) | 記錄 topic history、recent patterns、evidence gaps、project usage、friction level。 | Mixed schema，沒有 per-write provenance、reader/writer policy。 |
| `reflectionRecords` | 部分確認 | [masterAiService](../../backend/src/services/masterAiService.js)、reflection writer service | interview turn 後條件式寫 reflection。 | 哪些 reflection 可跨 session 使用未 formalize。 |
| `UserCoachingMemory` | 已確認 | [userCoachingMemoryService](../../backend/src/services/aiControl/userCoachingMemoryService.js)、[UserCoachingMemory model](../../backend/src/db/models/userCoachingMemoryModel.js) | 存 `memoryRecords` 和 `latestSummary`，偏 coaching memory。 | 不是 full progress profile；未標 `canAffectScoring=false`。 |
| Report reflection usage | 部分確認 | report generator 會讀 user coaching memory 和 reflection records。 | 用於 report/coaching context。 | candidate-visible explanation policy 未集中。 |
| Retention/deletion path | 需要測試 | retention services 和 model registry 包含 user coaching memory。 | 有 retention framework 線索。 | derived memory 是否隨 source delete 正確處理需驗證。 |

## 2. Approved target behavior and policy status

Target user interview memory 的目的不是保存聊天全文，而是跨多次練習形成可追溯的 interview learning state：哪些 role/competency/question family 已有強 evidence、已展示到什麼深度、哪些 coverage gap 應優先，以及何時需要重新驗證。

產品 owner 已核准：

- Memory scope 到 user，跨 session 使用。
- 多次練習已穩定回答好的內容，不再做同深度的例行重問；planner 應轉向其他 gap 或提高問題深度。
- User memory 可以影響 planning、question selection、question depth 和 coaching summary。
- User memory V0 `canAffectScoring=false`；evaluator 不把歷史 memory 當本輪答案證據。
- 一般使用者只看重要、非技術性的 progress summary；developer 才看完整 memory read/write、gate 和 source refs。
- Candidate-sensitive source 預設 refs/hash/version；必要時只存 redacted snapshot。Source delete 後 derived memory 必須 delete/recompute/redact，只留無內容 audit tombstone。

「不再問」不是永久封鎖。Role applicability 改變、memory 過期、source evidence 衝突、能力需要更高深度或 promotion threshold 未達標時，planner 必須允許 revalidation。

| Policy | 狀態 | Pre-harness decision |
| --- | --- | --- |
| User-level memory cannot directly score candidate | 產品已核准 / runtime 未實作 | V0 `canAffectScoring=false`，只能影響 planning、question selection/depth、coaching context。 |
| User-level memory can adapt interview depth and coverage | 產品已核准 / runtime 未實作 | Strong evidence 可停止同深度例行重問、轉向 coverage gap 或提高 depth。 |
| Planner/evaluator memory isolation | 產品已核准 / runtime 未實作 | Planner 可讀 purpose-scoped user memory；evaluator scoring packet 不把它當 current answer evidence。 |
| Session memory can affect next action | 部分確認 | `agentMemory.projectUsage` 目前會影響 project shift；必須標記為 session-local planning signal。 |
| Memory writes need provenance | 未確認 | 每次 write 應有 `sourceTaskType`、`sourceWorkflowRunId`、`sourceTurnId`、`sourceEvidenceRefs`。 |
| Memory reads need caller policy | 未確認 | planner/report/evaluator 讀 memory 的用途不同，要分開 allowlist。 |
| Candidate-visible memory needs redaction | 產品已核准 / runtime 未實作 | 只展示重要、user-safe progress/coaching summary，不展示 internal reflection、raw trace 或 gate detail。 |
| Retention/deletion must include derived memory | 原則已核准 / 需要測試 | 依 contribution refs delete/recompute/redact；只保留不含 candidate content 的 tombstone metadata。 |
| Promotion/revalidation threshold | 待產品決策 | 尚未決定獨立 session 次數、confidence、freshness window、role applicability 和 conflict threshold。 |

## 3. Proposed memory write envelope

```json
{
  "memoryId": "string",
  "scope": "session | user_coaching | user_interview",
  "memoryType": "topic_history | evidence_gap | reflection_lesson | competency_signal | question_exposure | answer_strength | depth_progression | coverage_priority | revalidation_due",
  "applicability": {
    "roleFingerprint": "string | null",
    "competencyKey": "string | null",
    "questionFamilyKey": "string | null"
  },
  "learningState": {
    "independentSessionCount": 0,
    "sourceEvidenceCount": 0,
    "demonstratedDepth": "versioned domain value",
    "recommendedNextDepth": "versioned domain value",
    "routineRepeatEligible": true,
    "freshUntil": "ISO-8601 | null"
  },
  "source": {
    "taskType": "interview_next_turn",
    "workflowRunId": "shadow-only initially",
    "sessionId": "string",
    "turnId": "string",
    "evidenceRefs": []
  },
  "policy": {
    "canAffectPlanning": true,
    "canAffectQuestionSelection": true,
    "canAffectQuestionDepth": true,
    "canSuppressRoutineRepeat": false,
    "canAffectScoring": false,
    "candidateVisible": false,
    "retentionClass": "derived_user_interview_memory",
    "sourceDeletePolicy": "delete | recompute | redact | tombstone_metadata"
  },
  "createdAt": "ISO-8601"
}
```

這個 envelope 第一版可以只在 shadow read model 裡產生，不要一開始改 collection schema。`canSuppressRoutineRepeat=true` 必須由 promotion/applicability/freshness/conflict gates 決定，不能由 writer 自行宣稱。

## 4. Reader/writer policy

| Surface | Writers | Readers | Allowed use | Forbidden use | 狀態 |
| --- | --- | --- | --- | --- | --- |
| Session `agentMemory` | interview controller / memory service | action planner、decision context builder | 同一 session 內避免重複專案、記住 coverage gaps。 | 直接提高/降低 candidate final score。 | 部分確認 |
| `reflectionRecords` | reflection writer | report generator、user coaching memory service | 生成 coaching lesson、幫助 report summary。 | 在未標 provenance 時跨 session 作硬性評分依據。 | 部分確認 |
| Current `UserCoachingMemory` | user coaching memory service | report generator、decision context builder | 作 target user-memory 的 bounded coaching adapter source。 | 當作已完成的 progress-learning profile或直接 scoring。 | 部分確認 |
| Target user interview memory | policy-gated aggregator | question planner、question-pool preparation、candidate-safe progress projection | 跨 session 調整 coverage、question family、depth 和 revalidation。 | 讓 evaluator 把歷史 memory 當本輪答案；單次 evidence 永久 suppress；跨 role 過度泛化。 | 未實作 |
| Retention registry | retention services | retention audit/cleanup | 找出 derived records 並清除。 | 靠人工記憶處理 derived data。 | 需要測試 |

## 5. Memory gates

| Gate | 狀態 | Rule |
| --- | --- | --- |
| `memory_write_has_source` | 未確認 | 沒有 source task/session/turn/evidence refs 的 write 只能進 legacy memory，不可進 harness memory plane。 |
| `memory_scope_allowed` | 未確認 | session signal 不得自動升級成 user-level memory。 |
| `memory_promotion_threshold` | 待決策 / 需要測試 | 只有跨獨立 session 且 evidence/confidence 達門檻，才可升級為 demonstrated 或 suppress routine repeat。 |
| `memory_applicability_current` | 未確認 | Role/competency/question-family 不匹配的 memory 不得改變本次選題。 |
| `memory_freshness_revalidation` | 待決策 / 需要測試 | 過期、衝突或需要更高 depth 時，不得 suppress，應允許 revalidation。 |
| `memory_scoring_boundary` | 產品已核准 / runtime 未實作 | V0 user-level memory `canAffectScoring=false`，且 evaluator packet 與 planner packet 隔離。 |
| `memory_visibility_allowed` | 產品已核准 / runtime 未確認 | candidate-facing output 只能用 allowlisted progress/coaching summary。 |
| `memory_retention_consistent` | 原則已核准 / 需要測試 | contribution 可追蹤；source delete 後 delete/recompute/redact，只留無內容 tombstone。 |

## 6. Focused tests needed

| Test | 目的 | 目前狀態 |
| --- | --- | --- |
| Session memory update fixture | 確認 `agentMemory` 寫入 topic/project/evidence gap。 | 需要測試 |
| Project shift policy fixture | 確認 session memory 只影響 planning，不直接 scoring。 | 需要測試 |
| UserCoachingMemory write/read fixture | 確認 reflection 轉 coaching memory 的 shape。 | 需要測試 |
| Cross-session promotion fixture | 確認多次 grounded evidence 才會建立 demonstrated/depth progression。 | 需要測試 |
| Strong-answer routine-repeat fixture | 確認已證明 question family 轉向其他 gap 或更深問題，不再問同深度重複題。 | 需要測試 |
| Role mismatch/stale/conflict fixture | 確認不適用 memory 無法 suppress，並觸發 revalidation。 | 需要測試 |
| Planner/evaluator context isolation fixture | 確認 memory 可影響選題，但不進本輪 scoring evidence。 | 需要測試 |
| Retention/deletion memory fixture | 確認 derived memory 不會違反 source deletion。 | 需要測試 |
| Candidate-visible memory fixture | 確認 user 只看到重要 progress summary，不暴露 raw reflection/internal trace；developer view 保留 redacted detail。 | 需要測試 |

## 7. Audit carry-back

Memory readiness 維持 **部分確認**。產品方向已核准為 user-scoped、cross-session adaptive interview memory，但 current runtime 仍只有 session memory、reflection 和 bounded `UserCoachingMemory`。Provenance、promotion/revalidation、planner/evaluator isolation、question-depth effect、retention/deletion evidence 未完成前，不應把 current memory plane 描述成已具備 adaptive progress-learning。
