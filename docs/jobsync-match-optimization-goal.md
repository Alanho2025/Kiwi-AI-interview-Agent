# Kiwi Match → Interview Preparation Optimization Goal

狀態：local implementation complete；production/retry-hardening evidence pending

日期：2026-07-26 NZST

對應規格：[Kiwi Match → Interview Preparation Optimization Spec](jobsync-match-optimization-spec.md)

UI 計畫：[Kiwi Match UI 優化計畫](UI_match_plan.md)

決策背景：[JobSync 借鑑範圍與 Kiwi Match 方向修正](jobsync-match-optimization.md)

## 產品決策

Kiwi 的產品主線是：

```text
reviewed CV + reviewed JD
  -> one canonical Match
  -> evidence, gaps and risks
  -> interview preparation priorities
  -> targeted interview practice
```

本 goal 直接優化現有 Match，不建立 `fast` / `detail` 模式，也不把 Analyze 變成 ATS 或履歷改寫工具。

`Improve your CV for this role`、ATS keyword 清單和 resume tailoring tips 不再是目標 UI。2026-07-23 加入的 provisional `matchMode === 'fast'`、`atsKeywords`、`tailoringTips` 和專用 parser 已從 runtime Match branch/output 移除；legacy request value 不再能切換 scorer。

## Goal

讓同一條 canonical Match：

1. 在 expensive AI、embedding、critic、cache write 和 persistence 前拒絕空白、過短、過長或疑似損壞的 CV/JD；
2. 在執行期間回報真實、candidate-safe 的 stage progress；
3. 完成後立即顯示完整 Match，不被 interview plan preparation 的 loading 擋住；
4. 將 final persisted Match 的 evidence、gaps 和 risks 接到既有 question filter、question pool 與 proof strategy；
5. 只向候選人顯示安全的 interview preparation summary，不洩漏完整 prepared question pool、evidence ID、ranking trace 或內部 schema。

```text
reviewed inputs
  -> sanitize and validate
  -> existing guarded Match
  -> persisted canonical match_completed
  -> existing question preparation
  -> candidate-safe preparation priorities
  -> Start interview
```

## 使用者問題

目前使用者按下 `Generate match analysis` 後，只能等待 Match JSON 和後續 interview plan 依序完成：

- 不知道系統正在 validation、evidence matching、quality review 還是 persistence；
- Match 已完成時，畫面仍可能因 question preparation 而保持 loading；
- 完整 evidence/gap 資訊很多，但「面試先準備哪幾件事」不夠靠前；
- 輸入異常時，錯誤通常沒有清楚指出應回到 CV 還是 JD 修復；
- 若加入履歷優化主區塊，會讓 Analyze 從 interview preparation 偏向求職文件優化。

## Current State

| Area | 現況 | 目標邊界 |
| --- | --- | --- |
| 文字清理與 validation | `textProcessing.js` 已有 HTML、空白、bullet normalization 和 `NO_CONTENT` / `TOO_SHORT` / `TOO_LONG` / `CORRUPTED` checks | 補齊 controller/API no-downstream-call contract；不可覆寫 persisted original source |
| Canonical Match | `runCvJdMatchAnalysis` → guarded matcher → persistence 是正式流程 | 維持單一權威，不新增簡化 scorer |
| Question preparation | Match 後已有 JD question filter、question pool、proof strategy 和 readiness | 強化 Match → preparation 的 UI 銜接，不建立第二套 preparation authority |
| Preparation summary | `ProofStrategyReviewPanel` 已顯示 focus、gap、question count、hint、risk | 提升資訊層級，但不顯示完整題庫或 private artifacts |
| Streaming | `POST /api/analyze/match/stream`、safe reporter、frontend parser/reducer 已接入 | 只觀察 canonical pipeline，不串流 partial score |
| Provisional fields | Fast branch、專用 parser、`matchMode` output、ATS/tailoring output 已移除 | legacy request field 被忽略；不接 UI |
| Latency | 重複 CV load 已移除，secondary reusable-cache warming 不再阻塞 response | 保留 scorer、evidence judge、critic/recompare、canonical cache write、persistence 和 question filter |

## Goal Tree

```text
MIP-G0  Match is safe, visibly progressing and directly useful for interview preparation
|
+-- MIP-G1  Reject unusable CV/JD before expensive Match work
+-- MIP-G2  Preserve one canonical Match and remove rejected provisional branches
+-- MIP-G3  Stream real progress and one persisted final result
+-- MIP-G4  Turn final evidence/gaps into safe preparation priorities
`-- MIP-G5  Prove parity, privacy, reliability and user comprehension
```

| Goal | Outcome | Exit gate |
| --- | --- | --- |
| MIP-G1 | Invalid or corrupted input never reaches embedding、LLM、critic、cache write、Match persistence 或 question filter | Unit + API integration tests cover every error code and no-downstream-call assertions |
| MIP-G2 | JSON 與 stream transport 共用現有完整 Match；沒有 runtime mode branch | Consumer audit + single-path contract tests + rejected fields removed |
| MIP-G3 | 使用者看到真實 stage，最後只收到一份 persisted canonical result | Ordered events、JSON/stream parity、final `matchAnalysisId`、disconnect/idempotency tests |
| MIP-G4 | Match 完成後先看到 evidence-backed interview priorities；question plan 狀態獨立 | UI/component tests + browser flow + safe allowlist contract |
| MIP-G5 | 優化不改變 score authority、privacy、question selection 或其他頁面共用 layout | Broad regression + human UI review + shared-component boundary check |

## Success Metrics

### Safety

- Frozen `NO_CONTENT`、`TOO_SHORT`、`TOO_LONG`、`CORRUPTED` cases 全數在任何 external model/embedding call 前被拒絕。
- Sanitization 只處理 request-scoped comparison copy，不覆寫 CV/JD persisted source。
- Stream events 不含 raw CV/JD、prompt、private evidence excerpt、critic reasoning 或 chain-of-thought。

### Canonical Match and plan gate

- Streaming 與 JSON 對同一 frozen input 產生 parity-equivalent final Match schema、score、decision、evidence map 和 `matchAnalysisId`。
- 只有 persisted `match_completed` 可以啟動 interview plan generation。
- Role-Fit review、safeguard critic、cache、persistence 和 question filter 仍在同一條流程。
- Target runtime 不保留 `fast` path、mode toggle 或較弱 scoring branch。

### Interview preparation usefulness

- Match 完成後立即顯示 canonical result，即使 question preparation 仍在執行。
- Preparation ready 時顯示 focus area count、gap count、question count、focus label、candidate-safe preparation hint 和 risk。
- Preparation summary 只使用既有 `questionPoolInfo.proofStrategy` 的 allowlisted candidate view。
- UI 不顯示完整預備問題、evidence ID、coverage ID、rank trace、proof point 或內部 scorer 名稱。

### Streaming experience

- Accepted local/mock request 在第一個 expensive provider call 前發出 `match_started`。
- 每個主要 pipeline boundary 發出 ordered allowlisted event；cache hit 或 skipped stage 如實呈現。
- 不顯示推測百分比、partial score 或 timer-driven fake stage。
- 相同 request ID 的 retry 最多只建立一筆 Match record 和一次 question-filter side effect。

## Non-goals

- 不做 ATS optimizer、履歷 tailoring、CV rewrite 或 `Improve your CV for this role` 主區塊。
- 不做 `fast` / `detail` mode、mode toggle、bulk scan 或簡化 Match prompt。
- 不變更 score weights、evidence-strength、Role-Fit review 或 critic authority。
- 不顯示 partial score、完整 prepared question pool 或 private preparation artifacts。
- 不改其他頁面的 shared `AppHeader`、top `StepProgress`、common cards/buttons/banner 或 `LoadingInsightPanel` 行為。
- 不新增 AI、embedding、streaming 或 UI dependency。
- 不執行 real-AI eval、production rollout、dependency install 或 git push，除非另行批准。

## Final User Experience

1. 使用者完成 CV、JD 和 session setup review。
2. 按一次 `Generate match analysis`。
3. Analyze 主欄顯示真實 validation、evidence matching、quality check、saving 和 question preparation progress。
4. 若輸入不可用，畫面提供具體 repair message 並導回正確 CV/JD step。
5. 收到 persisted `match_completed` 後，完整 Match 立即顯示。
6. Question preparation 尚未完成時，Match 保持可讀，preparation panel 顯示 `Preparing your interview focus`。
7. Ready 後，該 panel 顯示面試優先準備方向；右欄切換到 `Start text interview` 或 voice action。

## Release Boundary

本 goal 只有在 MIP-G1 至 MIP-G5 都有 evidence 時才完成。文件、provisional backend fields、focused unit tests、UI mockup 或 progress animation 都不等於 release proof。

Evidence status：2026-07-26 local implementation 已完成 single-path cleanup、input guard、canonical Match SSE、Match/plan state separation、preparation priorities 和 mocked browser Voice entry。Backend full mock-safe gate 653 tests、focused Match 57/57、frontend quality 59 files / 321 tests + build、兩端 lint、mocked Playwright flow 已有證據；real AI/provider、production telemetry、durable retry/idempotency、tablet/mobile manual review 和真實音訊 session 仍未完成。
