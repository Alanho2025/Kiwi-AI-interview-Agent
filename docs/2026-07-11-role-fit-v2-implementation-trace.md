# Role-Fit Closed Loop v2 Implementation Trace

狀態：V2-0 至 V2-6 first slices 已完成；human calibration / real-provider / browser-live gates 仍待後續  
開始日期：2026-07-11 NZST  
目標文件：[Role-Fit Closed Loop v2 Goal](2026-07-11-role-fit-v2-goal.md)  
Spec：[Role-Fit Closed Loop v2 Spec](2026-07-11-role-fit-v2-spec.md)  
基線 commit：`1eeaa907d8f7d90d6b226f2d6d0f49afa07ceacc`

## Checkpoint 總表

| Checkpoint | Scope | Status | Evidence |
| --- | --- | --- | --- |
| V2-0 | Contract hardening：source/review confidence、URL-only diagnostics、thin controller split、compact diagnostics propagation | 已完成第一切片；RFV2-008 propagation addendum 已補齊 | JD robustness 22/22、match robustness 23/23、contracts 15/15、questions 97/97、server 8/8、report 84/84、backend prep-stability/lint |
| V2-1 | Website-grounded company intelligence + SSRF/content guard | bounded same-origin candidate pages、safety slice 與 manual/website conflict diagnostics 已完成；richer hiring intelligence 待實作 | JD robustness 29/29、company 7/7、match 23/23、backend prep-stability/lint |
| V2-2 | Hiring-logic company understanding + RoleIntentDecoder v2 | deterministic company-understanding details、role-intent slice 與 compact role-intent diagnostics 已完成；bounded critic/LLM expansion 待實作 | JD robustness 31/31、contracts 15/15、match 23/23、questions 97/97、report 84/84、backend prep-stability/lint |
| V2-3 | CandidateEvidenceGraph v2 + RoleEvidenceMap v2 | first slice 已完成；UX/ranking/report deeper use 待後續 | CV/match/questions/report focused gates 通過；v1 compatibility marker 保留 |
| V2-4 | Proof Strategy UX + metadata-aware ranking hardening | first slice 已完成；deeper calibration 待後續 | questions/server/voice/frontend focused gates 通過；active live no-hint 保持 |
| V2-5 | Answer Alignment v2 dimensions + QA expansion | first slice 已完成；calibration 待後續 | report/frontend focused gates 通過；v1 compatibility marker 保留 |
| V2-6 | Adversarial eval + human calibration + cleanup | first slice 已完成；production threshold 仍 blocked | retrieval 31/31、`eval:agent-framework` mock-safe 通過；calibration 0/12 pending |

## V2-0：Contract hardening

### 已完成

- `roleFitProfileBuilder` 生成 company facts 和 role intent items 時新增：
  - `sourceConfidence`
  - `reviewConfidence`
  - `claimStatus`
- website-only company context 改為顯式 `supplied_url_only`，並在 `roleFitDiagnostics` 中標示 `companyContextStatus: url_supplied` 與 `company_website_content_not_verified`。
- role-fit review confirmation 會把 facts/items 的 `reviewConfidence` 改為 `user_confirmed`，但保留原本 `sourceConfidence`。
- frontend human-edited role intent 不再寫入 `confidence: 1`；新增 item 會標示 `sourceConfidence: unsupported` 與 `reviewConfidence: user_modified`。
- `jobDescriptionController.paraphraseJD` 的 preparation orchestration 已抽到 `jobDescriptionPreparationService`，controller 回到 request/response orchestration。

### Tests first

新增/收緊的紅線：

- `backend/tests/robustness/jd/roleFitJdContextRobustness.test.js`
  - source/review confidence
  - role-fit diagnostics
  - website-only URL 不冒充 grounded website evidence
- `backend/tests/robustness/jd/roleFitReviewRepositoryRobustness.test.js`
  - confirm review 時只提升 review confidence，不覆蓋 source confidence
- `frontend/src/components/analyze/__tests__/JobContextCard.test.jsx`
  - human edit 不再產生 `confidence: 1`

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:jd` | 8 files、22 tests 通過 |
| `cd backend && npm run test:match` | 5 files、22 tests 通過 |
| `cd backend && npm run lint` | 通過 |
| `cd frontend && npm run test -- src/components/analyze/__tests__/JobContextCard.test.jsx` | 1 test 通過 |
| `cd frontend && npm run test:components` | 12 files、32 tests 通過 |
| `cd frontend && npm run lint` | 通過 |

### RFV2-008 diagnostics propagation addendum

後續 audit 發現 V2-0 初版只在 preparation artifact 上建立 `roleFitDiagnostics`，尚未讓 match、proof strategy、session view 和 report 使用同一個 compact payload。這次補上 `roleFitDiagnosticsService`，輸出 `role_fit_diagnostics_v1`，只保留狀態、counts、coverage、degraded reasons 和 source limitations，不複製 CV/JD/company/private evidence 原文。

已接入的 payload：

- match result top-level `roleFitDiagnostics` 與 `matchingDetails.roleFitDiagnostics`
- Role-Fit blocked result 與 JD safeguard blocked result 的 degraded diagnostics
- proof strategy `roleFitDiagnostics`
- session view `interviewPlan.roleFit.diagnostics`、`analysisResult.roleFitDiagnostics` 和 `analysisSetup.roleFitDiagnostics`
- report `roleFit.roleFitDiagnostics`

### Tests first

新增/收緊的紅線：

- `backend/tests/robustness/contracts/roleFitDiagnosticsContract.test.js`
  - diagnostics 必須只輸出 compact readiness/count/coverage 資料，不得複製 private snippets。
- `backend/tests/robustness/match/roleEvidenceMapRobustness.test.js`
  - validated match result 必須保留 top-level 和 `matchingDetails` diagnostics。
- `backend/tests/robustness/match/guardedMatchHumanReviewRobustness.test.js`
  - Role-Fit gate 與 JD safeguard blocked result 必須保留 degraded diagnostics。
- `backend/tests/robustness/questions/roleSpecificPracticePlanner.test.js`
  - proof strategy 必須攜帶 diagnostics，degraded strategy 必須保留 reason。
- `backend/tests/robustness/server/sessionViewRoleFitRedaction.test.js`
  - session payload 可帶 compact diagnostics，但不得洩漏 preparation guidance / evidence text。
- `backend/tests/robustness/report/answerAlignmentService.test.js`
  - report Role-Fit summary 必須攜帶 diagnostics。

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:contracts` | 6 files、15 tests 通過 |
| `cd backend && npm run test:match` | 5 files、23 tests 通過 |
| `cd backend && npm run test:questions` | 25 files、97 tests 通過 |
| `cd backend && npm run test:server` | 4 files、8 tests 通過 |
| `cd backend && npm run test:report` | 16 files、84 tests 通過 |
| `cd backend && npm run test:prep-stability` | CV/JD/match/questions/retrieval/report/contracts robustness groups 通過 |
| `cd backend && npm run eval:role-fit-v2-adversarial` | 12 cases；dataset checks passed；production claim blocked by `human_calibration_pending` |
| `cd backend && npm run eval:calibration` | pending_human_review；0/12 reviewed；numerical threshold 不允許 |
| `cd backend && npm run lint` | 通過 |
| `python3 /Users/heminghan/.codex/skills/repo-docs/scripts/validate_repo_docs.py /Users/heminghan/Kiwi-AI-interview-Agent/repo-docs --repo-root /Users/heminghan/Kiwi-AI-interview-Agent` | 0 errors、2 existing warnings |
| `python3 /Users/heminghan/.codex/skills/spec-driven-development-blueprint/scripts/spec_lint.py docs/2026-07-11-role-fit-v2-spec.md --format json` | 8/8 pass |
| `git diff --check` | 通過 |

### Remaining V2-0 notes

- `roleFitDiagnostics` 已完成本地 match/proof/session/report compact propagation。
- Browser UI visual gate、real-provider calibration 和 production snapshot gate 仍屬外部驗收，不由本地 diagnostics propagation 取代。

## V2-1：Website evidence safety slice

### 已完成

- 新增 `companyWebsiteEvidenceService`，用 existing `urlSafetyService` 做 public HTTP(S) URL gate。
- 不公開或 private/local host 在 fetch 前 blocked，並記錄 `private_or_non_public_host`。
- Fetch 使用 `redirect: manual`，不跟 cross-host redirect；redirect 回 `redirect_blocked`。
- 限制 content type 和 content length；只保存 bounded visible-text snippets，不保存 full raw HTML。
- `jobDescriptionPreparationService` 在 JD preparation 階段嘗試建立 `companyWebsiteEvidence`；blocked/failed 時降級，不冒充 website-grounded facts。
- `companyWebsiteEvidenceService` 會抓取 bounded same-origin candidate pages（預設 base URL + `/about`，可用 `maxPages` 控制）；每頁仍使用 manual redirect、content type、content length 和 timeout gate。
- `roleFitProfileBuilder` 在 snippets 存在時產生 `company_website` facts、`groundingStatus: website_grounded` 和 `companyContextStatus: grounded`。
- Manual company context 明確否定 website evidence 內 domain term 時，`companyUnderstanding.summary` 會顯示 sources conflict，並輸出 `sourceConflicts[]`、`company_context_source_conflict` 和 `manual_website_context_conflict`；diagnostics 不複製 manual/website 原文。

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:jd` | 9 files、29 tests 通過 |
| `cd backend && npm run test:company` | 2 files、7 tests 通過 |
| `cd backend && npm run test:contracts` | 6 files、15 tests 通過 |
| `cd backend && npm run test:match` | 5 files、23 tests 通過 |
| `cd backend && npm run test:questions` | 25 files、97 tests 通過 |
| `cd backend && npm run test:report` | 16 files、84 tests 通過 |
| `cd backend && npm run test:prep-stability` | CV/JD/match/questions/retrieval/report/contracts robustness groups 通過 |
| `cd backend && npm run lint` | 通過 |

### Remaining V2-1 notes

- 目前是 bounded same-origin candidate page capture，不是 full company research crawler。
- 沒有新增外部 provider、dependency 或 real network verification。
- More complete company intelligence fields such as business model, customers/users and hiring context still require richer deterministic extraction / review UX beyond this safety slice.

## V2-2：Deterministic RoleIntentDecoder slice

### 已完成

- 新增 `companyUnderstandingDetailService`，從既有 company facts deterministic 產生：
  - `schemaVersion: company_understanding_v2`
  - `businessModel`
  - `customersOrUsers`
  - `productsOrServices`
  - `operatingContext`
  - `hiringContextHypotheses`
- Company-understanding detail fields 只使用已存在的 manual / website / JD facts，不新增外部 provider；hiring context hypothesis 標為 `needs_confirmation` 並保留 evidence refs、`sourceConfidence`、`reviewConfidence`。
- Role-Fit review confirmation 會把 company-understanding detail fields 的 `reviewConfidence` 提升為 `user_confirmed`，但保留原本 `sourceConfidence`。
- 新增 `roleIntentDecoderService`，從 `roleFitProfileBuilder` 分離 role intent construction。
- 保留既有 `roleIntent.items` / `highPriorityCount` contract，避免破壞 match 和 downstream readers。
- 新增 deterministic hiring-logic fields：
  - `rolePurpose`
  - `businessProblemHypotheses`
  - `workflowPainPoints`
  - `idealCandidateSignals`
  - `interviewProbeMap`
  - `uncertainties`
- Hiring-logic fields 使用 JD/company evidence refs、`sourceConfidence`、`reviewConfidence` 和 `claimStatus`；role purpose / business hypotheses 仍標為 preparation hypothesis，需要 user review。
- Role intent artifact 現在輸出 `schemaVersion: role_intent_decoder_v2` 與 `diagnostics[]`；當 company source 缺失、company context 衝突或 workflow signal 缺失時，會產生 compact diagnostic code / degraded reason。
- `roleFitDiagnostics` 會承接 RoleIntentDecoder 的 `degradedReason` 和 diagnostic `code`，例如缺少 grounded company support 時輸出 `low_confidence_hiring_logic` 與 `role_intent_company_source_missing`，但不複製 JD、company context 或 CV 原文。

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:jd` | 9 files、31 tests 通過 |
| `cd backend && npm run test:contracts` | 6 files、15 tests 通過 |
| `cd backend && npm run test:match` | 5 files、23 tests 通過 |
| `cd backend && npm run test:questions` | 25 files、97 tests 通過 |
| `cd backend && npm run test:report` | 16 files、84 tests 通過 |
| `cd backend && npm run test:prep-stability` | CV/JD/match/questions/retrieval/report/contracts robustness groups 通過 |
| `cd backend && npm run lint` | 通過 |

### Remaining V2-2 notes

- 目前是 deterministic decoder，不呼叫 LLM。
- Unsupported-claim critic、schema repair 和 richer company business-model inference / review UX 仍待後續 phase。

## V2-3：CandidateEvidenceGraph / RoleEvidenceMap v2 slice

### 已完成

- `cvEvidenceProfileBuilder` 在 stable private evidence item 上新增：
  - `candidateEvidenceSource`
  - `title`
  - `proofAngles`
  - `strengthSignals`
  - `howToSayIt`
  - `avoidUsingFor`
  - `fitLimits`
- `cvEvidenceProfile` 新增 `candidateEvidenceGraph` artifact：
  - `schemaVersion: candidate_evidence_graph_v2`
  - `accessScope: private`
  - `evidenceItems[]` 使用 stable `evidenceId` 和 source trace。
- `semanticEvidenceService` / deterministic semantic matcher 保留 evidence guidance fields，不在 ranking 過程裁掉。
- `roleEvidenceMapService` 升級到：
  - `schemaVersion: role_evidence_map_v2`
  - `compatibilityVersion: role_evidence_map_v1`
  - `fitType`
  - `proofAngle`
  - `evidenceGuidance`
  - `hiringLogicLinks`
- `hiringLogicLinks` 會連到 role purpose、business problem、workflow pain、ideal candidate signal 和 interview probe IDs；source trace gate 和 direct/adjacent/weak/gap scoring logic 保持原有安全邊界。

### Tests first

新增/收緊的紅線：

- `backend/tests/robustness/cv/cvParsingRobustness.test.js`
  - CV evidence item 必須有 proof angles、strength signals、how-to-say-it、avoid-using、fit limits。
  - profile 必須輸出 `candidate_evidence_graph_v2` private artifact。
- `backend/tests/robustness/match/roleEvidenceMapRobustness.test.js`
  - Role Evidence Map 必須輸出 v2 schema 和 v1 compatibility marker。
  - source evidence 必須攜帶 evidence guidance。
  - map item 必須有 hiring-logic links。

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:cv` | 2 files、23 tests 通過 |
| `cd backend && npm run test:match` | 5 files、22 tests 通過 |
| `cd backend && npm run test:questions` | 25 files、97 tests 通過 |
| `cd backend && npm run test:report` | 16 files、82 tests 通過 |
| `cd backend && npm run lint` | 通過 |

### Remaining V2-3 notes

- 目前 guidance 是 deterministic preparation metadata，不是 user-facing final copy。
- Proof Strategy UX、metadata-aware ranking hardening 和 Answer Alignment v2 deeper dimensions 仍屬 V2-4 / V2-5。
- Active live interview payload 仍由現有 no-hint sanitizers 保護；本 slice 沒有新增 client live hints。

## V2-4：Proof Strategy UX / ranking metadata slice

### 已完成

- `roleSpecificPracticePlannerService` 將 Role Evidence Map v2 的 `proofAngle`、`evidenceGuidance` 和 `hiringLogicLinks` 接到：
  - `proofStrategy.mustCover[].proofAngle`
  - `proofStrategy.mustCover[].preparationGuidance`
  - question pool item 的 `preparationGuidance`
  - question pool item 的 `hiringLogicCoverage`
- `questionPoolRankerService` 新增 traceable Role-Fit ranking factors：
  - `proofAngleFitBoost`
  - `hiringLogicLinkBoost`
  - `rankTrace.preparationGuidance`
  - `rankTrace.hiringLogicCoverage`
- `proofStrategyClientSummaryService` 只輸出 non-technical preparation summary：focus label、kind、proof angle、preparation hint 和 risk；不輸出 evidence ID、coverage ID 或 proof point ID。
- `ProofStrategyReviewPanel` 顯示 preparation hint / risk，作為開始面試前的 review UX。
- `sessionViewBuilder` active-session sanitizer 會移除 `preparationGuidance`、`evidenceGuidance` 和 `hiringLogicCoverage`，維持 live interview no-hint 行為。

### Tests first

新增/收緊的紅線：

- `backend/tests/robustness/questions/roleSpecificPracticePlanner.test.js`
  - proof strategy coverage 和 question metadata 必須保留 preparation guidance / hiring logic coverage。
- `backend/tests/robustness/questions/questionPoolRankerRoleFit.test.js`
  - rank trace 必須拆出 proof-angle 和 hiring-logic adjustments。
- `backend/tests/robustness/questions/proofStrategyClientSummaryService.test.js`
  - client summary 可顯示白話 preparation hint/risk，但不得洩漏 private IDs。
- `backend/tests/robustness/server/sessionViewRoleFitRedaction.test.js`
  - active session payload 不得包含 preparation guidance、evidence guidance 或 hiring logic private fields。
- `frontend/src/components/analyze/__tests__/ProofStrategyReviewPanel.test.jsx`
  - Analyze preparation panel 顯示白話 guidance，仍避免 internal terminology。

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:questions` | 25 files、97 tests 通過 |
| `cd backend && npm run test:server` | 4 files、8 tests 通過 |
| `cd backend && npm run test:voice` | 20 files、65 tests 通過 |
| `cd backend && npm run lint` | 通過 |
| `cd frontend && npm run test -- src/components/analyze/__tests__/ProofStrategyReviewPanel.test.jsx` | 1 file、2 tests 通過 |
| `cd frontend && npm run test:components` | 12 files、32 tests 通過 |
| `cd frontend && npm run lint` | 通過 |

### Remaining V2-4 notes

- This slice does not add new turn-time model/tool calls and keeps no-hint live payload sanitization.
- Ranking weights are deterministic first-pass boosts, not calibrated production weights.
- Answer Alignment v2 dimensions and expanded deterministic QA remain V2-5.

## V2-5：Answer Alignment v2 / report QA slice

### 已完成

- `answerAlignmentService` 將 accepted answer alignment 升級為：
  - `schemaVersion: answer_alignment_v2`
  - `compatibilityVersion: answer_alignment_v1`
  - six-dimension `scoreBreakdown`
    - `questionAlignment`
    - `evidenceFit`
    - `evidenceClarity`
    - `roleIntentFit`
    - `naturalness`
    - `concision`
  - `evidenceUseDiagnosis`
- Alignment total score remains bounded to the 0-100 contract by splitting the six dimensions across 100 points.
- `reportQaAgent` 新增 deterministic blocking flags：
  - `answer_alignment_score_out_of_range`
  - `answer_alignment_missing_v2_dimensions`
  - `answer_alignment_wrong_evidence_use`
- `RoleFitReportSection` 顯示 answer-level dimension scores，並保持 schema/internal IDs 不出現在 candidate-facing UI。
- `reportView` view model 保留 `scoreBreakdown` 給 report UI 使用。

### Tests first

新增/收緊的紅線：

- `backend/tests/robustness/report/answerAlignmentService.test.js`
  - accepted answer 產生 `answer_alignment_v2`、v1 compatibility marker、六分項、0-100 總分和 evidence-use diagnosis。
  - off-target answer 不得 invent support；會回 `recommended_evidence_not_used`。
- `backend/tests/robustness/report/reportFrameworkQa.test.js`
  - QA blocks v2 missing dimensions、score out of range 和 wrong-example diagnosis。
- `frontend/src/components/report/__tests__/RoleFitReportSection.test.jsx`
  - report UI 顯示 dimension scores，仍不顯示 schema/proof/evidence IDs。

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:report` | 16 files、84 tests 通過 |
| `cd backend && npm run lint` | 通過 |
| `cd frontend && npm run test -- src/components/report/__tests__/RoleFitReportSection.test.jsx` | 1 file、2 tests 通過 |
| `cd frontend && npm run test:components` | 12 files、32 tests 通過 |
| `cd frontend && npm run lint` | 通過 |

### Remaining V2-5 notes

- V2 score weights are deterministic first-pass values and still need human calibration before production-quality scoring claims.
- Real-AI wording/report calibration remains outside this mock-safe first slice.

## V2-6：Adversarial eval / human calibration gate slice

### 已完成

- 新增 `eval/datasets/role-fit-v2/adversarial-v1.json`，固定 12 個 mock-safe adversarial cases，覆蓋：
  - JD prompt injection
  - company website SSRF / URL-only grounding
  - manual context conflict
  - unsupported role-intent hypothesis
  - CV skill-only overclaim
  - semantic match without source trace
  - repeated example overuse
  - live payload recommended-evidence leakage
  - repair turn counted as answer
  - wrong example answer
  - missing Answer Alignment v2 dimensions
- 新增 `roleFitV2AdversarialEvaluator` 和 `runRoleFitV2AdversarialEval.js`，輸出：
  - `role-fit-v2-adversarial.latest.json`
  - `role-fit-v2-adversarial.latest.md`
- `backend/package.json` 新增 `eval:role-fit-v2-adversarial`，並把它接入 `eval:agent-framework`。
- `eval/manual-review/role-fit-calibration-v1.json` 擴充到 12 筆，新增 V2 adversarial cases 的 manual review records；全部保持 `humanReview: null`。
- Human calibration summary 明確維持：
  - `status: pending_human_review`
  - `reviewedCases: 0`
  - `totalCases: 12`
  - `canAssertNumericalReleaseThreshold: false`

### Tests first

新增/收緊的紅線：

- `backend/tests/robustness/retrieval/roleFitEvaluationDatasets.test.js`
  - adversarial dataset 必須是 12 筆、versioned、mock-safe、無 private local identifiers，並由 evaluator 回報 `productionClaimAllowed: false`。
  - human calibration dataset 必須是 12 筆，且未完成人工審查時禁止 numerical release threshold。

### Verification

| Command | Result |
| --- | --- |
| `cd backend && npm run test:retrieval` | 10 files、31 tests 通過 |
| `cd backend && npm run eval:role-fit-v2-adversarial` | 12 cases；dataset checks passed；production claim blocked by `human_calibration_pending` |
| `cd backend && npm run eval:calibration` | pending_human_review；0/12 reviewed；numerical threshold 不允許 |
| `cd backend && npm run eval:agent-framework` | retrieval / trajectory / Role-Fit V2 adversarial / calibration / company / voice / stability mock-safe suites 通過 |
| `cd backend && npm run test:prep-stability` | CV/JD/match/questions/retrieval/report/contracts robustness groups 通過 |
| `cd backend && npm run lint` | 通過 |
| `cd frontend && npm run quality:all` | 49 files、297 tests、lint/build 通過 |
| `python3 /Users/heminghan/.codex/skills/repo-docs/scripts/validate_repo_docs.py /Users/heminghan/Kiwi-AI-interview-Agent/repo-docs --repo-root /Users/heminghan/Kiwi-AI-interview-Agent` | 0 errors、2 existing warnings |
| `python3 /Users/heminghan/.codex/skills/spec-driven-development-blueprint/scripts/spec_lint.py docs/2026-07-11-role-fit-v2-spec.md --format json` | 8/8 pass |

### Remaining V2-6 notes

- 這個 slice 是 deterministic local gate，不呼叫 real AI provider。
- Production-quality scoring 或 release threshold 仍需真人 reviewer 完成 12 筆 calibration 並留下 auditable threshold decision。
- Browser visual gate、live provider 3 秒 voice SLO、production snapshot/retention gate 和 dead-code cleanup 仍是後續 external gates。

證據狀態：本頁只記錄已完成的本地 code/test change；V2-0 至 V2-6 皆為 first-slice implementation，仍需 external calibration / browser / live-provider gates 才能宣稱 production release 完成。
