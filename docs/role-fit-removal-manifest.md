# Role-Fit 相容層移除清單

狀態：CV/JD/match cutover 已完成；保留一個 pre-cutover session adapter  
日期：2026-07-10

## 目前唯一主路徑

新 Analyze flow 直接使用既有 `/api/job-description/paraphrase`、`/api/analyze/match`、`CompanyValuesProfile` 與 `MatchAnalysisRecord`。沒有第二套 matcher 或永久 feature mode。

- CV evidence 已原地升級為 `cv_evidence_profile_v2`。
- JD rubric 已原地加入 `roleFit`、company understanding、role intent 與 optimistic review version。
- Match result 已原地加入 `roleEvidenceMap`；舊 `evidenceMap` 暫時保留給尚未 cutover 的 question/report/retrieval consumers。

## 暫時相容 adapter

| Adapter | 位置 | 觸發條件 | 可觀測標記 | 保留原因 |
| --- | --- | --- | --- | --- |
| Legacy reviewed JD | `backend/src/services/match/guardedMatchService.js` | JD 已有人工作業標記，但沒有 `roleFit` | `matchingDetails.compatibility.roleFit = legacy_reviewed_jd` | 讓 cutover 前已儲存的 reviewed JD/session 可以完成 match |

新 frontend 不會產生這個標記。帶有 `roleFit` 的新 request 必須通過 owner、`jdFingerprint`、profile ID、persisted review version 與 `verified` status 檢查。

## 移除門檻

滿足全部條件後刪除 legacy adapter：

1. 所有可恢復的 pre-cutover Analyze draft/session 已完成、過期或遷移。
2. Production match records 連續 14 天沒有 `legacy_reviewed_jd`。
3. Question pool、report 與 retrieval consumers 已改讀 grounded `roleEvidenceMap`，不再把舊 `evidenceMap` 當唯一來源。
4. Backend robustness、integration 與 frontend quality gate 全綠。

## 刪除動作

1. 移除 `guardedMatchService.js` 的 `attachCompatibility` 與 legacy 判斷。
2. 移除 `guardedMatchHumanReviewRobustness.test.js` 的 legacy adapter expectation，改成缺少 `roleFit` 一律要求重新 review。
3. 下游完成 cutover 後，再移除 top-level legacy `evidenceMap` 的產生與相依測試。
4. 執行 `rg -n "legacy_reviewed_jd|compatibility.roleFit|evidenceMap" backend frontend`，確認沒有未列入的 consumer。

## 目前不能刪除的部分

Top-level `evidenceMap` 仍被既有 report/retrieval/session contracts 使用，因此在本次只做到 match 的 goal 內不是 dead code。`company values enrichment` 仍負責後續 company-specific coaching research，也不是 role-fit company context 的重複實作。
