# Feature RFC Code-Truth Inventory

> 盤點日期：2026-08-02  
> 盤點範圍：`docs/architecture-decision-records/features/F-*.md`、目前 source/test path、`features/README.md`  
> 目的：把「有 RFC 文件」和「目前程式碼已證明」分開，並讓工程師可以從 RFC 找到 entry point、object、helper、algorithm、output 與 evidence boundary。

## 1. 盤點結果

| Check | Result | Interpretation |
| --- | ---: | --- |
| Feature files | 80 | F-01–F-80 每個 Feature 一份文件 |
| README links | 80 / 80 | 沒有漏列或多列的 feature link |
| `Implementation Status` headers | 80 / 80 | 每份 RFC 都必須明確寫 `Verified`、`Partial` 或 `Planned` |
| `Verified by Tests` headers | 80 / 80 | 沒有證據的舊 RFC 明確寫 `None`，不補猜測路徑 |
| Test references that exist on disk | 45 / 45 | 已填入的 test path 都能在本 repo 找到 |
| RFCs with concrete test references | 18 | 其餘 62 份目前沒有在 RFC header 宣稱測試證據 |
| Code changes | 0 | 本輪只更新文件；沒有改 runtime 行為 |

## 2. 本輪已完成的 owning RFC 更新

### F-14 Match code truth

[`F-14-cv-jd-weighted-match-engine.md`](features/F-14-cv-jd-weighted-match-engine.md) 已從歷史固定權重敘述改成目前 code blueprint：

- `runCvJdMatchExecution` 是 application boundary，先做 owner、input、Role-Fit review 與 JD safeguard gate。
- `compareCvToJobDescriptionWithSafeguard` 處理 blocked branch、cache、critic/recompare，再呼叫 core matcher。
- `compareCvToJobDescription` 將 normalized CV/JD、rubric、evidence、macro/micro/requirement checks、role evidence map 與 validated output 組合起來。
- `75cce1a` 的 primary technical evidence、retail context hard requirement、evidence-strength ordering 已寫入；不再宣稱固定 45/30/15/10 權重或 core matcher 自己負責 Mongo persistence。

### F-77–F-80 缺口補齊

- [`F-77`](features/F-77-cv-profile-human-review-gate.md)：CV 七個 review fields、section preservation、review metadata、evidence rebuild、owner persistence、audit/seed side effects。
- [`F-78`](features/F-78-jd-role-fit-human-review.md)：Role-Fit draft、validation、optimistic version、owner/fingerprint/profile identity gate、frontend safeguard status。
- [`F-79`](features/F-79-jd-url-capture-and-analysis.md)：HTTP(S) detection、DNS/SSRF guard、selector extraction、visible text cleanup、JD parser handoff、`sourceUrl`。
- [`F-80`](features/F-80-company-values-enrichment.md)：manual/Serper official-site resolution、same-host bounded fetch、AI/heuristic extraction、confidence 與 general fallback。

### 其他已對齊文件

- F-72、F-73、F-74、F-76 補上標準 implementation/test headers，並把本地測試路徑與未驗證邊界寫清楚。
- F-17 修正為實際存在的 `backend/tests/robustness/questions/questionPoolComposerService.test.js`。
- F-49 修正為目前存在的 `backend/tests/robustness/retention/postgresRetentionRepository.test.js`；它只支援 PostgreSQL retention evidence，不代表雙庫原子交易。
- `FEATURE_RFC_TEMPLATE.md` 現在要求每份新 RFC 寫 entry point、object contract、helper catalog、pseudocode、output provenance、branch/error/fallback 與 evidence matrix。
- `HIGH_LEVEL_AGENT_ARCHITECTURE_MAPPING.md` 的 RFC count 已由 71 對齊到 80，並新增 CV/JD review、URL capture、company-values 與 Match 對照入口。

## 3. 證據分級規則

1. `Verified` 只表示文件列出的 local source/test evidence 已存在；不等於 live provider、browser、human usability 或 production deployment 已驗證。
2. `Partial` 表示部分 source/test evidence 存在，或仍有 provider、browser、persistence、部署或真人 review 邊界。
3. `Planned` 表示目前沒有可引用的實作證據；不得把 RFC 的設計文字當成 runtime 行為。
4. `Verified by Tests: None` 是刻意的真實標記，不是測試失敗，也不是暗示測試不存在；它只表示該 RFC header 沒有本輪可確認的 test path。
5. 舊 RFC 中的 `Readiness Level: Production-Ready` 是歷史文件聲稱；若沒有相同 RFC 的 source/test evidence，應按上列 status 與 evidence boundary 解讀。

## 4. 工程師使用方式

不用 AI 寫新 Feature 時，先從 owning RFC 的 Blueprint 依序實作：

1. 找 entry point 與 caller，先確認 auth、owner、review 或 schema 前置條件。
2. 建立 input object 與 output object，先寫 normalize/validate helper。
3. 按 pseudocode 的順序呼叫純 helper；需要 loop 或 accumulator 時，保留明確的 `const`、mutable state 與 early-return branch。
4. 對每個 output 欄位標註來源 helper，對 provider、DB、browser 或 human review 失敗寫 fallback/error contract。
5. 只把實際存在且已執行的測試放入 `Verified by Tests`；否則填 `None` 或把狀態降為 `Partial`。

## 5. 尚未宣稱的邊界

本輪沒有執行 live Serper/DeepSeek、真實公開 JD URL、browser headed flow、Mongo/production deployment 或真人 usability review。因此 F-77–F-80 的狀態保留為 `Partial`；F-14 也保留 `Partial`。這些限制是 evidence boundary，不是把未驗證內容寫成完成。
