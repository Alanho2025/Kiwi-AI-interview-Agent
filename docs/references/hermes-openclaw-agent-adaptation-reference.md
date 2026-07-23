# Hermes / OpenClaw Agent 設計轉換參考

狀態：研究筆記與 technical requirement reference，不改變目前產品行為。  
日期：2026-07-13  
Repo baseline：`c1f9d8f`

本文件把 Hermes Agent 和 OpenClaw 的開源 agent 設計拆成五個可轉換到 Kiwi AI Interview Agent 的工程方向。它不是要 Kiwi 改成通用個人助理，也不是要把外部 repo 的 runtime 搬進來。Kiwi 的產品任務是面試練習：從 CV/JD evidence、Role-Fit matching、問題選擇、文字或語音面試，到 grounded report。外部 agent 專案能提供的是 runtime 設計 pattern，不是產品架構替代品。

## 先看結論

| 轉換點 | 外部 pattern | Kiwi 應該怎麼吸收 | 第一版落地重點 |
| --- | --- | --- | --- |
| Agent boundary | OpenClaw 的 per-agent workspace/state/session/skill 隔離 | 給 Kiwi 現有 agent 加 `AgentProfile`、capability policy、context policy | 不改 agent 行為，先讓邊界可審計 |
| Learning loop | Hermes 的 memory、session search、skill learning、自我改進 | 把 Kiwi 現有 reflection/memory 升級為 post-session learning loop | 只在 session/report 後台跑，不進 voice hot path |
| Strategy cards | Hermes/OpenClaw skills | 把 skills 轉成受審核的 interview strategy cards | 不允許任意第三方 skill 接觸 CV/JD/transcript |
| AgentRun trace | OpenClaw lifecycle/tool/assistant streams | 統一 Kiwi 現有 decision records、trace、trajectory 的 episode schema | 建 `AgentRun`/`AgentEvent` 概念，支援 debug/report/eval |
| Offline subagents | Hermes delegated isolated child agents | 只用在 report QA、progress plan、question pool refresh 等離線任務 | 不放進即時語音下一題決策 |

## Kiwi 目前的起點

Kiwi 目前不是一個「大 agent」。正式 registry 只列出幾個 domain agent：`retrieval`、`interviewer`、`reportGenerator`、`reportQa`、`interviewEvaluator`。真正負責 orchestration 的是 `runTask` 和 `runInterviewController`。它們會讀 session、建 retrieval context、跑 evaluator、選 action、執行 interviewer、寫 decision records、trajectory、memory 和 trace。

這個起點很重要。Hermes 和 OpenClaw 的 agent runtime 是為通用個人助理和工具執行而設計；Kiwi 的高風險點在「面試證據是否可靠、下一題為什麼被問、voice latency 是否守住、report claim 是否 grounded」。所以轉換策略應該是：保留 Kiwi 的 deterministic/product controller，把外部 pattern 變成邊界、記憶、策略、trace、離線工作流。

## 1. Agent boundary：把 OpenClaw 的隔離概念轉成 Kiwi 的 agent 能力邊界

### 外部專案怎麼做

OpenClaw 的 multi-agent 設計把一個 agent 定義成完整邊界：workspace、state directory、auth profiles、model registry、SQLite session store、skills visibility。不同 channel 或 account 透過 bindings route 到不同 agent。它的重點不是「多幾個 prompt」，而是每個 agent 有獨立身份、上下文、權限和 session history。

OpenClaw 的 skills 也有 allowlist。某個 agent 能看到哪些 skills，可以由 `agents.defaults.skills` 或 `agents.list[].skills` 限制。文件也提醒：skill allowlist 不是 shell 授權邊界；如果 agent 能用 `exec`，仍然要靠 sandbox、OS user、deny/allowlist 和 credentials 做真正隔離。

### Kiwi 目前的對應

Kiwi 目前的 agent registry 很薄。它把 domain function 暴露成幾個可呼叫 agent，但沒有把每個 agent 的能力、資料邊界、輸出 contract 和 trace contract 形式化。

目前實際上已經存在隱含邊界：

| Kiwi agent | 目前責任 | 隱含風險 |
| --- | --- | --- |
| `retrieval` | 找 CV/JD/interview/report 相關 evidence | 需要明確知道哪些 source type 可用、哪些 claim 不能直接推出 |
| `interviewer` | 把 action planner 的決策轉成下一題或追問 | 不能自己跳過 controller，也不能把 repair turn 算成正式題 |
| `interviewEvaluator` | 評估上一答是否提供足夠 evidence | 不能把低信心 STT 自動當成候選人答錯 |
| `reportGenerator` | 產生面試報告 | 不能產生沒有 evidence 支撐的能力 claim |
| `reportQa` | 檢查與修補 report grounding | 需要有權回看 evidence，但不應擴張成任意面試決策者 |

### Kiwi 應該怎麼轉

新增一個 `AgentProfile` 概念，先作為 metadata/config，不立即改行為。每個 registry agent 都有一份 profile：

```js
{
  agentId: 'interviewer',
  purpose: '把 controller 選好的 interview action 轉成候選人可回答的下一題',
  allowedContext: [
    'decisionContext.currentObjective',
    'decisionContext.coverageState',
    'decisionContext.matchState',
    'preparedQuestion',
    'latestAnswerUnderstanding'
  ],
  forbiddenContext: [
    'rawSecret',
    'unredactedProviderPrompt',
    'unboundedSessionHistory'
  ],
  outputContract: 'InterviewActionExecution',
  traceEvents: [
    'agent.interviewer.started',
    'agent.interviewer.completed',
    'agent.interviewer.fallback_used'
  ],
  privacyLevel: 'candidate_sensitive'
}
```

第一版可以只驗證三件事：

1. registry 裡每個 agent 都有 profile。
2. profile 宣告的 `outputContract` 能對應到現有資料形狀。
3. trace 或 decision record 能寫入 `agentId`、`purpose`、`selectionReason`、`evidenceUsed`。

### 不要怎麼轉

不要把 OpenClaw 的 workspace-per-agent 原樣搬進 Kiwi。Kiwi 的資料不是一般 workspace 檔案，而是 candidate CV、JD、transcript、report、analysis result。真正需要的是 data-scope policy，不是每個 agent 一個資料夾。

不要為了模仿 OpenClaw multi-agent routing，把 interview next-turn 拆成多個互相聊天的 autonomous agents。Kiwi 現有 controller 能守住 time limit、question limit、voice latency 和 report grounding；這些應該保留。

## 2. Learning loop：把 Hermes 的自我改進轉成面試後學習回路

### 外部專案怎麼做

Hermes 的核心賣點是 self-improving agent。它有 persistent memory、session search、skills、cron、自動從經驗產生或改善 skills、trajectory generation。Hermes 的 memory provider interface 也明確區分 lifecycle：`initialize`、`prefetch`、`queue_prefetch`、`sync_turn`、`on_session_end`、`on_pre_compress`、`shutdown`。這代表 memory 不是單純把所有聊天塞進 prompt，而是有 timing、scope 和 non-blocking contract。

Hermes 的 prompt assembly 也很重要：stable guidance、context files、volatile memory snapshot、ephemeral overlays 被分層處理。這避免每一輪都任意改 system prompt，也讓 memory 何時生效更可理解。

### Kiwi 目前的對應

Kiwi 已經有 learning loop 的種子：

| 現有服務 | 現在做什麼 | 還缺什麼 |
| --- | --- | --- |
| `agentMemoryService` | 保存 session-local `recentPatterns`、`topicHistory`、`evidenceGaps`、`projectUsage` | 還不是跨 session progress profile |
| `reflectionWriterService` | 在 misunderstanding、low evidence、section complete 等情況寫 lesson | lesson 還沒有進入可審核策略庫 |
| `userCoachingMemoryService` | 保存最近幾條 coaching memory 和 `latestSummary` | 還沒有形成穩定的 next-practice plan |
| `trajectoryService` | 保存 turn trajectory | 還沒有完整成為 learning/eval dataset |

這代表 Kiwi 不需要從零開始做 learning loop。真正缺的是把「單場 session 的反思」整理成「跨 session 的候選人成長記憶」，並讓它能安全影響下一次練習。

### Kiwi 應該怎麼轉

新增 `LearningLoopService`，但它只在 session/report 後台跑，不進 live next-question path。

建議 pipeline：

```text
session completed
  -> collect trajectoryRecords / reflectionRecords / reportQa result
  -> summarize stable learning signals
  -> update CandidateProgressMemory
  -> propose InterviewStrategyCard
  -> validate schema and evidence provenance
  -> mark as draft/reviewed/active
```

`CandidateProgressMemory` 可以先包含：

| 欄位 | 用途 |
| --- | --- |
| `roleTargets` | 候選人最近練的 role / JD 類型 |
| `recurringEvidenceGaps` | 多場 session 重複出現的弱 evidence area |
| `strongSignals` | 反覆出現的強項，不要每次都重問 |
| `answerPatterns` | 例如太籠統、太長、缺 measurable result |
| `recommendedPracticeFocus` | 下一次最應該練的 1 到 3 個 focus |
| `sourceSessionIds` | 哪些 session 支撐這個 memory |
| `confidence` | 這個結論的穩定程度 |
| `lastReviewedAt` | 是否被人或 rule gate 審核過 |

### 第一版 acceptance criteria

- 不改 live interview next-turn latency。
- Learning loop 只讀已完成或已持久化的 session artifacts。
- 每個跨 session memory 都要有 `sourceSessionIds` 或 evidence ref。
- memory 不可以直接變成 report claim；report 仍要看原始 evidence。
- 產出的 strategy card 預設是 `draft`，不能自動啟用高風險策略。

### 不要怎麼轉

不要把 Hermes 的「agent 可以自己改 skill」直接套到 Kiwi。Kiwi 處理的是候選人資料與面試評估，策略變更會影響產品判斷。第一版應該是 agent 產生 proposal，人或 deterministic validator 審核後才啟用。

不要把跨 session memory 無限制注入下一題 prompt。下一題需要知道的是 bounded summary 和與當前 role/session 有關的信號，不是完整歷史。

## 3. Strategy cards：把 skills 轉成受審核的面試策略卡

### 外部專案怎麼做

Hermes 和 OpenClaw 都把 skills 當成可重用操作程序。Hermes skills 使用 progressive disclosure：先讓 agent 看到 skills index，需要時再載入完整 skill。OpenClaw skills 有多層載入順序：workspace、project agent、personal、managed、bundled、extra dirs；同名 skill 由高 precedence 覆蓋低 precedence。OpenClaw 還有 Skill Workshop，agent 發現可重用工作時先 draft proposal，由使用者 review/apply，而不是直接改 active skill。

### Kiwi 目前的對應

Kiwi 已經有很多可以策略化的 decision point，但目前多半散在 service 或 prompt/ranker logic 裡：

| Kiwi 流程 | 可策略化的內容 |
| --- | --- |
| question pool composition | 不同 role / level / weak area 的題目生成與選擇偏好 |
| next action selection | 什麼情況追問、換題、澄清、收束 |
| report coaching | 怎麼把 evidence gap 轉成 candidate-friendly advice |
| voice repair | 低信心 transcript、barge-in、repeat request 的處理方式 |
| progress planning | 下一次練習先補哪個能力缺口 |

這些東西不應該叫一般 purpose skill，因為它們不是教 agent 操作 shell 或瀏覽器，而是教面試產品怎麼做「受控面試策略」。

### Kiwi 應該怎麼轉

建立 `InterviewStrategyCard`。它是結構化資料，不是任意 Markdown prompt。

```json
{
  "strategyId": "behavioral-star-followup",
  "status": "draft",
  "appliesWhen": {
    "section": ["behavioral", "experience"],
    "signals": ["low_specificity", "missing_measurable_result"]
  },
  "goal": "讓候選人用一個真實例子補上 role/action/outcome",
  "questionPolicy": {
    "maxFollowups": 2,
    "countsAsQuestion": true,
    "allowedActions": ["ASK_PROBING_QUESTION", "ASK_ROLE_FIT_FOLLOWUP"]
  },
  "evidencePolicy": {
    "requiresSource": ["latest_answer", "jd_role_requirement", "cv_project"],
    "forbiddenClaims": ["unsupported_seniority_judgment"]
  },
  "voicePolicy": {
    "allowedInVoiceHotPath": false,
    "requiresPrewarm": true
  },
  "review": {
    "createdBy": "learning_loop",
    "reviewedBy": null,
    "activatedAt": null
  }
}
```

第一版策略卡可以先放四類：

| Strategy card | 目的 |
| --- | --- |
| `role-fit-senior-backend` | senior backend role 需要 ownership、system design、trade-off、production impact evidence |
| `behavioral-star-followup` | 候選人回答太泛時，追問 STAR 結構的缺口 |
| `frontend-system-design-depth` | frontend role 不只問 UI，補 architecture、performance、state、accessibility |
| `low-confidence-transcript-repair` | voice transcript 不穩時，先確認理解，不直接評分 |

### 怎麼接進現有系統

策略卡不應直接呼叫 LLM。它應該被這些服務讀取：

| 服務位置 | 用法 |
| --- | --- |
| question pool composer/ranker | 用 `appliesWhen` 和 `goal` 影響題目候選池與排序 |
| action planner | 用 `allowedActions` 和 `maxFollowups` 約束下一步 |
| interviewer agent | 用 `questionPolicy` naturalize 已選策略，不自己選策略 |
| report builder | 用 strategy outcome 解釋練習建議 |
| eval runner | 用 strategy id 分析 before/after 效果 |

### 不要怎麼轉

不要接 ClawHub 或任意外部 skill marketplace。Kiwi 的 CV/JD/transcript 是敏感資料，外部 skill 不能預設取得。

不要把 strategy card 寫成自由格式 prompt。自由格式很快會變成不可測的 prompt layer。策略卡需要 schema、版本、審核狀態、evidence policy 和 voice policy。

## 4. AgentRun trace：把 OpenClaw lifecycle stream 轉成 Kiwi 的 episode audit

### 外部專案怎麼做

OpenClaw 的 agent loop 有明確 run sequence：RPC 先接受 request 並回 `{ runId, acceptedAt }`，之後 agent command 進入 session queue，runtime event 被 bridge 成 `lifecycle`、`assistant`、`tool` stream。它也把 tool start/terminal event 投影到 bounded audit ledger，不把 raw prompt、tool args、tool result 全量複製到 audit。

這個設計的價值是：使用者和 operator 能知道一次 agent run 現在在哪個 phase，失敗時也知道是 queue、model、tool、timeout、persistence 還是 output shaping。

### Kiwi 目前的對應

Kiwi 已經有不少可觀測資料：

| 現有資料 | 用途 |
| --- | --- |
| decision records | 記錄 controller/evaluator/action selection 的 reasoning summary 和 evidence |
| trajectory records | 保存每一輪的 action、input、output、evaluator state |
| agent trace events | 記錄 runtime milestone、latency、cost 或 follow-up decision |
| report QA artifacts | 檢查 report claim 是否 grounded |
| voice latency markers | 看 voice path 是否守住 timing |

問題是這些資料還沒有一個統一的 `AgentRun`/`AgentEvent` 模型。對人來說，debug 時要從多個位置拼出「這一輪到底發生什麼」。

### Kiwi 應該怎麼轉

建立一個概念上的 episode：

```text
AgentRun
  runId
  sessionId
  taskType
  inputMode
  startedAt
  completedAt
  status
  selectedAgents
  userVisibleSummary
  internalTraceRef
```

每個 run 裡有一串 bounded events：

```text
accepted
context_indexing_started
retrieval_completed
environment_built
answer_understanding_completed
turn_evaluated
decision_context_built
action_selected
action_executed
trajectory_persisted
memory_updated
completed
```

event 需要分兩層：

| 層級 | 給誰看 | 可以放什麼 | 不可以放什麼 |
| --- | --- | --- | --- |
| User-safe event | 候選人或前端 summary | 下一題為什麼被問、使用了哪些 evidence 類型、目前練習 focus | raw model reasoning、完整 transcript、內部 prompt |
| Internal audit event | developer / evaluator | latency、fallback、ranking signals、source ids、error code | secrets、provider credentials、未 redacted PII |

### 第一版落地形狀

第一版不一定要新建很多 collection。可以先建立一個 mapper，把現有 decision records、trajectory records、agent trace events 轉成 unified `AgentRunView`：

```js
buildAgentRunView({ sessionId, turnId })
  -> {
    runId,
    taskType: 'interview_next_turn',
    status,
    timeline: [...],
    selectedAction,
    evidenceUsed,
    userSafeExplanation,
    internalDiagnostics
  }
```

這會先服務三個場景：

1. developer debug：看哪一步慢、哪一步 fallback。
2. report QA：知道 report claim 依賴哪次 turn 的哪個 signal。
3. eval runner：用同一個 episode schema 比較策略改動前後。

### 不要怎麼轉

不要把 OpenClaw 的 full streaming protocol 搬進 Kiwi，除非你真的要做多 channel gateway。Kiwi 前端需要的是面試體驗和 audit summary，不是通用 agent stream protocol。

不要把 raw prompt 或 raw tool result 全部塞進 user-facing trace。candidate-facing UI 應該只顯示安全、可理解、能幫助練習的理由。

## 5. Offline subagents：把 Hermes delegation 放到離線輔助任務，不放進語音熱路徑

### 外部專案怎麼做

Hermes 的 `delegate_task` 可以 spawn child `AIAgent`。child agent 有 fresh conversation、isolated context、restricted toolsets、自己的 terminal session。父 agent 必須把 goal 和 context 傳完整，child 最後只回 summary。它可以 batch parallel，但 leaf subagent 不能 clarify、不能寫 shared memory，nested delegation 也受 depth 控制。

這種模式很適合大型 research、code review、多檔案分析、離線整理。不適合每個產品都直接放進即時決策。

### Kiwi 目前的限制

Kiwi 的語音面試有很硬的產品限制：`user speech end -> next question first audio <= 3 seconds`。任何多 agent fan-out 都會增加不確定 latency，也會讓下一題理由更難追蹤。

文字面試可以容忍稍慢，但也不應把下一題選擇交給多個 autonomous agents 投票。下一題選擇是產品控制問題：要遵守 question limit、section state、coverage、evidence gap、repair turn policy、voice/transcript policy。

### Kiwi 應該怎麼轉

把 subagent 概念放到 offline / background jobs：

| Offline subagent | 觸發時機 | 輸入 | 輸出 |
| --- | --- | --- | --- |
| `reportConsistencyReviewer` | report draft 完成後 | report、transcript refs、retrieval refs | unsupported claims、missing evidence、rewrite hints |
| `progressPlanGenerator` | session 完成後 | reflection、trajectory、report QA、CandidateProgressMemory | next-practice plan draft |
| `questionPoolAuditor` | 新 strategy card 或 JD analysis 後 | question pool、role evidence map、level rubric | coverage gaps、duplicate risk、level mismatch |
| `voiceTranscriptQualityReviewer` | voice session 完成後 | transcript confidence、repair turns、latency markers | STT issue summary、repair policy improvement proposal |
| `cohortInsightSummarizer` | 多場 session 聚合時 | anonymized aggregate metrics | product-level弱點趨勢，不回寫個人評價 |

### subagent context contract

每個 offline subagent 必須拿到完整、 bounded、redacted context：

```json
{
  "goal": "檢查 report draft 是否有 unsupported claim",
  "allowedInputs": [
    "report.claims",
    "retrievalBundle.sourceRefs",
    "transcript.turnSummaries",
    "analysisResult.roleEvidenceMap"
  ],
  "forbiddenInputs": [
    "rawCvFile",
    "providerCredentials",
    "fullUnredactedAudio"
  ],
  "mustReturn": [
    "findings",
    "evidenceRefs",
    "severity",
    "recommendedFix"
  ],
  "sideEffects": "none"
}
```

### 第一版 acceptance criteria

- subagent 只能跑在 background job。
- subagent output 只能是 proposal / QA finding / summary，不直接修改 candidate-facing result。
- 每個 finding 必須帶 evidence ref。
- timeout、cost、failure 都要寫進 trace。
- live voice path 不等待 subagent。

### 不要怎麼轉

不要用 subagents 做 voice next-question parallel debate。這會破壞 latency，也讓候選人聽到的下一題難以解釋。

不要讓 subagent 寫 shared memory。Hermes leaf subagent 預設也不能寫 shared memory，Kiwi 更應該保守。subagent 可以提出 memory update proposal，由主流程或 deterministic validator 接受。

## 建議實作順序

### Phase 1：只加邊界，不改行為

新增 `AgentProfile` config 和 profile validator。每個現有 registry agent 都必須有 purpose、allowed context、output contract、privacy level。這一階段不改 prompt、不改 LLM call、不改 next-question selection。

可驗證結果：

- registry agent profile 覆蓋率 100%。
- profile schema test 通過。
- decision record 能帶出 `agentId` 和 `outputContract`。

### Phase 2：建 post-session learning loop

新增 `LearningLoopService`，在 session completed 或 report generated 後讀 reflection/trajectory/report QA，更新 bounded progress memory，產出 draft strategy cards。

可驗證結果：

- voice hot path 沒有新增 blocking call。
- 每個 memory 都有 source session。
- draft card 不會自動啟用。

### Phase 3：把 strategy cards 接到 planner/ranker

讓 question pool composer/ranker/action planner 讀取 active strategy cards。interviewer agent 只負責把已選策略自然化成問題，不自己決定策略。

可驗證結果：

- active strategy card 能影響候選題排序。
- 禁用 strategy card 後行為可回退。
- strategy id 進入 trajectory/eval output。

### Phase 4：統一 AgentRun view

把 decision records、trajectory、trace events 映射成 `AgentRunView`，先服務 debug 和 eval，不急著改 DB schema。

可驗證結果：

- 一次 interview turn 可以輸出完整 timeline。
- report QA 能連回 supporting turn/event。
- eval runner 可以用同一個 schema 聚合 failure attribution。

### Phase 5：加 offline subagents

先做 `reportConsistencyReviewer` 或 `progressPlanGenerator`。它們風險低、價值明確，而且不會干擾 live interview。

可驗證結果：

- subagent 不改 user-facing artifact，只產生 proposal。
- proposal 帶 evidence refs。
- timeout/failure 不阻塞主流程。

## 什麼情況才需要 OpenClaw-style Gateway

目前不建議。只有在產品方向變成「候選人可以從 Slack/Telegram/Email/手機 companion app 跟 Kiwi 長期互動」時，Gateway 才有價值。即使那時候要做，也應該只把 Gateway 當 integration/control plane，不要讓它取代 interview controller。

適合 Gateway 的未來功能：

- 每週練習提醒。
- 面試前一天推送 role-fit checklist。
- 多渠道查看 progress summary。
- coach/admin channel 收到 QA warning。

不適合 Gateway 的功能：

- 即時選下一題。
- 判斷候選人能力。
- 產生 final report claim。

## 風險清單

| 風險 | 為什麼重要 | 防線 |
| --- | --- | --- |
| Autonomy 過度擴張 | 面試評估不是通用助理任務，錯誤會傷害候選人信任 | deterministic controller 保持主導 |
| Memory 污染 | 舊 session 的片面結論可能誤導下一次練習 | bounded summary、source refs、confidence、review status |
| Strategy 無法驗證 | prompt 化策略很難知道是否真的改善 | schema、version、active/draft、eval before/after |
| Voice latency 失守 | 多 agent 或 heavy learning loop 會拖慢下一題 | hot path 禁止 subagent 和 post-session learning |
| Privacy 外洩 | CV/JD/transcript 是敏感資料 | data-scope policy、redaction、no external skills by default |
| Trace 過度暴露 | raw reasoning 或 transcript 不適合直接給候選人 | user-safe trace 和 internal audit trace 分層 |

## 後續 spec 可以直接問的問題

1. `AgentProfile` 要先做 static config，還是存 DB 讓 admin 可調？
2. `CandidateProgressMemory` 是新 collection，還是先擴充 `UserCoachingMemory`？
3. Strategy card 第一版要支援哪些 role/section？
4. Active strategy card 是否需要人工 approval，還是 deterministic validator 足夠？
5. `AgentRunView` 先做 read model，還是直接新增 canonical `AgentRun` collection？
6. 第一個 offline subagent 要做 report QA 還是 progress plan？
7. candidate-facing UI 要看到多少 trace？只看「為什麼問這題」還是也看「哪些 evidence 支撐」？
8. voice mode 是否完全禁止 active strategy card 的 runtime read，改用 prewarmed snapshot？

## Source summary

| Source | 本文件採用的 pattern |
| --- | --- |
| [Hermes README](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/README.md) | self-improving agent、memory、skills、cron、delegation、trajectory generation |
| [Hermes architecture](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/developer-guide/architecture.md) | `AIAgent`、prompt builder、provider resolution、tool registry、session storage、gateway、plugins |
| [Hermes agent loop](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/developer-guide/agent-loop.md) | model call lifecycle、tool execution、agent-level tools、callbacks、compression、persistence |
| [Hermes prompt assembly](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/developer-guide/prompt-assembly.md) | stable/context/volatile prompt layers、ephemeral overlays、memory snapshot boundary |
| [Hermes memory provider plugin](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/developer-guide/memory-provider-plugin.md) | memory lifecycle hooks、non-blocking sync、profile isolation |
| [Hermes delegation](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/user-guide/features/delegation.md) | isolated child agents、fresh context、restricted toolsets、final summary only |
| [OpenClaw README](https://raw.githubusercontent.com/openclaw/openclaw/main/README.md) | local-first gateway、多 channel、multi-agent routing、voice/canvas/tools、安全預設 |
| [OpenClaw gateway architecture](https://raw.githubusercontent.com/openclaw/openclaw/main/docs/concepts/architecture.md) | single long-lived Gateway、typed WebSocket API、node/client lifecycle、mandatory handshake |
| [OpenClaw agent runtime](https://raw.githubusercontent.com/openclaw/openclaw/main/docs/concepts/agent.md) | embedded runtime、workspace bootstrap files、skills loading、SQLite session store |
| [OpenClaw agent loop](https://raw.githubusercontent.com/openclaw/openclaw/main/docs/concepts/agent-loop.md) | accepted run、session/global queue、lifecycle/assistant/tool streams、bounded audit projection |
| [OpenClaw multi-agent routing](https://raw.githubusercontent.com/openclaw/openclaw/main/docs/concepts/multi-agent.md) | per-agent workspace/state/auth/session、bindings、skill allowlists、isolation caveats |
| [OpenClaw skills](https://raw.githubusercontent.com/openclaw/openclaw/main/docs/tools/skills.md) | skill precedence、agent allowlists、Skill Workshop proposal queue、ClawHub install/verify |
| [OpenClaw sandboxing](https://raw.githubusercontent.com/openclaw/openclaw/main/docs/gateway/sandboxing.md) | tool execution sandbox modes、scope、backend、network/filesystem boundary |

## Evidence status

外部 source summary 基於 2026-07-13 查詢的 Hermes Agent 與 OpenClaw public GitHub docs。Kiwi mapping 基於目前 repo-docs、`agentRegistryService`、`masterAiService`、`agentMemoryService`、`reflectionWriterService`、`userCoachingMemoryService` 的源碼閱讀與架構推斷。本文是 reference，不代表任何 runtime behavior 已經實作。
