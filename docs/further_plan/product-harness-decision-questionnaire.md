# Product Harness 決策問題清單

- 狀態：Product Owner 已部分回答；只以 `[x]` / `[~]` 與 decision log 為準
- 盤點日期：2026-07-15
- Source baseline：`497c21a` 加上當前 worktree
- 工作邊界：docs-only；本文件不代表 runtime 已修改
- 主要依據：[Harness Goal](../harness/goal.md)、[M1 Proposed Spec](../harness/spec.md)、[Harness Engineering 參考整理](../references/harness-engineering-reference.md)、[Agent 現況盤點](../references/agent-current-state-inventory.md)、[Product Harness Contract Spine](product-harness-contract-spine.md)

## 1. 怎麼使用這份清單

問題按依賴順序排列。建議先回答 P0，再回答 P1；P2 可以保留到第一個 shadow slice 有結果後再處理。

每次只回答一題即可。若暫時沒有偏好，可在「決定」填入「採建議預設」，並在「重看條件」寫清楚何時重新討論。不要為了填完而假裝已決定。

狀態標記：

- `[ ]` 尚未回答
- `[~]` 暫定，需要驗證
- `[x]` 已決定
- `[-]` 明確延後

未勾選問題內即使已有「建議預設」或草擬答案，也不代表 Product Owner 已核准。

### 1.1 Product Owner decision log（2026-07-15）

| Topic | 狀態 | 已核准內容 | 仍待決定 / 驗證 |
| --- | --- | --- | --- |
| Agent/workflow classification | `[x]` | CV-JD match、question preparation 是 guarded workflow/context producer；不是因使用 LLM 就成為 product agent。 | Runtime `TaskContract` rollout scope 仍待 Q03。 |
| User-level memory target | `[x]` | Memory 到 user scope、跨 session；可避免同深度例行重問、轉向其他 gap 或提高問題深度；V0 `canAffectScoring=false`。 | Promotion 次數、freshness、revalidation、使用者開關。 |
| Report QA publication | `[~]` | QA-only 不 silent rewrite；blocking result 進 `needs_review`；repair 是 explicit action/child run。 | Candidate 是否可看/下載、severity 分級、reviewer SLA。 |
| Privacy/replay/deletion | `[~]` | Refs/hash/version-first；必要時才存 redacted snapshot；source delete 後 delete/recompute/redact derived content，只留無內容 tombstone。 | Snapshot allowlist、retention window、aggregate recompute 細節。 |
| Voice confirmation resume | `[x]` | Immediate transcript confirmation 採 same-run `waiting -> running`；失效或不可安全恢復才用 child run。 | Duplicate/reconnect/timeout replay 必須通過；hot-path verification scope 仍待 Q12。 |
| Observability audiences | `[~]` | Full run/span/gate/failure/memory detail 給 developer；一般使用者只看重要、非技術性的 progress/evidence/next-step summary。 | Support/raw access、retention、user summary UI placement。 |
| Authority order | `[x]` | `policy/safety > controller > contract/gate > deterministic rule > model > wording`。 | Human override scope 仍待 Q05。 |
| Rollout order | `[x]` | 全產品 shared target；`interview_next_turn` shadow/observe first，report QA candidate-enforce second。 | Enforce threshold 仍待 Q18。 |
| Enforce threshold | `[ ]` | 尚未核准。 | Q18。 |

## 2. 對照結論

Kiwi 已經有局部 harness，不是 prompt-only 系統。現有程式碼有固定 task routing、固定 agent registry、rule-first action planner、action allowlist、model fallback、auth/ownership、voice state control、report QA、memory、trace、usage/cost tracking 與多組 eval。

目前仍缺共用且可 enforce 的 `WorkflowRun`、`TaskContract`、`ContextPacket`、`ActionContract`、`GateResult`、`MemoryWrite`、`FailureClassification`。這些不是單純補 schema；它們會把產品政策變成 runtime authority，因此以下問題必須先由你決定。

- Harness readiness：**Yellow**。局部 workflow 已接近 H1/H2，但 shared harness 尚不適合直接全面 enforce。
- 最高風險：failed report publication、cross-session memory authority、source deletion semantics、background event correlation、voice hot-path gate，以及缺少完整 recorded-session replay。
- 可以開始的範圍：討論與實作 low-risk shadow mapper；在 P0 決策未關閉前，不做全域 persistence rewrite、memory scoring 或 voice heavy enforcement。

| Reference concern | Current code | 狀態 | 需要你的決定 |
| --- | --- | --- | --- |
| Task contract | `runTask` 固定支援三種 task，但沒有正式 success/stop/forbidden contract。 | 部分存在 | 哪些 workflow 正式納入 shared harness。 |
| Action/tool contract | planner 有固定 action、candidate、risk、fallback；model 只能選候選 action。 | 部分存在 | model/human 可以改到哪一層，哪些 action 永不開放。 |
| Context/evidence | 會建 decision context、evidence bundle 與 snapshot。 | 部分存在 | 保存 refs/hash 還是 redacted snapshot，以及 replay/privacy 取捨。 |
| State/session/artifact | session、report、question pool、analysis 都有 persistence。 | 已存在但分散 | 是否需要正式 run/span，以及 run 保存多久。 |
| Memory policy | session memory、reflection、user coaching memory 都存在。 | 部分存在 | memory 能否影響下一題、報告、分數，以及刪除規則。 |
| Orchestration | `masterAiService` 控制 interview/report/QA，background queue 處理非關鍵寫入。 | 部分存在 | 第一個 migration slice、background 完整性與恢復要求。 |
| Guardrail/human review | JD/match review、question/time limits、voice confirmation、report QA 都有局部 gate。 | 部分存在 | gate status、override authority、failed report 是否可見。 |
| Security/privacy | API/voice socket 有 auth 與 session ownership；部分獨立 runtime collection 有 7 天 TTL，其他資料由 retention audit/cleanup 管理。 | 已存在但政策未統一 | trace/context/memory 的可見性、刪除、redaction 與例外。 |
| Observability | decision、trajectory、agent event、latency、cost 與 ops-lite summary 都存在。 | 部分存在 | 誰能看、保存多久、什麼是 release evidence。 |
| Evaluation/replay | 有 mock、real-provider、trajectory、human calibration、release gate。 | 部分存在 | 真正 replay contract、release threshold 與 production evidence 門檻。 |
| Failure/recovery | 各 domain 有 fallback、timeout、repair、needs-review。 | 分散存在 | 共用 failure class 與 candidate-facing degrade 行為。 |
| Cost/latency | token/cost 有記錄；voice 有 3 秒目標；局部服務有 timeout。 | 部分存在 | hard budget、超額處理與 provider fallback。 |
| Human collaboration | CV/JD review 與部分人工校準存在。 | 部分存在 | reviewer 角色、override 記錄、修正是否進 memory/eval。 |
| Maintainability | 有大量 focused tests 與 docs，但 shared policy 尚未 runtime 化。 | 部分存在 | contract ownership、versioning 與 rollout governance。 |

## 3. 程式碼已經確定，不需要你重新設計的事

以下是 current-state 事實。除非你要改產品方向，工程實作應保留它們：

1. `runTask` 目前只接受 `interview_next_turn`、`generate_report`、`qa_report`。
2. `agentRegistry` 目前只登記 `retrieval`、`interviewer`、`reportGenerator`、`reportQa`、`interviewEvaluator`。
3. interview action 先由 deterministic planner 建候選集合；model 選到集合外 action 時會回到 rule fallback。
4. time limit、question limit、mode boundary、low-confidence transcript repair 與 report QA 不能由 model prompt 覆蓋。
5. HTTP controller 與 voice socket 會做 authentication 與 session ownership 檢查。
6. report QA 最多自動 repair 兩次；失敗後目前仍會保存並回傳 report，狀態為 `needs_review` 或 `repair_failed`。
7. session trace/memory 主要存於 `SessionAnalysis`；user-level coaching memory 另存於 `UserCoachingMemory`。
8. 部分獨立 runtime collection（包含 `UserCoachingMemory`）目前採 7 天 `updatedAt` TTL；較廣的 runtime artifact 由 7 天 cutoff 的 retention audit/cleanup 管理。session soft delete 與實體 cleanup 是兩個不同階段。
9. 現有 trajectory eval 會執行 production planner 和 trajectory builder，但不是把完整 production session 在新 harness 下重跑。
10. voice `speech end -> first audio <= 3 seconds` 是既有產品 contract，不應在 harness 討論中被悄悄放寬。

## 4. P0：進入 shared harness runtime 前必須回答

### Q01. 第一版 harness 的產品範圍與 rollout 順序是什麼？ `[x]`

為什麼要你決定：目標可以覆蓋全產品，但實作若同時改 CV/JD、question、interview、voice、report、memory，風險太大。這是產品風險排序，不只是技術拆分。

現況：現有草案建議 shared target 覆蓋全產品，第一個 observe slice 用 `interview_next_turn`，第一個 enforce slice 用 report QA。

選項：

- A. 全產品共用目標；先 interview shadow，再 report QA enforce。
- B. 先只做 Role-Fit / report，interview 與 voice 延後。
- C. 先只做 interview control，report 維持現況。

建議預設：A。它能先驗證最完整的 run/context/action/memory mapping，再在非 voice hot path 的 report QA 啟用 blocking。

你的答案：

- 決定：A
- 理由：先用最完整的 interview run/context/action/memory mapping 驗證 shared spine，再在非 voice hot path 的 report QA 驗證 blocking。
- 第一個 observe slice：`interview_next_turn`。
- 第一個 enforce slice：report QA；實際 enforce 仍受 Q18 threshold 約束。
- 重看條件：shadow parity/replay 失敗、voice latency regression、report QA false-block 不可接受。

### Q02. 最終 authority order 是否正式採用「policy > controller > contract/gate > rule > model > wording」？ `[x]`

為什麼要你決定：這會決定 model、human reviewer 與 admin 各自能否覆蓋上一層結果。

現況：程式碼大致採這個順序，但尚未成為共用 contract。model 可選候選 action，也可合併 `selectedActionInput`；domain service 仍負責最後 guard。

選項：

- A. 採用上述順序，任何 override 都只能往下影響，不能反向覆蓋 safety/policy。
- B. 允許指定 admin/human reviewer 覆蓋部分 gate。
- C. 允許 model 在高 confidence 時跳過部分 rule。

建議預設：A；若選 B，必須逐 gate 列 override scope、reviewer role、reason 與 audit record。不要選 C。

你的答案：

- 決定：A
- 允許人工覆蓋的 gate：
- 永不可覆蓋的 policy：
- 例外：

### Q03. 哪些 product workflow 要成為正式 `TaskContract`？ `[x]`

為什麼要你決定：納入 shared harness 代表它要有 objective、success、stop、forbidden behavior、budget、trace 與 release evidence。

現況：runtime task runner 只有三個 task；CV/JD parse、match、question preparation 走其他 service/controller，但同樣會影響後續 agent context。

選項：

- A. V0 只納入 `interview_next_turn`、`generate_report`、`qa_report`。
- B. V0 再加入 `cv_jd_match`、`prepare_question_pool`。
- C. 所有 AI-assisted service 都立即建立 task contract。

建議預設：A 做 runtime slice；B 的兩個 workflow 同時建立 docs/shadow view，等 mapping 穩定後再 enforce。不要選 C。

你的答案：

- 決策原則：所有 AI-assisted 行為最終都必須可審計，但不代表每個 AI-assisted service 都要成為獨立 `TaskContract`。
- V0 正式 task：`interview_next_turn`、`generate_report`、`qa_report`。
- 只做 shadow 的 task：`cv_jd_match`、`prepare_question_pool`。
- 暫不建立獨立 `TaskContract` 的行為：其餘 AI-assisted service 仍必須出現在所屬 workflow trace 中，依責任記為 `ExecutionSpan`、`ActionContract`、`GateResult`、context event 或 memory event。
- 審計要求：每個 AI-assisted 行為都必須能追溯所屬 run、輸入與輸出摘要、model/tool、版本、耗時、token/cost、結果或 failure，以及適用的 gate/override；敏感內容依 privacy policy 遮罩或只保存 reference。
- 重看條件：V0 workflow 的 shadow parity、failure mapping、replay 與 rollback evidence 通過後，只把具備獨立 objective、success/stop condition，且需要獨立重試、取消或 publication policy 的 subworkflow 升格為正式 `TaskContract`。

### Q04. Report QA 失敗時，候選人可以看到、下載或使用 report 嗎？ `[~]`

為什麼要你決定：這是最直接的 publication policy。現在 `needs_review` 只是狀態，不是完整的發佈阻擋。

現況：QA 失敗後 report 仍會被保存並回傳；前端可以載入 status。程式碼沒有統一禁止 view/export。

選項：

- A. QA fail 時完全不顯示 report，只顯示正在審查/重新產生。
- B. 顯示但清楚標示未驗證，禁止下載/export。
- C. 顯示並允許下載，只顯示 warning。
- D. 依 failure severity 分級：critical block、major review、minor warning。

建議預設：D。unsupported evidence、score mismatch、ownership/privacy 問題應 block；文字品質問題可 `ready_with_warning`。

你的答案：

- 決定：QA-only 不 silent rewrite；blocking result 進 `needs_review`；repair 必須是 explicit action/child run。Candidate visibility/export 尚未決定。
- 必須 block 的 failure：
- 可 warning 的 failure：
- 可否下載/export：
- reviewer SLA 或 fallback：

### Q05. 誰是 human reviewer，能批准什麼？ `[ ]`

為什麼要你決定：目前「human reviewed」同時可能指候選人確認自己的 CV/JD、內部品質 reviewer、未來 admin。三者權限不能混在一起。

現況：CV/JD review 可解除部分 match block；human calibration 要求 reviewer ID；report `needs_review` 尚沒有正式 reviewer workflow。

選項：

- A. 候選人只能確認自己的資料；不能批准品質或安全 gate。
- B. 內部 reviewer 可批准 report/match 例外，但必須留下 scope 與理由。
- C. 系統沒有內部人工流程，所有 critical fail 都重新產生或停止。

建議預設：A + B。候選人提供 source correction，內部 reviewer 承擔 publication override；兩者都寫入 trace，但權限不同。

你的答案：

- 候選人可確認/覆蓋：C
- 內部 reviewer 可確認/覆蓋：
- Admin 可確認/覆蓋：
- 每次 override 必填欄位：

### Q06. Cross-session coaching memory 可以影響哪些結果？ `[x]`

為什麼要你決定：memory 一旦影響分數或風險結論，就可能把舊 session 的錯誤帶入新 session，且使用者不容易知道。

現況：`UserCoachingMemory` 會被載入 decision context，也會進 report 的 internal coaching summary；planner 目前明確使用的是 session `agentMemory.projectUsage`，沒有正式 `canAffectScoring` 欄位。

選項：

- A. 只能影響 coaching wording，不影響題目、matching、scoring。
- B. 可影響下一題與練習重點，但不能影響 matching/report score。
- C. 可影響 scoring，但要有 confidence/provenance/使用者確認。

建議預設：B；`canAffectScoring=false` 應是 hard policy。題目影響也要在 user-safe explanation 中說明是「練習偏好」，不能當本次能力證據。

你的答案：

- 可影響 question selection：可以；跨 session 避免同深度例行重問、轉向其他 gap 或提高問題深度。
- 可影響 report coaching：可以產生重要、非技術性的 progress / next-practice summary；詳細 memory trace 不給一般使用者。
- 可影響 matching/scoring：V0 不可；`canAffectScoring=false`。
- 使用者是否可關閉：
- 例外：

### Q07. Memory 的更正、刪除與 source deletion 語義是什麼？ `[~]`

為什麼要你決定：這牽涉使用者控制、隱私、可回放性與 audit。工程不能自行決定「刪除」到底是 cascade、redact 還是 tombstone。

現況：`UserCoachingMemory` 受 7 天 TTL；session-local memory 位於 `SessionAnalysis`，由較廣的 retention audit/cleanup 管理。session delete 先 soft delete PostgreSQL row，Mongo derived artifacts 由後續 retention 流程清理。User coaching memory 是 user-level aggregate，不只屬於單一 session。

選項：

- A. source session 刪除時，衍生 memory 全部 cascade delete。
- B. 刪除內容，保留不含個資的 tombstone/audit reason。
- C. aggregate memory 保留，但移除該 source 的 contribution 後重算。

建議預設：session-local 用 A；user-level aggregate 用 C；必要 audit 只保留 B 的最小 tombstone。使用者應能查看、刪除或關閉跨 session memory。

你的答案：

- Session-local memory：source/session delete 時 cascade delete。
- User-level memory：移除 source contribution 後 recompute；沒有其他有效 evidence 時 delete/redact。
- Trace/audit：只保留不含 candidate content 的最小 tombstone。
- 使用者控制：
- 保留天數與例外：

### Q08. `WorkflowRun` V0 要如何保存？ `[x]`

為什麼要你決定：是否持久化會影響 debug、replay、privacy、storage、late background events 與 migration 成本。

現況：`SessionAnalysis` 已有 decision、trajectory、trace、controller snapshot，但沒有共用 run ID 或分離 lifecycle/quality/publication status。

選項：

- A. 只做 derived read model，從現有資料即時計算。
- B. 每次 run 寫 append-only shadow artifact，但不作產品 source of truth。
- C. 新增正式 collection，所有 workflow 直接寫入。

建議預設：B。A 無法穩定關聯 late events；C 在 contract 未驗證前 migration 風險太高。

你的答案：

- 決定：B
- 必須支援的查詢/replay：authenticated owner scope 下按 `workflowRunId`、`sessionId`、owner/time 查詢；deterministic replay 可比較 flag OFF/ON、fallback、duplicate、voice waiting/resume、memory correlation 和 persistence failure。
- 保存期限：V0 使用 7 天 retention，不能長於目前 runtime artifact policy；source deletion 依 session retention/cleanup policy 處理，不另行承諾即時 cascade。
- 何時升級成正式 source of truth：M1 不升級。至少要完成 H1、production shadow、retention/privacy review、late-event/orphan evidence 和 rollback review，並由 Product Owner 另行核准；目前 product controller/domain records 仍是 authority。

### Q09. `ContextPacket` 保存多少內容？ `[x]`

為什麼要你決定：完整 snapshot 最容易 replay，也最容易重複保存 CV、JD、transcript 與敏感推論。

現況：`evidenceBundleSnapshot` 與 `controllerState` 會保存 mixed payload；沒有統一 context ID、hash、version、trust level 或 redaction policy。

選項：

- A. 只存 source refs、hash、version、selection reason。
- B. A 加必要的 redacted snapshot。
- C. 保存完整 input/output snapshot。

建議預設：B。一般情況存 refs/hash；只有 source 會變動且 replay 必需的最小欄位才存 redacted snapshot。不要選 C 作預設。

你的答案：

- 決定：B
- 必須 snapshot 的資料：只限 replay 必要且已進 allowlist 的最小 redacted fields；具體 allowlist 待定。
- 永不 snapshot 的資料：raw chain-of-thought；非必要的完整 CV/JD/transcript/candidate-sensitive payload。
- source 刪除後的處理：delete/recompute/redact derived content，只保留無內容 audit tombstone。

### Q10. Shared gate 的 status 與 owner 怎麼定義？ `[ ]`

為什麼要你決定：如果 central harness 可以隨意 block domain workflow，會取代現有 product controller；如果只有 domain 自己判斷，又無法形成一致治理。

現況：report QA、JD/match review、retrieval quality、question novelty/counting、voice transcript confidence 都有不同 output shape。

選項：

- A. 共用 `pass | warn | block | review | unavailable`；domain owner 定 threshold，controller 執行 next step。
- B. central harness 統一決定所有 threshold 與 block。
- C. 只統一 log，不統一 status。

建議預設：A。shared layer 管 schema、severity、audit；domain owner 管 reason code、threshold、fallback。

你的答案：

- 共用 status：A
- Threshold owner：
- Block execution owner：
- 哪些 gate 必須 fail-closed：
- 哪些 gate 可以 unavailable/degrade：

### Q11. 各類 failure 對使用者的 degrade 行為是什麼？ `[ ]`

為什麼要你決定：同樣是 timeout，JD parse、下一題、voice STT、report QA 對使用者的安全行為不同。

現況：程式碼已有多個局部 fallback，但沒有共用 `FailureClassification` 或 user-impact policy。

請至少決定：

| Failure class | 可否重試 | 可否 fallback | 使用者看到什麼 | 是否 block |
| --- | --- | --- | --- | --- |
| Context/evidence 不足 |  |  |  |  |
| Model invalid/timeout |  |  |  |  |
| Provider/tool unavailable |  |  |  |  |
| Verification/QA fail |  |  |  |  |
| Permission/ownership fail |  |  |  |  |
| Human input/STT 不確定 |  |  |  |  |
| Environment/config fail |  |  |  |  |

建議預設：permission fail 與 unsupported evidence fail-closed；voice STT 不確定要 clarification；model action failure用 rule fallback；report verification failure依 Q04 分級。

你的答案：按預設建議

- 決定原則：
- 一定 fail-closed：
- 可 silent fallback：
- 必須明示使用者：

### Q12. Voice 3 秒 hot path 內必須做哪些 verification？ `[ ]`

為什麼要你決定：把全部 H3 checks 放進 hot path 會破壞 latency；全部 async 又可能先播出錯誤問題。

現況：voice 已把部分 context/memory/quality工作移到 fast path 或 background；single-blocking-LLM lane 有明確 budget。現有 release report仍把超過 3 秒列為 known issue，而不是所有 release 的 blocker。

選項：

- Hot path 必須同步：transcript eligibility、turn classification、action allowlist、question counting、mode/time limit、basic novelty、spoken grounding。
- 可 async：完整 semantic review、重 retrieval、memory write、完整 trajectory、non-blocking eval。
- 需再決定：async 發現問題後，是只記錄、修正下一輪，還是中止/撤回當前輸出。

建議預設：採以上切分；async 結果不得回寫已播出的 turn state，只能產生 correction event 或影響下一輪。

你的答案：按照預設建議

- Hot path 必須同步：
- 允許 async：
- Async late failure 行為：
- 3 秒超標是否 block voice release：

## 5. P1：第一個 shadow slice 後、enforce 前回答

### Q13. Candidate-facing explanation 要出現在哪裡、顯示多少？ `[~]`

現況：transcript metadata 已可帶 `whyThisQuestion`、evidence、alternatives；一般 session view 只暴露 sanitised metadata，完整 diagnostics 在 production 被關閉。report 有 evidence/status 顯示，但沒有共用 explanation policy。

選項：

- A. 只在 post-session report 顯示。
- B. Match review + report 顯示；interview 當下不顯示。
- C. interview 當下也提供簡短「為什麼問這題」。

建議預設：B；等內容品質與 UX 驗證後再試 C。只顯示 evidence-safe summary，不顯示 raw reasoning、完整候選 action 或內部 memory。

你的答案：內容分級已決定；UI placement 尚未決定。

- 顯示位置：待決定；live interview 預設不顯示 internal reason。
- 顯示欄位：重要、非技術性的 progress、已證明能力、evidence summary、下一步練習重點。
- 禁止顯示：raw reasoning、完整 candidate action、internal ranking、full memory/run/gate/failure trace。
- 使用者可否要求更多解釋：

### Q14. Internal trace 誰可以看，保存多久？ `[~]`

現況：session owner 可取得部分 sanitized metadata；非 production diagnostics 與 user-scoped ops-lite 可看更多 aggregate；mixed trace payload 仍可能含 sensitive evidence。

建議預設：candidate 只看 user-safe explanation；support/engineer 看 redacted trace；raw payload 只限 break-glass 權限並有 access log。trace retention 不應因 debug 方便自動長於 source data。

你的答案：Audience boundary 已決定；access/retention 細節待定。

- Candidate：只看重要、非技術性的 user-safe summary。
- Support/reviewer：
- Engineer/admin：可看完整但經 redaction 的 WorkflowRun/span/gate/failure/memory detail。
- Raw payload access：
- Retention：

### Q15. Run-level cost、token、tool call 與 wall-clock budget 是多少？ `[ ]`

現況：usage/cost 已記錄，DeepSeek 預設 timeout 30 秒，JD safeguard 有更短 timeout/no retry，report repair 最多兩次，voice 有局部 LLM budget；沒有全產品 hard budget。

需要你決定的不是每個數字，而是產品 policy：

- 超額時要 block、degrade、詢問使用者，還是繼續並記帳？
- 哪些 workflow 可以為品質多花成本？
- free/paid tier 是否有不同 budget？

建議預設：voice 以 latency hard budget；report 以 call/repair hard budget；matching 以安全 gate優先；成本先 warn + metric，確認 baseline 後才 enforce。

你的答案：按照預設建議

- Voice：
- Interview text：
- Match/question prep：
- Report/QA：
- 超額行為：

### Q16. Provider 失敗時允許怎樣的 fallback？ `[ ]`

現況：LLM 主要固定 DeepSeek；speech 有 provider router；部分外部服務有 timeout/fallback。並非每個 workflow 都能在 provider fail 時安全退回 mock/local output。

選項：

- A. 同 provider retry/fallback model。
- B. 跨 provider fallback。
- C. deterministic local degrade。
- D. 停止並請使用者稍後再試。

建議預設：interview action 可 C；voice speech 可受控 B；report generation 不可使用 mock 充當真結果，應 A/B 或 D；任何 provider switch 都要在 trace 標明。

你的答案：按照預設建議

- 各 workflow 的 fallback：
- 是否允許跨 provider：
- 是否允許 partial result：
- 必須明示的 provider change：

### Q17. 題目與 action selection 需要多大程度的可重現性？ `[ ]`

現況：大部分 planner 是 deterministic，但 smooth answer 的 stress/friction 分支使用 `Math.random()`；model selection 也會帶來差異。這會影響 replay 與 A/B 評估。

選項：

- A. Production 可有多樣性，replay/eval 固定 seed/config。
- B. 相同 state 必須永遠得到相同 action，只有 wording 可變。
- C. action 也可由 model 多樣化，只要通過 gate。

建議預設：A，且 action-level randomness 必須有 recorded seed/decision signal；高風險 action 與 terminal state採 B。

你的答案：C

- Action reproducibility：
- Wording diversity：
- 高風險流程：
- Replay 要記錄的 config：

### Q18. 什麼證據足以讓 harness 從 shadow 進 warn/enforce？ `[ ]`

現況：已有 production planner trajectory cases、synthetic E2E、real-provider eval、human calibration 與 release reports；但不是完整 recorded-session replay。部分 latest report明確標示 production/live boundary。

建議至少要求：

1. Shadow output 與 legacy output parity。
2. Versioned replay dataset，含正常、fallback、permission、low-confidence、late background event。
3. Critical gate false-negative 為 0，或明確人工審核。
4. Human calibration 的 reviewer、日期、理由完整。
5. Real provider/live voice/production telemetry 的未驗證邊界清楚。
6. 可 rollback 到 legacy path。

你的答案：按照建議

- Shadow -> warn gate：
- Warn -> enforce gate：
- 必須使用真實 provider 的項目：
- 必須人工 review 的項目：
- Rollback trigger：

### Q19. 人工修正要不要寫回 memory、eval dataset 或產品資料？ `[ ]`

為什麼要你決定：把人工修正直接寫回可以快速改善體驗，也可能造成 hidden human correction、資料污染與錯誤歸因。

選項：

- A. 只修正當前 artifact，不進 memory/eval。
- B. 經使用者確認後進 memory；經 reviewer 標註後進 eval candidate queue。
- C. 自動寫回所有層。

建議預設：B。memory write 與 eval inclusion 必須是兩個不同事件；加入正式 eval dataset 前要去識別、版本化與 reviewer approval。

你的答案：B

- 當前 artifact：
- User memory：
- Eval candidate queue：
- 正式 eval dataset：
- 去識別與同意要求：

### Q20. Contract、gate policy 與 version 的 owner 在哪裡？ `[ ]`

現況：action enum、task routing、threshold、prompt、schema、eval config 分散在 code/config/docs；純 docs 無法 enforce，全部放 DB 又會增加 migration 與治理風險。

選項：

- A. Code-owned versioned constants + docs mirror。
- B. DB/admin-configured policy。
- C. 混合：schema/forbidden behavior在 code，低風險 threshold 可配置。

建議預設：C。V0 先以 A 實作；只有具備 validation、audit、rollback 後，才把低風險 threshold 移到 config/admin。

你的答案：C

- Schema owner：
- Domain threshold owner：
- 可 runtime config 的欄位：
- 每次變更的 approval：
- Version/rollback 規則：

### Q21. Agent 未來是否允許執行產品外部的 side-effect action？ `[ ]`

現況：Kiwi 的 agent action 目前主要是 retrieval、question、evaluation、report、speech；沒有代替使用者寄信、投履歷、排日程或修改外部帳號的通用工具權限。

選項：

- A. 保持 coaching/analysis 產品，不增加外部 side effect。
- B. 未來可加入，但每類 action 都要 explicit opt-in、preview、approval、idempotency 與 audit。
- C. 允許 agent 自主操作已連接的外部工具。

建議預設：A；若產品方向選 B，必須另做 zero-trust action gate。不要直接選 C。

你的答案：A

- 產品方向：
- 可能加入的外部 action：
- 一定需要 approval：
- 永不允許：

## 6. P2：可以延後的策略問題

### Q22. 現在是否要做跨 model/provider abstraction？ `[ ]`

建議預設：延後。先把 task/context/action/gate contract 穩定，再讓 provider adapter 實作同一 contract；否則會先抽象供應商差異，卻沒有穩定產品語義。

你的答案：

- 決定：
- 何時重看：
- 必須支援的 provider：

### Q23. 是否把 H2/H3 當正式 release 名稱？ `[ ]`

選項：可只作內部 maturity label，或成為 release gate，例如「report publication 必須達 H3」。

建議預設：先作內部 label，不直接對外宣稱。每個 workflow分別標成熟度，不給整個產品一個過度概括的分數。

你的答案：

- 決定：
- 適用 workflow：
- 是否對外顯示：

### Q24. 是否需要 admin UI 動態修改 harness policy？ `[ ]`

建議預設：V0 不做。先以 versioned code/config + audit report 運作；只有 threshold 頻繁調整、角色權限明確、rollback 已驗證後再做 admin UI。

你的答案：

- 決定：
- 允許調整的 policy：
- 誰可以調整：
- Approval/rollback：

## 7. 不需要 Product Owner 決定的工程事項

以下應由工程依已確認的產品政策處理，不應消耗你的決策時間：

- UUID、hash algorithm、Mongo collection 名稱、TypeScript/JavaScript type 的具體命名。
- `WorkflowRun` adapter、validator、serializer、index 的實作細節。
- background queue 用哪個 durable queue 技術；你只需決定 delivery/retry/audit 保證。
- `selectedActionInput` schema validation、idempotency、timeout wrapper 與 error adapter 的具體寫法。
- 修正 diagnostics 對 `UserCoachingMemory.memoryRecords/latestSummary` 的欄位讀取。
- 把 `Math.random()` 改成 recorded seed 或 deterministic policy 的技術方式。
- 為每個已決定 policy 補 unit、integration、replay、privacy、retention 測試。
- trace redaction、source refs、hash/version 與 access-log 的 schema 細節。

## 8. 建議回答順序

第一輪先回答：`Q01 -> Q04 -> Q06 -> Q07 -> Q10 -> Q12`。這六題會決定第一個 runtime slice 能不能開始。

第二輪回答：`Q02 -> Q03 -> Q05 -> Q08 -> Q09 -> Q11`。這一輪完成 authority、run persistence、context 與 recovery contract。

第三輪回答 P1。P2 等 shadow evidence 出來後再決定。

## 9. Source evidence

- Task routing、controller、report persistence：[master AI controller](../../backend/src/services/masterAiService.js)
- Fixed callable agent surface：[agent registry](../../backend/src/services/agentRegistryService.js)
- Rule-first candidates、blocked model actions、memory usage：[action planner](../../backend/src/services/aiControl/actionPlanner.js)
- Model action allowlist 與 fallback：[model action selector](../../backend/src/services/aiControl/modelActionSelectorService.js)
- Context 與 memory loading：[decision context builder](../../backend/src/services/aiControl/decisionContextBuilder.js)
- Session/user memory：[agent memory](../../backend/src/services/aiControl/agentMemoryService.js)、[user coaching memory](../../backend/src/services/aiControl/userCoachingMemoryService.js)
- Decision/trajectory/trace：[decision record](../../backend/src/services/aiControl/decisionRecordService.js)、[trajectory](../../backend/src/services/aiControl/trajectoryService.js)、[agent trace](../../backend/src/services/aiControl/agentTraceService.js)
- Report QA 與 repair：[report action executor](../../backend/src/services/aiControl/reportActionExecutor.js)、[QA repair loop](../../backend/src/services/report/reportQaRepairOrchestratorService.js)
- Authentication/ownership：[session controller](../../backend/src/controllers/sessionController.js)、[duplex voice socket](../../backend/src/api/duplexVoiceSocket.js)
- Runtime retention：[retention config](../../backend/src/config/retentionConfig.js)、[retention audit](../../backend/src/services/retention/retentionAuditService.js)
- Cost/usage：[DeepSeek service](../../backend/src/services/deepseekService.js)、[AI usage tracking](../../backend/src/services/aiUsageTrackingService.js)
- Eval/release evidence：[runtime trajectory evaluator](../../backend/eval/helpers/runtimeTrajectoryEvaluator.js)、[human calibration evaluator](../../backend/eval/helpers/humanCalibrationEvaluator.js)、[E2E release gate](../../backend/eval/helpers/e2eRefineReleaseGateEvaluator.js)

Evidence status：除標示為 target/recommendation 的內容外，current-state 敘述基於 2026-07-15 對上述 source、tests、eval artifacts 與現有 harness 文件的檢查。未執行 runtime implementation 或真實 provider eval。
