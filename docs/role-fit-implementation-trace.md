# Role-Fit Intelligence 實作追蹤

狀態：v1 historical trace；local implementation 與新流量 cutover 完成。V2 final release 狀態以 `docs/2026-07-11-role-fit-v2-implementation-trace.md` 和 `backend/eval/reports/role-fit-release-gate.latest.json` 為準。
開始日期：2026-07-10
目標文件：[Role-Fit Intelligence Goal](role-fit-goal.md)
驗收文件：[Role-Fit Intelligence Spec](role-fit-spec.md)
基線 commit：`e5c76ff04863a1938aec5dc63372dbc815c7c6b3`

V2 補充：2026-07-11 Role-Fit Closed Loop v2 已完成 human calibration、browser visual、real-backend voice flow 和 release gate 聚合；目前 release status 是 `ready_with_known_issues`，known issue 是 voice next-question first audio 超過 3 秒。本文件以下 CP0-CP6 保留 v1 歷史 checkpoint，不直接覆蓋當時的 pending gate 記錄。

## 追蹤規則

每個 checkpoint 必須依下列順序完成：

1. 將 requirement 和 edge case 對應到測試案例。
2. 在 product code 前新增或修改測試，並記錄 red baseline。
3. 修改最小且正確的 owning service/model/view。
4. 執行 focused tests，再執行受影響的 regression suites。
5. 更新本文件的 code locator、驗證結果、限制和 rollback 狀態。
6. 同步 `role-fit-goal.md`、`role-fit-spec.md`、`repo-docs/` 和 removal manifest 中真正改變的現況。

未執行、因環境受阻、只靠 mock 通過或尚未取得 UI approval 的項目不得標成完成。Real-AI、live speech provider、production migration 和 destructive cleanup 需要各自批准。

## Checkpoint 總表

| Checkpoint | 範圍 | 主要 requirement | 狀態 | 完成證據 |
| --- | --- | --- | --- | --- |
| CP0 | Phase 0-2 與 Gemini Phase 3 基線 | RFI-001 至 RFI-007 | 完成 | CV/JD/match 現況與 Phase 3 gap 稽核；見下方 CP0 |
| CP1 | Proof Strategy 與 question runtime | RFI-008、RFI-009、RFI-010 | 完成 | must-cover reconciliation、v2/v3、HTTP/SSE/WebSocket no-hint、ledger、rank trace、degraded readiness 與非技術使用者 UI tests |
| CP2 | Answer Alignment 與 report QA | RFI-011、RFI-012、RFI-013 | 實作完成；browser visual gate 待補 | accepted-answer-only alignment、grounding、7 個 deterministic QA codes、legacy/unavailable UI、TXT/PDF/API tests |
| CP3 | Voice-first Role-Fit hardening | NFR-002、RFI-010、RFI-011 | mock-safe 完成；live provider gate 待批准 | confirmation/counting/no-hint、single-blocking-LLM policy、Role-Fit ranking latency marker |
| CP4 | Retrieval、grounding、trajectory evaluation | RFI-015 | local runtime evaluator 完成；human review 待執行 | 版本化 synthetic datasets、production fusion ranker、IR/grounding/trajectory metrics、calibration no-threshold gate |
| CP5 | Cutover、privacy、retention 與 cleanup | RFI-014、RFI-016、SEC requirements | local cutover/retention 完成；snapshot cleanup 待 production gate | private retention fields/registry、verified match-only、v3 default、Role Evidence Map consumer cutover、adapter import search |
| CP6 | 全面驗證與文件收斂 | Definition of Done | local verification 完成；external gates pending | backend/frontend/eval 全綠、spec/repo docs validation、final import/diff audit |

## Requirement 到程式碼的索引

| Requirement | 目前 owner | 主要測試位置 | Checkpoint |
| --- | --- | --- | --- |
| RFI-008 Proof Strategy 完整性 | `backend/src/services/questions/roleSpecificPracticePlannerService.js`、`questionPoolPreparationService.js` | `backend/tests/robustness/questions` | CP1 |
| RFI-009 question pool v3 compatibility | `backend/src/services/questions/questionPoolComposerService.js`、`backend/src/db/models/interviewQuestionPoolItemModel.js` | `backend/tests/robustness/questions` | CP1 |
| RFI-010 safe question decision trace | `questionPoolRankerService.js`、`interviewerAgent.js`、`sessionViewBuilder.js` | `backend/tests/robustness/questions`、`voice`、`server` | CP1、CP3 |
| RFI-011 accepted-answer-only alignment | `backend/src/services/report`、`reportTurnDatasetService.js` | `backend/tests/robustness/report` | CP2 |
| RFI-012 grounded role-fit report | `reportGeneratorAgent.js`、report view model | backend/frontend report tests | CP2 |
| RFI-013 deterministic QA | `reportQaAgent.js`、`reportQaRepairOrchestratorService.js` | `backend/tests/robustness/report` | CP2 |
| RFI-014 artifact ownership/retention | Role-Fit Mongo models/repositories、retention registry | contracts/JD/retention/report tests | CP5 |
| RFI-015 retrieval/generation/trajectory evaluation | `backend/eval`、retrieval/action services | eval runners、retrieval/agent robustness tests | CP4 |
| RFI-016 replace/verify/retire | owning services、validators、removal manifest | compatibility/integration/import search | CP5 |

## CP0：基線稽核

### 已確認現況

- CV parse、JD parse/company-role review、CV-JD match 和 grounded Role Evidence Map 已在主路徑實作。
- Gemini commit 已加入 proof strategy builder、question metadata、coverage tracking、evidence ledger、ranker adjustment 和 Analyze readiness card。
- Phase 3 三項 acceptance 尚未完成：must-cover 沒有完整 reconciliation、question item 仍固定為 `v2`、live session payload 仍包含 private evidence hints。
- Runtime evidence ledger 讀取的 metadata shape 和 `masterAiService` 真正持久化的 `rankTrace` shape 不一致。
- 現有 Analyze card 顯示 question count/readiness，不是可 review 的 Proof Strategy。

### 驗證紀錄

| 驗證 | 結果 | 備註 |
| --- | --- | --- |
| `cd backend && npm run test:questions` | 87/87 通過 | 沒有覆蓋 Phase 3 三項 hard acceptance |
| `cd backend && npm run test:voice` | 64/64 通過 | 現有 voice contract 無觀察到回歸 |
| `cd backend && npm run test:integration` | 3/3 通過 | localhost bind 需在 sandbox 外執行 |
| `cd frontend && npm run test:all` | 289/289 通過 | 尚無 Proof Strategy review UI tests |
| backend/frontend lint | 通過 | `eslint --quiet` |
| frontend build | 通過 | Vite production build |
| repo-docs validator | 0 errors / 0 warnings | audit correction 已同步 |
| synthetic `buildSessionDetails` probe | 發現 blocker | `evidenceOptions` 與 `rankTrace.recommendedEvidenceIds` 會進入 client payload |

### CP0 文件 locator

- Current goal evidence status：`docs/role-fit-goal.md`
- Phase 3 acceptance：`docs/role-fit-spec.md`
- Current reader model：`repo-docs/modules/feature-match-and-question-prep.md`
- Historical correction：`repo-docs/change-log.md`

## CP1：Proof Strategy 與 question runtime

### 已完成測試

| Test ID | Requirement / edge case | 預期結果 | 狀態 |
| --- | --- | --- | --- |
| CP1-T01 | high-priority intent 沒有可用 question | 產生 bounded fallback question 或 `degraded` contract，不得 silent omission | 完成；`roleSpecificPracticePlanner.test.js`、`questionPoolComposerService.test.js` |
| CP1-T02 | gap 同時也是 high-priority intent | 不重複計算 coverage；`minQuestions` 被正確執行 | 完成；`roleSpecificPracticePlanner.test.js`、`interviewCoverageContractService.test.js` |
| CP1-T03 | v2 old item/session 與 v3 new item/session | validators、ranker、resume path 均可讀；新 session 寫 v3 | 完成；`questionPoolComposerService.test.js`、`questionPoolPreparationService.test.js` |
| CP1-T04 | active live session serialization | 移除 evidence IDs、proof point、candidate alternatives、internal reason/prompt | 完成；`sessionViewRoleFitRedaction.test.js`、`liveInterviewPayloadService.test.js` |
| CP1-T05 | completed/report-safe diagnostics | 保留必要狀態摘要，不回傳 raw CV/JD、private evidence 或 hidden reasoning | 完成；`sessionViewRoleFitRedaction.test.js`、report route integration test |
| CP1-T06 | production transcript metadata shape | ledger 從 persisted `rankTrace` 計算 evidence/angle overuse | 完成；`questionPoolRankerRoleFit.test.js` |
| CP1-T07 | rank adjustment trace | base score 與五個 Role-Fit adjustment 分開且可重跑 | 完成；`questionPoolRankerRoleFit.test.js` |
| CP1-T08 | invalid/missing proof strategy | 舊 v2 ranking 可繼續，readiness 明確為 `degraded` | 完成；`questionPoolPreparationService.test.js` |
| CP1-T09 | reserve question 補足 pool | reserve item 使用 v3；不代表 must-cover 時不虛構 coverage | 完成；`questionPoolPreparationService.test.js` |

### Product code locator

| 行為 | Owning code | 說明 |
| --- | --- | --- |
| Proof Strategy 與唯一 coverage contract | `backend/src/services/questions/roleSpecificPracticePlannerService.js` | 將 intent/gap 收斂成不重複的 `mustCover`；缺少 role-fit artifact 時顯式降級。 |
| must-cover reconciliation 與 bounded fallback | `backend/src/services/questions/roleFitQuestionCoverageService.js` | 檢查每個 coverage ID 是否有 active question；缺題時建立 deterministic v3 fallback。 |
| v3 寫入與 v2 reader | `backend/src/services/questions/questionPoolComposerService.js`、`questionPoolPreparationService.js`、`backend/src/db/models/interviewQuestionPoolItemModel.js` | 新 prepared item 寫 v3；既有 v2/無版本 snapshot 繼續可讀。 |
| runtime coverage 與 evidence ledger | `backend/src/services/questions/interviewCoverageContractService.js`、`evidenceUsageLedgerService.js` | 只計 countable question；從實際持久化的 `questionDecision.rankTrace` / `metadata.rankTrace` 讀取使用紀錄。 |
| 可重跑 ranking adjustment | `backend/src/services/questions/questionPoolRankerService.js` | 將 base score 與 role intent、evidence strength、未覆蓋、gap risk、overuse 五項 adjustment 分開記錄。 |
| live payload allowlist | `backend/src/services/interview/liveInterviewPayloadService.js`、`backend/src/services/session/sessionViewBuilder.js` | HTTP、SSE、WebSocket 共用安全 view；不回傳 rationale、retrieval、evaluator、ReAct trace 或 private role-fit metadata。 |
| 非技術使用者 review UI | `backend/src/services/questions/proofStrategyClientSummaryService.js`、`frontend/src/components/analyze/ProofStrategyReviewPanel.jsx` | 只顯示 focus area、gap 和題數，將 internal degraded code 轉成可採取行動的英文提示。 |

### Red baseline 與 green verification

先新增或收緊 CP1-T01 至 T09 後，focused red baseline 出現 11 個預期 question failures、1 個 session payload 洩漏、缺少 live response service，以及缺少前後端 summary component。完成 product code 後結果如下：

| 驗證 | 結果 |
| --- | --- |
| Backend question robustness | 96/96 通過 |
| Backend voice robustness | 65/65 通過 |
| Backend server robustness | 8/8 通過 |
| Backend integration | 3/3 通過；localhost bind 在 sandbox 外執行 |
| Backend `npm run test:all` | 全部 integration/robustness groups 通過 |
| Backend lint | 通過 |
| Frontend `npm run quality:all` | 47 test files、291 tests、lint 與 production build 全部通過 |

### Checkpoint 結論

- RFI-008、RFI-009、RFI-010 與 Phase 3 三項 hard acceptance 已完成。
- 新 session 寫 v3；v2/無版本 reader 是暫時 snapshot adapter，已登記在 removal manifest。
- client-facing UI/API 不取得 private proof/evidence/rank trace；server-side ID-based audit 仍保留給後續 report QA。
- 本 checkpoint 未執行 real-AI 或 live speech provider 測試；兩者不影響 deterministic Phase 3 acceptance，但仍是 CP3/CP4 的明確限制。

### CP1 安全邊界

- Live client 不得收到 private CV evidence recommendation、proof-point explanation、internal candidate ranking 或 raw reasoning。
- Coverage 只由已正式提出的 countable interview question 推進；repair、confirmation、clarification 和 system turn 不推進。
- 新 session 使用 v3 主契約；v2 reader 只服務 pre-cutover snapshot，不建立長期第二套 runtime。
- Proof strategy 缺失或 invalid 時必須顯式降級，不能假裝 `ready`。

## CP2：Answer Alignment 與 report QA

### 已完成測試

| Test ID | Requirement / edge case | 預期結果 | 狀態 |
| --- | --- | --- | --- |
| CP2-T01 | accepted question-answer pair 有 v3 proof metadata | 產生 `answer_alignment_v1`、0-100 breakdown、label 與 grounding status | 完成；`answerAlignmentService.test.js` |
| CP2-T02 | repair、confirmation、clarification、rejected/pending transcript | 不建立 AnswerAlignment、不推進 report coverage | 完成；`answerAlignmentService.test.js`、既有 turn dataset tests |
| CP2-T03 | direct/adjacent/no detected evidence | 只有 source-traced evidence ID 可列入；無可信 evidence 時顯式 `limited` | 完成；`answerAlignmentService.test.js` |
| CP2-T04 | missing Role-Fit artifact / old report | 回傳 `legacy` 或 `unavailable`，既有 report sections 繼續顯示 | 完成；backend service、frontend view/component tests |
| CP2-T05 | 七個 Role-Fit QA integrity failures | 全部加入 blocking flags，任一命中即不得 ready | 完成；`reportFrameworkQa.test.js` |
| CP2-T06 | wording repair 遇到 deterministic failure | 不呼叫 rewrite/report QA agent，不清除 blocking result | 完成；`reportQaRoleFitRepair.test.js` |
| CP2-T07 | API/schema/TXT/PDF/UI | v7 report 保留 Role-Fit extension；所有介面使用 plain English 且不顯示 internal IDs | 完成；integration、export、view/component/PDF tests |

### Product code locator

| 行為 | Owning code | 說明 |
| --- | --- | --- |
| accepted-answer alignment | `backend/src/services/report/answerAlignmentService.js` | 解析 persisted question metadata，使用 accepted answer、Role Evidence Map source trace 和 deterministic signals 計分。 |
| report v7 extension | `backend/src/services/agents/reportGeneratorAgent.js`、`reportGenerator/reportDraftBuilder.js`、`schemaValidationService.js` | 原地加入 `report.roleFit`，沒有第二份 report store。 |
| deterministic QA | `backend/src/services/agents/reportQaAgent.js` | 驗證 role intent、proof point、grounding、company claim、evidence ID、must-cover 和 ownership。 |
| bounded repair | `backend/src/services/report/reportQaRepairOrchestratorService.js` | Role-Fit integrity failure 只允許 deterministic regeneration，不允許 wording rewrite 洗掉。 |
| 非技術使用者報告 UI | `frontend/src/components/report/RoleFitReportSection.jsx`、`frontend/src/utils/reportView/viewModel.js` | 顯示 role focus、使用過的例子、逐答對齊與下一步；不顯示 schema/coverage/proof/evidence ID。 |
| export | `backend/src/controllers/reportController.js`、`frontend/src/utils/reportHelpers.js`、`frontend/src/utils/reportPdf/reportPdfTemplate.js` | TXT/PDF 和畫面使用相同 plain-language Role-Fit結果。 |

### Red baseline 與 green verification

第一輪 red baseline：backend 因 alignment service 缺失與七個 QA code 未實作而有 2 個 failed suites；frontend 因 view model/component 缺失而有 2 個 failed suites。第二輪 export red baseline：backend TXT formatter 未 export，frontend TXT/PDF 完全缺少 Role-Fit內容。完成 product code 後：

| 驗證 | 結果 |
| --- | --- |
| Backend report robustness | 15 files、81 tests 全部通過 |
| Backend voice robustness | 20 files、65 tests 全部通過 |
| Backend integration | 2 files、3 tests 全部通過 |
| Backend 全 robustness groups | agent/company/contracts/CV/JD/LLM/match/questions/recording/report/retrieval/server/voice 全部通過 |
| Backend lint | 通過 |
| Frontend `npm run quality:all` | 48 files、296 tests、lint 與 production build 全部通過 |
| `git diff --check` | 通過 |

### Checkpoint 限制

- Headless Playwright 在 sandbox 內因 macOS Mach port 權限失敗；提權又被環境 usage-limit reviewer 拒絕，因此 desktop/mobile screenshot、pixel 與 overflow browser probe 尚未取得有效證據。
- Component tests 已覆蓋 ready/limited/unavailable/legacy 和長文換行所需 DOM/class contract，但不把它冒充 browser visual evidence。
- 本機 frontend 已啟動於 `http://127.0.0.1:5174/`，可供人工查看；browser visual gate 完成前 CP2 不標為完全完成。

證據狀態：CP0、CP1 已完成；CP2 的 product code、contract tests、API/export 與完整 mock-safe gates 已完成，browser visual gate 待補。CP3 之後仍待實作，只有完成對應 tests、product code、文件同步和 verification 後才更新。

## CP3：Voice-first Role-Fit hardening

### Test-first gap 與 locator

唯一缺少的 deterministic acceptance 是 Role-Fit ranking 沒有獨立 latency marker。先在 `backend/tests/robustness/questions/interviewTurnOrchestratorService.test.js` 新增 failing case，再於 `backend/src/services/questions/interviewTurnOrchestratorService.js` 的既有 timing block 加入：

- `roleFitQuestionRankingEnabled`
- `roleFitQuestionRankingMs`

這兩個欄位重用 `rootCandidateRankMs`，沒有新增計算、I/O、company fetch、taxonomy load 或 model call。`backend/src/services/masterAiService.js` 已會把 question latency entries 寫成 adaptive trace marker。

### Verification

| 驗證 | 結果 |
| --- | --- |
| Red baseline | 1 個預期 latency contract failure；其餘 question tests 96 個通過 |
| Backend questions | 25 files、97 tests 全部通過 |
| Backend voice | 20 files、65 tests 全部通過 |
| Single blocking LLM policy | `duplex_voice` / `realtime_voice` 維持一個既有 blocking naturalization lane |
| Confirmation/counting | contentful low-confidence 仍進 confirmation；repair/confirmation 不計 question/answer/coverage |
| Live payload | HTTP/SSE/WebSocket no-hint tests 維持全綠 |
| Backend lint / diff check | 通過 |

### Checkpoint 限制

- Mock-safe Phase 5 acceptance 已完成。
- Azure/ElevenLabs live provider 的 `speech end -> first audio <= 3s` benchmark 未執行，因為需要 credentials、成本與明確批准；不把 mock latency 冒充 live SLO。
- CP3 在總表維持「live provider gate 待批准」，但未批准的 external run 不阻止進入獨立的 CP4 local evaluation 實作。

證據狀態：CP0、CP1 完成；CP2 product code 完成但 browser visual gate 待補；CP3 mock-safe acceptance 完成但 live provider gate 待批准。CP4 之後待實作。

## CP4：Retrieval、grounding、trajectory evaluation

### Test-first gap

先新增三組 evaluator contract tests。第一輪 red baseline 有 3 個 failed suites，原因是 runtime retrieval、generation grounding 與 runtime trajectory evaluator 尚不存在。第二輪 dataset/report red baseline 有 3 個預期 failure：缺少 aggregate/slice runner，且舊 fingerprint 沒有包含 nested fusion config。第三輪 dataset red baseline 有 5 個預期 ENOENT，證明三份版本化資料集尚未建立。human calibration red baseline 則因 evaluator module 尚不存在而失敗。

### Product 與 eval locator

| 行為 | Owning code | 說明 |
| --- | --- | --- |
| 共用 production retrieval ranker | `backend/src/services/ragRetrievalService.js` | PostgreSQL runtime 與 deterministic in-memory eval 共用相同 source policy、semantic/keyword/metadata 55/35/10 fusion、minimum score、排序與 topK。 |
| ranked retrieval metrics | `backend/eval/helpers/runtimeRetrievalEvaluator.js` | 每 case 寫 ranked chunks、scores、`precisionAtK`、`recallAtK`、MRR、nDCG、forbidden rate、source-policy accuracy、latency 和 config fingerprint。 |
| claim-level grounding | `backend/eval/helpers/generationGroundingEvaluator.js` | generation 與 retrieval ranking 分開；以 claim class 限制 CV/JD/match source，不把 JD requirement 升級成 candidate evidence。 |
| runtime ReAct trajectory | `backend/eval/helpers/runtimeTrajectoryEvaluator.js` | 直接呼叫 `selectNextAction`、`getToolNameForAction` 和 `buildTrajectoryStep`，記錄 action、tool、args、observation、terminal state、state safety 與 latency。 |
| dataset / CLI cutover | `backend/eval/datasets/**/**-v1.json`、`backend/eval/runners`、`backend/package.json` | `eval:retrieval` / `eval:agent-trajectory` 已切到 runtime path；舊 phrase/handwritten trace judge 改由 `*:safety` 執行。 |
| human calibration gate | `backend/eval/helpers/humanCalibrationEvaluator.js`、`backend/eval/manual-review/role-fit-calibration-v1.json` | 只有完整 reviewer/date/rationale 和雙 reviewer threshold decision 才可宣稱數值 release threshold。CP4 當時為 0/6、`not_set`；current V2 final 已完成 12/12 calibration、threshold 0.85。 |

### Versioned synthetic datasets

- `runtime-retrieval-v1.json`：5 cases，涵蓋 CV、JD role intent、match gap、source policy 和 interview plan。
- `generation-grounding-v1.json`：5 cases，涵蓋 candidate evidence、role requirement、gap、noise 與 mixed-source claim policy。
- `runtime-trajectory-v1.json`：5 cases，涵蓋 vague-answer probe、misunderstanding repair、fresh anchor、wrap 與 report action。
- 所有 case 只有 synthetic material，並有 `datasetVersion`、domain/risk labels、expected contract 與 per-case output。

### Verification

| 驗證 | 結果 |
| --- | --- |
| 新 evaluator/dataset focused tests | 4 files、16 tests 全部通過 |
| Human calibration evaluator | 3/3 通過 |
| Backend retrieval robustness | 9 files、25 tests 全部通過 |
| Backend agent robustness | 13 files、81 tests 全部通過 |
| `npm run eval:retrieval` | 10 cases；runtime retrieval + generation grounding average 1.00；報告保留 per-case ranked/claim records |
| `npm run eval:agent-trajectory` | 5 cases；average 1.00；報告保留 runtime planner trajectory records |
| `npm run eval:retrieval-safety` | 舊 8-case fixture safety average 0.97；獨立報告，不再代表 runtime benchmark |
| `npm run eval:agent-trajectory-safety` | 舊 3-case handwritten trace safety average 1.00；獨立報告 |
| `npm run eval:calibration` | CP4 當時 `pending_human_review`；0/6；current V2 final 已完成 12/12 review 並允許 0.85 release threshold |

### Checkpoint 結論與限制

- RFI-015 的 local/mock-safe actual-ranking、generation-grounding、runtime planner trajectory evaluator 與 calibration workflow 已落地。
- `1.00` 只表示這批 synthetic deterministic cases 通過，不表示 production semantic retrieval、real-AI generation 或人類校準已完成。
- generation suite 評估版本化 synthetic outputs，不呼叫付費 LLM；semantic paraphrase judge / real generated output eval 需要 real-provider approval 後另跑。
- trajectory suite 執行正式 planner、tool mapping 與 trajectory builder，但不發出 external tool/provider call；這是 action contract eval，不是 live interview E2E。
- CP4 當時真實 reviewer 尚未填寫 6 個 calibration cases，因此 Phase 6 的 numerical release threshold acceptance 保持 pending；current V2 final 已完成 12/12 calibration，歷史紀錄保留作為 checkpoint 追溯。

證據狀態：CP4 local runtime evaluator 已完成；human calibration review、CP2 browser visual、CP3 live provider SLO 仍是明確外部 gate。下一步進入 CP5 privacy/cutover/removal audit。

## CP5：Cutover、privacy、retention 與 cleanup

### Test-first gap

新增 cutover/retention contract、match service 與既有 safeguard/repository tests 後，red baseline 共 6 個預期 failure：新 match 仍接受沒有 Role-Fit 的舊 rubric、`legacy_reviewed_jd` 仍可由 client marker 觸發、question model default 仍為 v2、Company/Question/Report 缺少部分 private retention fields、SessionAnalysis 沒有 `roleEvidenceMap` 欄位、Role-Fit draft 寫入沒有 retention renewal。consumer cutover 另有 2 個 red failures：新 match result 仍雙寫 legacy evidence summary，RAG index 不認得 Role Evidence Map。

### Product code locator

| 行為 | Owning code | 說明 |
| --- | --- | --- |
| verified Role-Fit-only new match | `backend/src/services/cv/cvAnalysisService.js`、`match/guardedMatchService.js` | 缺少 persisted owner/fingerprint/profile/version verification 一律阻擋；移除 `legacy_reviewed_jd` attach/entrypoint。 |
| private artifact retention | `companyValuesProfileModel.js`、`interviewQuestionPoolItemModel.js`、`sessionAnalysisModel.js`、`sessionReportModel.js` | 補 `retentionUntil`、`deletedAt`、`containsSensitiveData`、`accessScope`、owner/schema；collections 已在既有 Mongo retention registry。 |
| write-time retention renewal | `companyValuesRepository.js`、`masterAiService.js`、`reportQaRewriteController.js` | Role-Fit draft/review/report 新寫入與更新都延長既有 7-day policy，沒有另造 retention duration。 |
| new-session v3 writer | `interviewQuestionPoolItemModel.js`、`questionPoolComposerService.js` | model default 與 explicit composer write 都是 v3；舊 v2 reader不會建立新 v2 item。 |
| Role Evidence Map consumer cutover | `scoringSchemaService.js`、`sessionPersistenceService.js`、`ragIndexService.js`、`reportDraftBuilder.js` | 新 result 不再填 legacy evidence summary；session 保存 Role Evidence Map；RAG/report 有 map 時不使用 legacy summary。 |
| removal registry | `docs/role-fit-removal-manifest.md` | legacy reviewed-JD adapter 標記 removed；其餘三個 reader 有 owner、trigger、observable marker、gate/status。 |

### Verification

| 驗證 | 結果 |
| --- | --- |
| CP5 focused red -> green | 4 files、14 tests 全部通過；原先 6 failures 已消除 |
| Role Evidence Map match/RAG cutover | 2 files、10 tests 全部通過 |
| Report Role Evidence Map cutover | 1/1 通過 |
| Backend match | 5 files、22 tests 全部通過 |
| Backend JD | 8 files、21 tests 全部通過；mock-safe fallback 遇到無網路仍通過 |
| Backend contracts | 5 files、14 tests 全部通過 |
| Backend retention | 15 files、55 tests 全部通過 |
| Backend report | 16 files、82 tests 全部通過 |
| Production import search | `legacy_reviewed_jd`、Role-Fit kill-switch names、question default v2、`legacyItems` 為 0；只剩列冊 old question/report/evidence readers |
| Backend lint / `git diff --check` | 通過 |

### Checkpoint 結論與限制

- RFI-014 local implementation 已完成：Role-Fit-bearing artifacts 有 owner/session、schema、private retention metadata，並使用現有 registry/policy；route/report ownership tests 保持有效。
- RFI-016 的新流量 cutover 已完成；不安全且無 server-side snapshot provenance 的 reviewed-JD adapter 已刪除。未形成 session 的舊 local draft必須重新完成 Job + Company review。
- 三個 pre-cutover read adapters 不能在本工作區宣稱可刪除，因為缺少 production 14-day telemetry、migration 或 retention-window closure evidence。manifest 明確維持 `active`，沒有把「暫時保留」包裝成完成 cleanup。
- 沒有執行 destructive production data cleanup；retention execution 本身仍要求 dry run、reviewed run ID、backup verification 和明確 approval token。

證據狀態：CP5 local cutover/privacy/retention code 完成；production snapshot adapters 的最終刪除受 retention/resume 外部 gate 阻擋。下一步 CP6 執行全套 mock-safe verification、文件 validator 與最終 gap report。

## CP6：全面驗證與文件收斂

### Final local verification

| Gate | 結果 |
| --- | --- |
| Backend robustness groups | agent 81、company 7、contracts 14、CV 23、JD 21、LLM 4、match 22、questions 97、recording 17、report 82、retrieval 29、server 8、voice 65；共 470 tests 全部通過 |
| Backend integration | 2 files、3 tests 全部通過；monolithic sandbox run 因 `listen 127.0.0.1 EPERM` 失敗後，以允許 loopback 的相同 test command 補跑通過 |
| Backend lint / diff | `npm run lint` 與 `git diff --check` 通過 |
| Frontend quality | 48 files、296 tests、ESLint、Vite production build（2100 modules）全部通過 |
| Full mock-safe eval | E2E 20 cases=0.99、Green 20=0.99、voice robustness 8=1.00、runtime retrieval+grounding 10=1.00、runtime trajectory 5=1.00、company research 5=0.93、voice quality 6=1.00、stability 3=1.00 |
| Historical safety eval | retrieval fixture 8=0.97；trajectory fixture 3=1.00；與 runtime reports 分檔 |
| Human calibration | CP6 當時 0/6、`pending_human_review`、`canAssertNumericalReleaseThreshold=false`；current V2 final 已完成 12/12 calibration、threshold 0.85 |
| Spec lint | 8/8 pass |
| Repo docs validator | 0 errors、0 warnings |
| Final import search | `legacy_reviewed_jd`、Role-Fit kill-switch names、question default v2、`legacyItems` production references 為 0；只剩 manifest 列冊 readers |

### Definition of Done 對照

- 本地可實作的 main flow、artifact owner/schema/source trace、text/mock voice、grounded report、focused/full mock-safe gates、new-traffic cutover 和文件同步已完成。
- 沒有執行 real-AI eval，因為需要 credentials、成本與明確批准。
- 沒有取得 browser desktop/mobile visual evidence；Playwright 受 sandbox Mach port 權限阻擋，提權被環境 usage-limit reviewer 拒絕。component/DOM tests 不能冒充 visual gate。
- 沒有執行 Azure/ElevenLabs live 3-second SLO，因為需要 provider credentials、成本與批准。
- 沒有把 human calibration 填成假 review；仍需真實 reviewer 完成 6 cases。
- 沒有刪除仍可能服務 pre-cutover snapshots 的三個 readers；需 production 14-day telemetry、migration 或 retention-window closure 後，依 manifest 執行最終刪除。

### 最終結論

`docs/role-fit-goal.md` 對應的 local product/evaluation/cutover implementation 已收斂，後續修改可從 CP1-CP5 的 requirement -> test -> code locator 追查。整份 goal 仍不能標記為 production Definition of Done，阻塞項不是未寫的 local code，而是 browser、live provider、真實 human calibration 與 production snapshot-retention 四個外部 release gates。
