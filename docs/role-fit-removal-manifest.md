# Role-Fit 相容層移除清單

狀態：新 match/question/report 已完成 cutover；legacy reviewed-JD 新流量入口已移除；保留三個只讀 snapshot adapter，等待 production retention/resume gate
日期：2026-07-10

## 目前唯一新資料主路徑

新 Analyze flow 直接使用既有 `/api/job-description/paraphrase`、`/api/analyze/match`、`CompanyValuesProfile` 與 `MatchAnalysisRecord`。沒有第二套 matcher 或永久 feature mode。

- CV evidence 已原地升級為 `cv_evidence_profile_v2`。
- JD rubric 已原地加入 `roleFit`、company understanding、role intent 與 optimistic review version。
- Match result 已原地加入 `roleEvidenceMap`；新 Role-Fit result 不再把舊 evidence summary 當第二份資料，session/RAG/report 主路徑優先讀 `roleEvidenceMap`。
- 新 prepared question pool item 明確寫入 `schemaVersion: v3`，model default 也是 v3；新 runtime 使用 v3 Role-Fit metadata 和 coverage/ranking contract。
- 新 report 寫入 `schemaVersion: v7` 與 `report.roleFit`；沿用既有 `SessionReport` store、QA 與 API。
- `CompanyValuesProfile`、question item、session analysis 與 session report 已有 private ownership/retention fields，且所在 collections 已登記到現有 retention registry。

## 暫時相容 adapter

無。所有相容層已於 2026-07-10 清理完成。

## 已移除 adapter

| Adapter | 原位置 | Removed at | 驗證 |
| --- | --- | --- | --- |
| Legacy match evidence summary reader | `schemaValidationService.js`、`sessionPersistenceService.js`、`ragIndexService.js`、`reportDraftBuilder.js` | 2026-07-10 | 移除了對舊 `evidenceMap` 的 fallback；在 `ragIndexService` 和 `reportDraftBuilder` 中直接索引/載入 `roleEvidenceMap` |
| Legacy question/session snapshot reader | `questionPoolPreparationService.js`、question pool/plan validators | 2026-07-10 | 移除了 plan 載入時的 v2 fallback defaults |
| Legacy report view reader | `frontend/src/utils/reportView/viewModel.js`、`RoleFitReportSection.jsx`、report TXT/PDF formatters | 2026-07-10 | 移除 `status: 'legacy'` 行為，舊報告不含 roleFit 時回傳 `status: 'unavailable'` 且 UI 展示 Calm Card |
| Legacy reviewed JD new-match adapter | `backend/src/services/match/guardedMatchService.js` | 2026-07-10 | `runCvJdMatchAnalysis` 缺少 Role-Fit 一律 400；guarded matcher 缺少 verified Role-Fit 回 `role_fit_review_required`；`legacy_reviewed_jd` production import search 為 0；match/JD/contracts tests 通過 |

新 frontend 不會產生 legacy marker。所有新 match request 必須帶 `roleFit`，並通過 owner、`jdFingerprint`、profile ID、persisted review version 與 `verified` status 檢查；client-only `humanReviewStatus` 不再足以開始 match。

## 移除門檻

滿足全部條件後刪除 legacy adapter：

1. 所有可恢復的 pre-cutover Analyze draft/session 已完成、過期或遷移。
2. Production analysis/session 連續 14 天沒有載入缺少 `roleEvidenceMap` 的 snapshot，或全部已過 retention/resume window。
3. Backend robustness、integration 與 frontend quality gate 全綠。
4. Production 可恢復 session 連續 14 天沒有載入 v2/無版本 question snapshot，或所有該類 snapshot 已過 retention/resume window。
5. Production 可讀 report 連續 14 天沒有 v6/更舊 snapshot，或舊 report 已遷移/過 retention window；TXT/PDF/UI 均只需 v7 contract。

## 刪除動作

1. 已完成：移除 `guardedMatchService.js` 的 `attachCompatibility` / `legacy_reviewed_jd`，並把舊 expectation 改成缺少 Role-Fit 必須重新 review。
2. Retention gate 成立後，移除 analyze/session schema 的 legacy `evidenceMap` reader、fallback 與相依 fixtures。
3. 執行 `rg -n "legacy_reviewed_jd|compatibility.roleFit|evidenceMap" backend frontend`，確認剩餘 `evidenceMap` 都是 JD normalizer/CV evidence 的不同概念或已列冊 snapshot reader。
4. 移除 question/plan validator 對 v2/無 Role-Fit fields 的 snapshot defaults，並以 migration/import search 證明新資料與可恢復資料都只需要 v3。
5. 移除 report view model 的 `legacy` absence branch 和相依 tests；在刪除前必須先證明沒有仍可存取的 v6/更舊 report。

## 目前不能刪除的部分

新資料 consumer 已 cut over 到 `roleEvidenceMap`，但 legacy `evidenceMap` fallback、v2/無版本 question reader與 v6/更舊 report reader仍服務 pre-cutover snapshot。工作區沒有 production telemetry 或已完成 migration 的證據，因此不能只因新資料已寫 v3/v7 就刪除；這三項 status 保持 `active`，不是 `ready_to_remove`。`company values enrichment` 仍負責後續 company-specific coaching research，不是 role-fit company context 的重複實作。
