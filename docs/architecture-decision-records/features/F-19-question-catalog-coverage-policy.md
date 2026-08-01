# Feature RFC: F-19 Question Catalog 與 Scenario Coverage Policy

> **文件狀態**：Approved / bounded slice
> **系統成熟度 (Readiness Level)**：Partial
> **核心模組路徑**：`backend/src/services/questions/questionCatalogSelectionService.js`、`questionPoolComposerService.js`、`sessionQuestionSetService.js`、`backend/src/db/models/interviewPlanModel.js`
> **主要負責人 / 日期**：Kiwi AI Team / 2026-08-01
> **實作狀態 (Implementation Status)**：[Partial]
> **校驗測試路徑 (Verified by Tests)**：[`backend/tests/robustness/questions/questionCatalogSelectionService.test.js`](../../../backend/tests/robustness/questions/questionCatalogSelectionService.test.js)、[`backend/tests/robustness/questions/questionPoolPreparationService.test.js`](../../../backend/tests/robustness/questions/questionPoolPreparationService.test.js)、[`backend/tests/robustness/questions/questionPoolComposerService.test.js`](../../../backend/tests/robustness/questions/questionPoolComposerService.test.js)、[`backend/tests/robustness/questions/sessionQuestionSetService.test.js`](../../../backend/tests/robustness/questions/sessionQuestionSetService.test.js)

## 1. 目的與邊界

這個 slice 把 Question Catalog 和 new-project scenario 題納入同一個 deterministic candidate pool，讓 text、voice 都先用同一套 eligibility 與 coverage policy 決定「該不該問」。LLM 仍只負責把已選問題自然化為 spoken wording，不決定 coverage。

本 RFC 的第一個 follow-up slice 已加入 `SessionQuestionSet` snapshot：同一 session 的 text、voice、resume/retry 只能還原同一組題，不能因重新 prepare 而重抽題。第二個 follow-up 在 default-off 的 harness observe path 加入同一 user、同一 normalized role 的跨 session revalidation；它只改新 session 的 candidate composition，不改 scoring、舊 session、migration 或 production purge。

## 1.1 Canonical SessionQuestionSet Contract

1. `InterviewPlan.sessionQuestionSet` 是唯一 owner；以既有 `sessionId`、`userId` 的 InterviewPlan 做 conditional write。沒有 plan 時 composer 會中止，不可產生 detached pool。這不是新增 collection、migration 或額外 retention policy。
2. `definition` 在首次建立後不可覆寫，包含 private prepared item snapshots、question/target map、settings、及每一個 countable turn 的 `{ turn, phase, allowedQuestionKinds, intendedPurpose, policyReason }`。因此 phase 不只是靜態 index；它有 deterministic progression 的原因和可填入題型。
3. `runtimeState.coverageByTargetId` 的唯一狀態字典是 `unseen`、`asked_unconfirmed`、`answered_weak`、`answered_partial`、`answered_strong`、`needs_follow_up`、`blocked`。transition table 只在 `sessionQuestionSetService` 定義，後續 selector、resume、report 不可各自發明字串。
4. `runtimeState.decisionsByTurn` 依 definition 的 bounded trace contract 寫入：selected question/target、coverage before/after、top-ranked candidates 的 score/reasons，以及 bounded excluded candidates 的 reason code。寫入使用 runtime revision compare-and-set；同一 turn 已有 decision 時不重複追加。
5. `composeInterviewQuestionPool` 先讀 set。若 set 已存在，只在 pool collection 為空時以 definition 還原；已有 runtime `asked`/rank state 時直接讀回，絕不 delete/reinsert。legacy session 若只有既有 pool，維持可讀但不補建 snapshot，避免為舊資料擴大 scope。

## 1.2 Runtime Selection and Accepted-answer Coverage

1. 每次 deterministic turn planning 都讀 session-owned set 的 current runtime state。`warm_up` 只允許 opening/self-introduction root，core phase 排除 opening/closing，`closing` 只允許 wrap-up root；slot 不允許 follow-up 時，controller 不能以 probe action 覆寫已選 root。
2. selector 以 `questionMap.targetId` 套用 centralized coverage state。`asked_unconfirmed`、weak/partial、`needs_follow_up`、`answered_strong`、`blocked` target 都不會再提供另一條 root；前幾者保留給現有 follow-up controller，不把弱答案當作完成。
3. accepted answer 的 primary target 由最後一條 prepared root transcript metadata 對應。只有 evaluator 為 `EXACT_MATCH`、`evidenceGainScore >= 0.70`、`successStatus: usable`、且沒有 misunderstanding 時，才標記 `answered_strong` 並 hard-exclude。`PARTIAL_TRANSFER` 和弱答案分別標為 `answered_partial`／`answered_weak`；misunderstanding 不改 coverage。
4. 一個 strong answer 可以覆蓋未問 target，但必須在該 target 的 topic/competency/signal terms 有至少兩個明確命中；它使用合法的 `unseen -> answered_strong` transition。這是保守 deterministic semantic proxy，不加第二次 LLM call，也不聲稱能理解所有同義表達。
5. actual prepared root 的 asked-state update 成功後才寫 decision 與 `asked_unconfirmed`；update 回傳 null 或拋錯時只記 warning，絕不寫 selection trace。trace 不保存 raw answer；只保留 fixed reason codes、score components、target IDs 和 coverage transition，供 resume/debug 重建當時為何選它而不是其他候選。

## 1.3 Same-user Same-role Question Refresh

1. `prepareInterviewQuestionPool` 只在 `ENABLE_USER_INTERVIEW_MEMORY_PLANNING=true`、harness shadow 已開且 execution mode 是 `observe` 時才讀取 projection；預設完全不讀取、也不改 pool。projection refresh 失敗會 warning 並照常組一般 pool。
2. 評估結果必須綁到本 turn 最後一條 countable AI question 的 refs（`questionId`、`preparedQuestionId`、topic、family），而不是下一條 action 的 target。這避免答完 API design 後，下一個 observability 題把 answer quality 歸錯 target。
3. 只在同一 normalized role、90 天內、兩個獨立 session 都為 strong，且沒有 weak 或 partial conflict 時，才從新 session 的 composed root candidates 移除相同 topic + family 的 routine root。opening、closing 和 fallback root 永不被這條 policy 移除。
4. weak、partial 或 conflict 不會換題；同 target 的 routine root 保留並加 `0.18` priority 作 revalidation。這個 policy metadata 只記 version/reason/action，並固定 `canAffectScoring: false`，不保存 raw answer 或 candidate-facing trace。
5. 調整發生在首次 `SessionQuestionSet` snapshot 前；snapshot 一旦存在，text、voice、resume/retry 都只還原原集合，不重新套用跨 session history。

## 1.4 Canonical JD Requirement Priority

1. JD requirement candidate 的 canonical status 只讀 Match pipeline 的 `status` enum：`not_met`、`inferred`、`partial`、`met`。舊 boolean `met` 不是 selection input；缺漏或未知 status 保守視為 `not_met`，不可把 gap 隱藏成已滿足。
2. composer 必須先對所有 interviewable requirements 排序，再交由 session-level selection 套用使用者設定的 `questionLimit`。不可在 source layer 固定截取前六項。
3. 排序順序固定為 canonical status 風險（`not_met → inferred → partial → met`）、must-have/hard requirement、importance、再以原始 JD 順序穩定 tie-break。candidate metadata 保存採用的 canonical status，供 deterministic trace/debug 使用。
4. 這條 policy 不改 mode/category mapping 或 follow-up contract；非技術 requirement 的分類與 mode eligibility 仍是獨立後續 slice，不能藉本排序規則宣稱已修復。

## 2. Candidate 與 Selection Contract

1. `prepareInterviewQuestionPool` 對 text 與 voice 都載入 approved catalog；loader 固定依 repository 的 `2026.2 -> 2026.1` preference，request settings 不可指定版本。
2. `buildInterviewQuestionPoolItems` 把 approved catalog snapshot 和其他 deterministic sources 放進同一 pool，不再以 delivery mode 排除 catalog。
3. 在符合 scenario gate 時，composer 額外產生一題 deterministic `scenario_policy` candidate：`new_project_delivery`。它含固定的 problem framing、constraints、approach、risk 與 validation signals；catalog 暫不可用時仍能保有 scenario coverage 的候選題。
4. `resolveCatalogReservationPlan` 把它映射成 `scenario_problem_solving`，要求 `minAsked: 1`、`maxAsked: 1`。ranker 在剩餘題數不足以再延後時，將候選集限制在未完成的 reservation；若 session 提早結束，coverage outcome 必須顯示 degraded，不可聲稱已問。
5. CP2 policy review snapshot 使用相同的 generic scenario candidate，並以 `2026.2` policy version、digest 與 checked-in review artifact 記錄此次 Product Owner 決定；它不代表 Mongo catalog 已啟用。

## 3. Scenario Gate

| Focus | 會建立並保留一題 scenario slot | 不會建立 |
| --- | --- | --- |
| Technical | `questionLimit >= 12`，或 `timeLimitMinutes >= 30` | 8 題／15 分鐘等較短設定 |
| Combined | `questionLimit >= 15`，或 `timeLimitMinutes >= 30` | 12 題／15 分鐘等較短設定 |
| Behavioural | 無 | 所有設定 |

時間由 `timeLimitMinutes` 讀取；只有秒數時由 `timeLimitSeconds / 60` 推導。設定中的題數仍是控制 session 總題數的 authority；scenario policy 不會把 session 題數改成固定值。

## 4. 失敗與降級

| 情況 | 行為 |
| --- | --- |
| approved catalog 無法載入 | 保留一般 deterministic pool；符合 gate 時仍加入 `scenario_policy` candidate；catalog status 會保留 unavailable 訊號。 |
| catalog 中的 bounded technical scenario 不符合 gate | 在 snapshot eligibility 階段拒絕，不進 candidate pool。 |
| 正常 session 結束前未能完成 required slot | coverage outcome 為 `degraded`；不可在 trace 或 report 中說題目已被問。 |
| canonical `InterviewPlan` 不存在或 persistence 沒有 winner | composer fail-closed，不建立 detached question pool；session lifecycle 必須先完成 InterviewPlan persistence。 |
| canonical set 的 root-only slot 沒有 eligible prepared root | agent fail-closed 完成本場，不可回退 legacy pool、probe 或 generated follow-up 而違反該 slot。此情況需診斷 canonical set / coverage state。 |
| runtime revision compare-and-set 兩次都失敗 | session 不中斷；runtime writer 回傳 null，且該 turn 不可被宣稱有 durable coverage/decision trace。 |
| user interview memory projection 讀取失敗 | 記 warning 後照常建立一般 pool；不可使用殘缺 history 來 suppress 或 boost candidate，也不影響 scoring。 |

## 5. Local Verification

- 2026-08-01：catalog selection、preparation、composer 與 CP2 policy-review 五個 focused Vitest files 共 64 tests passed；backend ESLint passed。
- 已覆蓋：Technical / Combined 的 8、12、15 題與 30 分鐘邊界、Behavioural exclusion、text/voice catalog parity、scenario candidate 的 single-slot metadata、最後題槽 reservation。
- 2026-08-01：`sessionQuestionSetService` 與 composer focused tests 共 36 tests passed；backend ESLint passed。已覆蓋 immutable turn/target/coverage/decision contracts、conditional snapshot persistence、text/voice retry reuse、user-scoped restore、partial/duplicate-write recovery，以及既有 asked state 不被 reset。
- 2026-08-01：question-set、turn orchestrator、composer、metadata persistence、root-only agent 五個 focused test files 共 70 tests passed；backend ESLint passed。已覆蓋 technical/behavioural warm-up 與 closing root-only enforcement、no-candidate fail-closed、phase exclusions、strong direct/sibling coverage、weak/partial non-completion、asked-state failure 不寫 trace、bounded decision write 與 runtime revision query。
- 2026-08-02：user memory、preparation、composer、question-set、turn orchestrator、metadata persistence、root-only agent 七個 focused Vitest files 共 89 tests passed，backend ESLint passed。已覆蓋 answered-question attribution、legacy trajectory 不可 promotion、partial/strong conflict、promotion suppression、weak/partial revalidation boost，以及 planning default-off 不讀 history；未把 local result 等同 browser/live proof。
- 2026-08-02：同一組七個 focused Vitest files 共 89 tests passed。已覆蓋第七項 must-have `not_met` requirement 不會因 source cap 消失、canonical `status: met` 會覆蓋舊 `met: false`、以及完整 requirement candidate set 先排序後才交 session capacity 使用。
- 未驗證：Mongo 中實際 approved `2026.2` catalog 的 lifecycle、browser text flow、live voice provider、production deployment。

## 6. 後續獨立 Slice

1. 以 browser／live voice 驗證 transcript confirmation、cross-session replacement、CAS warning、selection trace 與 coverage transition；此 RFC 不把未做的人測試當作已驗證。
