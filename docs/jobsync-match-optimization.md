# JobSync 借鑑範圍與 Kiwi Match 方向修正

狀態：2026-07-26 product decision；取代 2026-07-16 dual-mode 與 2026-07-24 ATS guidance 提案

Goal：[Kiwi Match → Interview Preparation Optimization Goal](jobsync-match-optimization-goal.md)

Spec：[Kiwi Match → Interview Preparation Optimization Spec](jobsync-match-optimization-spec.md)

UI：[Kiwi Match UI 優化計畫](UI_match_plan.md)

## 決策摘要

JobSync 只保留兩種可借鑑能力：

1. 文字清理與損壞防禦；
2. match 執行期間的 streaming experience。

Kiwi 不採用 Fast Match / Automation Match，不建立 `fast` / `detail` 切換，也不把 ATS keywords、resume tailoring 或 `Improve your CV for this role` 做成 Analyze 的主要功能。

產品核心是使用 CV、JD 與 Match evidence 準備後續 interview questions：

```text
one reviewed input
  -> one full Match
  -> one safeguarded and persisted result
  -> one prepared interview question plan
  -> targeted practice
```

## 為什麼 ATS / Tailoring 不進主線

ATS guidance 可以是獨立產品，但它不是 Kiwi 現階段的主線。把它放在 Match result 的主要位置會造成三個問題：

- 使用者會把 Analyze 理解成履歷優化工具，而不是 interview preparation；
- 新 contract、grounding、no-fabrication UI 和 migration 會消耗有限實作額度；
- Match 已經產生 gap、risk、question filter 和 proof strategy，應先把這些現有資產轉成清楚的面試準備價值。

因此 provisional `atsKeywords` / `tailoringTips` 不升級成 structured guidance，也不接前端；2026-07-26 runtime output 與相應 fast parser branch 已移除。

## 為什麼不做 Fast Match

Kiwi Match 同時建立 Role Evidence Map、diagnostics、Match record、question filter 和 interview preparation signals。這些 output 依賴 reviewed CV/JD、Role-Fit gate、semantic/deterministic evidence、critic safeguard 和 persistence。

Fast Match 繞過部分機制後，不能作為 interview plan 的權威輸入。兩條 pipeline 也會產生兩套 score/schema/cache/test 語意，增加誤用與維護成本。

2026-07-23 加入的 `settings.matchMode === 'fast'` branch、`parseJobMatch` / `SCORES:` format 和 `matchMode` output 因此已從 runtime 移除；legacy `matchMode` input 不再改變 canonical Match。

## 三項 Match 優化

### 1. 文字清理與損壞防禦

在 expensive Match work 前清理 HTML、空白與 bullet，拒絕空白、過短、過長或明顯損壞輸入。只正規化 request-scoped comparison copy，不覆寫 persisted CV/JD source。

### 2. Streaming current Match

Streaming 觀察現有 Match orchestration，回報 input validation、role review、evidence matching、quality check、persistence 和 question preparation 等 candidate-safe stage。

它不能建立第二份 Match、跳過 safeguard、串流 partial score，或在 persistence 前宣告完成。只有 final persisted `match_completed` 可以建立 interview plan。

### 3. Match → Interview Preparation 銜接

Match 完成後立即顯示完整結果。Interview plan 狀態獨立呈現：

- preparing：保留 Match，顯示 `Preparing your interview focus`；
- ready：顯示既有 proof strategy 的 focus、gap、question count、hint 和 risk；
- failed：保留 Match，單獨重試 question preparation，不重新執行 Match。

前端只顯示 allowlisted candidate-safe summary，不顯示完整 question pool、evidence ID、coverage、rank trace 或內部 schema。

## Current Code Boundary

| Area | 2026-07-26 current state | Target |
| --- | --- | --- |
| Input guard | normalization/validation 已在 CV load 後、matcher 前執行，focused no-matcher-call test 已覆蓋 | real corrupted PDF upload 尚未驗證 |
| Fast Match | runtime branch/parser/output 已移除 | legacy input 被忽略；不接 UI |
| ATS/tailoring fields | runtime output 已移除 | 不升級、不接 UI |
| Match streaming | canonical matcher + ordered SSE + frontend parser/reducer 已實作 | durable retry/idempotency 仍待 follow-up |
| Question preparation | JD filter、pool、proof strategy、readiness 與 UI state separation 已接入 | plan failure 只 retry plan，Match 保持可見 |
| Match latency | 移除 controller 重複 CV read，secondary reusable-cache warming 移出 critical path | 不減少 quality judge、critic、recompare、canonical cache write 或 persistence |

## 產品結果

完成後，使用者仍只按一次 `Generate match analysis`：

- 壞資料在 expensive work 前被擋下；
- 等待期間看到真實 pipeline 進度；
- Match 完成後立即看到 evidence、gap 和 requirement details；
- preparation ready 後看到面試優先方向，接著開始 text 或 voice interview；
- Analyze 不新增 ATS、履歷改寫或 mode selector。

Evidence status：本頁同時記錄產品決策與 2026-07-26 local implementation；mocked browser flow 已到 Voice Interview start screen，但 real provider、production 與真實音訊仍未驗證。
