# AI Agent Harness Engineering 參考整理

狀態：研究筆記與後續 technical requirement reference，不改變目前產品行為。
日期：2026-07-15
Repo baseline：`497c21a`

本文件整理 AI agent harness engineering 在官方文件與論文裡反覆出現的工程考量，供 Kiwi 後續規格、架構計畫、agent workflow、評估與 release gate 使用。它只討論 AI agent / software agent / product agent 的 harness，不討論汽車或電子製造的 wire harness，也不把 Harness.io 這類 DevOps 品牌名稱當成概念定義。

## 一句話結論

AI agent harness engineering 不是「把 prompt 寫好」或「多接幾個 tool」。它是設計模型外層 runtime 支撐層的工程工作：讓 agent 看見受控上下文、只能採取明確允許的 action、在可隔離的 workspace 執行、把 state / memory / artifacts 保存成可追蹤資料、用 guardrail / permission / human review 管住風險，最後用 trace、verification、eval 和 failure attribution 證明一次 agent run 是否真的完成。

對 Kiwi 後續 requirement 最有用的定義：

> Harness engineering 是設計、實作與評估 AI agent runtime 支撐層的工程工作。它把 foundation model 的推理能力接到產品環境，並用 task contract、context/evidence selection、tool/action registry、memory/state policy、execution sandbox、observability、failure attribution、verification、permission boundary、human intervention log、cost/latency budget 與 entropy audit，讓 agent 的行為可追蹤、可驗證、可回滾、可維護。

## 查詢來源摘要

### 官方文件與官方工程資料

| Source | 對 harness engineering 的可用結論 |
| --- | --- |
| [Databricks: What is an AI Agent Harness?](https://www.databricks.com/blog/ai-harness) | 把 agent 拆成 model + harness；harness 提供 tools、memory、workspace、guardrails、sandbox、feedback loops、observability。它也明確區分 prompt engineering、context engineering 和 harness engineering。 |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) | 官方 SDK 的 primitive 是 agents、tools / handoffs、guardrails、sessions、human-in-the-loop、tracing、sandbox agents。這說明 production agent 需要 loop、tool execution、state、validation、delegation、workspace 和 trace，而不是單次 model call。 |
| [OpenAI Agents SDK: Tools](https://openai.github.io/openai-agents-python/tools/) | tool 是 agent 能採取 action 的表面，包含 hosted tools、local runtime tools、function tools、agents as tools、Codex tool；因此 harness 要定義 tool type、schema、timeout、error handling、approval gate 和 side effect 邊界。 |
| [OpenAI Agents SDK: Guardrails](https://openai.github.io/openai-agents-python/guardrails/) | guardrails 要分 input、output、tool guardrails；如果 workflow 有 manager、handoff 或 specialist，不能只靠最外層 input/output check。 |
| [OpenAI Agents SDK: Sessions](https://openai.github.io/openai-agents-python/sessions/) | sessions 是 agent loop 裡的 persistent memory layer；harness 需要決定 history 如何合併、修正、限制、壓縮和加密。 |
| [OpenAI Agents SDK: Tracing](https://openai.github.io/openai-agents-python/tracing/) | trace 應收集 LLM generations、tool calls、handoffs、guardrails 和 custom events，讓 workflow 可 debug、visualize、monitor。 |
| [Google ADK](https://adk.dev/) | ADK 把 production agent 需要的 graph workflows、multi-agent workflows、runtime、observability、evaluation、safety、sessions/memory、artifacts、callbacks、context compression 放成一套框架。重點是 deterministic code 與 adaptive reasoning 要一起設計。 |
| [Google ADK: Sessions, State, Memory](https://adk.dev/sessions/) | ADK 清楚區分 `Session`、`State` 和 cross-session `Memory`。harness 應把「當前對話狀態」與「長期可搜尋知識」分開，不應讓 prompt history 承擔所有 state。 |
| [Google ADK: Artifacts](https://adk.dev/artifacts/) | artifacts 是具名、版本化、可跨 session 或 user scope 保存的資料；agent output、檔案、音訊、報告和中間產物需要 version / namespace / MIME / storage policy。 |
| [Google ADK: Callbacks](https://adk.dev/callbacks/) | callbacks 是 observe、customize、control 的攔截點，可在 agent、model、tool 前後插入 logging、guardrails、state update 或 bypass。 |
| [Google ADK: Safety and Security](https://adk.dev/safety/) | 官方安全建議包含 identity / authorization、tool-context guardrails、callbacks/plugins、sandboxed code execution、evaluation/tracing、network perimeter。這些都是 harness 層責任。 |
| [Google ADK: Evaluation](https://adk.dev/evaluate/) | agent eval 不只看 final response，也要看 trajectory 和 tool use。這支持 Kiwi 後續用 expected trajectory、tool path、intermediate response、final response 做 release gate。 |
| [Claude Code Overview](https://code.claude.com/docs/en/overview) | Claude Code 作為 coding agent 能讀 codebase、改檔、跑 command、接 MCP、保存 memory、使用 skills/hooks、spawn subagents。這是一個完整 harness 產品範例。 |
| [Claude Code Security](https://code.claude.com/docs/en/security) | 權限、network request approval、trust verification、fail-closed command matching、command injection detection、VM/sandbox practice 是 agent harness 的安全邊界。 |
| [Claude Code Memory](https://code.claude.com/docs/en/memory) | `CLAUDE.md` 和 auto memory 是 context，不是 enforcement；若要硬性阻擋行為，要用 permission 或 hook。這對 Kiwi 很重要：memory 不能替代 policy。 |
| [Claude Code Hooks](https://code.claude.com/docs/en/hooks) | hooks 可在 tool use、message display、subagent、config、compaction、session end 等事件點攔截；這提供 harness event lifecycle 的參考。 |
| [Claude Code MCP](https://code.claude.com/docs/en/mcp) | MCP servers / plugin MCP tools 需要名稱、scope、lifecycle、permission rules、hook matcher；tool namespace 和 server identity 是治理點。 |
| [Model Context Protocol: Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) | MCP tool 需要 name、description、inputSchema、outputSchema；client 應顯示 tool、要求敏感操作確認、驗證結果、timeout、audit log。 |
| [Model Context Protocol: Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) | Streamable HTTP transport 要驗證 Origin、local server 應綁 localhost、所有連線應有 authentication。這是 tool server / local runtime 的 attack surface。 |
| [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) | LangGraph 將 agent orchestration runtime 的核心能力列為 durable execution、streaming、human-in-the-loop、persistence、memory、debugging / observability。 |
| [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) | checkpointer 與 store 對應短期 thread state 與長期 cross-thread memory。這支持把 Kiwi session state 與 user-level coaching memory 分層。 |
| [OpenHands Introduction](https://docs.openhands.dev/overview/introduction) | OpenHands 將 agent runtime、browser UI、cloud/enterprise、GitHub/GitLab/Slack/Jira/Linear、RBAC、usage reporting、budgeting enforcement 合在一起，顯示商用 harness 不只包含模型 loop，也包含協作、權限與營運控制。 |
| [Microsoft AutoGen AgentChat](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/agents.html) | AutoGen 把 agent state、tool/workbench、parallel tool calls、max tool iterations、structured output、teams、termination、人類介入分開設計；它提醒 harness 需要 loop control、concurrency control 和 stop condition。 |

### 論文與研究資料

| Paper | 對 harness engineering 的可用結論 |
| --- | --- |
| [AI Harness Engineering: A Runtime Substrate for Foundation-Model Software Agents](https://arxiv.org/abs/2605.13357) | 將 harness 定義為 model-harness-environment system 裡的 runtime substrate，列出 task specification、context selection、tool access、project memory、task state、observability、failure attribution、verification、permissions、entropy auditing、intervention recording 十一類責任，並提出 H0-H3 成熟度與 episode package 評估。 |
| [What makes a harness a harness](https://arxiv.org/abs/2606.10106) | 指出 agent harness 一詞常被混用成整個產品、eval scaffold、framework、SDK、IDE plugin 或 orchestrator；後續文件必須先說明 scope，否則討論會混亂。 |
| [Harness-Bench: Measuring Harness Effects across Models in Realistic Agent Workflows](https://arxiv.org/abs/2605.27922) | 主張 agent 能力應在 model+harness configuration 層評估，而不是只歸因於 base model；每次 run 應保留 final artifacts、execution traces、usage statistics、validator outputs。 |
| [Agentic Harness Engineering](https://arxiv.org/abs/2604.25850) | 提出 closed-loop self-evolving harness，需要 component observability、experience observability、decision observability，並把每次 harness edit 變成可驗證 prediction。這是研究前沿，不適合直接當 Kiwi 第一版。 |
| [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) | reason-act-observe loop 是許多 agent harness 的基礎，但 production harness 要把 act / observe 具體化成受控 tool execution、observation capture 和 verification。 |
| [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](https://arxiv.org/abs/2405.15793) | 強調 agent-computer interface 的設計會直接影響 coding agent 能力；工具介面、命令、檔案編輯與回饋格式不是中性 plumbing，而是 harness 的核心。 |
| [SWE-bench](https://arxiv.org/abs/2310.06770) | 以真實 GitHub issue 評估 model / agent 能否解決軟體任務，提醒 eval harness 應接近真實工作流、保留可重現環境與 oracle。 |
| [AI Agents That Matter](https://arxiv.org/abs/2407.01502) | 提醒 agent 評估要控制成本、環境、重複性與外部工具影響；不能只展示 cherry-picked demo。 |

## 概念邊界

| 概念 | 它是什麼 | 它不是什麼 | 對 Kiwi 的用法 |
| --- | --- | --- | --- |
| Prompt engineering | 設計模型輸入、角色、格式與語氣。 | 不是權限、工具、state、verification 或 release gate。 | 可用於 interviewer wording、report language，但不能單獨承擔高風險決策。 |
| Context engineering | 決定模型看哪些資料、順序、摘要、retrieval 與壓縮。 | 不是完整 action execution 或 governance。 | 對 CV/JD evidence、transcript、RAG chunk、session memory 很重要。 |
| Agent framework / SDK | 提供 agent loop、tool calling、handoff、state、graph、callback 等 building blocks。 | 不等於產品 harness；它不會替 Kiwi 定義題目計數、scoring eligibility 或 privacy policy。 | 可借鑑設計 vocabulary，不應直接把 framework 當目標架構。 |
| Eval harness | 固定 task set、執行流程、oracle、metrics、report。 | 不一定塑造 production runtime 行為。 | Kiwi 需要 replay eval / trajectory eval，但 eval 分數不能直接等於產品安全。 |
| Agent harness | 包住模型的 runtime substrate：context、tools、workspace、state、memory、guardrails、trace、verification。 | 不是單一 prompt、不是整個 UI、不是任意自治。 | Kiwi 應把 interview、voice、RAG、report、QA 都放進 shared harness vocabulary。 |
| Agent product | 使用者真正操作的完整系統。 | 不等於 harness 概念本身。 | Kiwi 是產品；harness 是產品內的控制、驗證、觀測與治理層。 |

## Harness Engineering 必須考慮的工程面

### 1. Task contract

每個 agent workflow 都要有明確 contract，而不是只把 user request 丟給模型。

需要定義：

- `objective`：本次 run 要完成什麼。
- `scope`：本次 run 涵蓋哪些資料、功能、使用者可見結果。
- `successCriteria`：什麼條件才算成功。
- `stopCondition`：何時停止、何時轉人工、何時 fail closed。
- `forbiddenBehavior`：不能做什麼，例如不能憑空補 CV evidence、不能把低信心 STT 直接評分。
- `riskClass`：低風險草稿、高風險 candidate-facing output、side-effecting action。

缺少 task contract 時，agent 很容易做過頭、解錯問題、把「建議」當「已實作」、把「可能的能力」當「產品事實」。

### 2. Action / tool contract

Tool 不是函式清單而已。它是 agent 的 action surface。

需要定義：

- tool / action 名稱、用途、input schema、output schema。
- precondition、postcondition、timeout、retry、fallback、idempotency。
- side effect level：read-only、write、external network、user-visible publication、destructive。
- permission rule：自動允許、需 human approval、禁止。
- concurrency rule：能否 parallel；是否會共享 state；是否要取消其它 action。
- result validation：工具結果進入模型前要不要 sanitize、schema validate、redact。

MCP 與 Claude Code 的安全文件都指向同一件事：tool discovery 不代表 tool trustworthy。工具名稱、description、annotation、server identity 和 transport 都要被 harness 管。

### 3. Context 與 evidence selection

Agent 能力常常壞在「看錯資料」而不是「模型不聰明」。

需要定義：

- 這次 run 允許哪些資料進 context：CV、JD、transcript、RAG chunk、report draft、memory、trace。
- 每個 context item 的 source、timestamp、version、trust level、privacy class。
- context selection reason：為什麼選這些資料，不選哪些資料。
- context compaction：長 session 如何摘要、保留 active evidence、丟棄過期內容。
- untrusted data rule：CV/JD/transcript/tool output 是資料，不是 instruction，不能覆蓋 system policy。
- claim-to-evidence mapping：每個 candidate-facing claim 要能回到 evidence ref。

對 Kiwi 來說，這是 CV/JD match、問題選擇、RAG retrieval、report grounding 的共同底層。

### 4. State、session 與 durable artifacts

State 不能只存在 prompt history 裡。官方框架普遍把 session、state、memory、artifact 分層。

需要定義：

- session state：當前 interview / report / match workflow 的進度。
- task state：本次 run 已做什麼、還缺什麼、目前 hypothesis 是什麼。
- durable artifact：report version、transcript segment、RAG evidence set、QA result、eval output。
- artifact versioning：同名 artifact 被改寫時如何保留版本。
- namespace：session-scoped、user-scoped、project-scoped、system-scoped。
- deletion / retention：CV、recording、transcript、derived report、trace 如何跟著刪除或保留。

缺少 durable state 時，agent 會重複探索、前後矛盾，或把不可重現的模型上下文當成產品記錄。

### 5. Memory policy

Memory 不是「越多越好」。它要有來源、用途、保留期限和可影響範圍。

需要定義：

- memory type：working memory、session-local memory、project memory、user-level coaching memory、long-term knowledge。
- writer：誰可以寫 memory，模型是否可以直接寫，是否需要 deterministic service。
- reader：哪些 workflow 可以讀，哪些只能看 summary。
- provenance：memory 來自哪次 session、哪個 evidence、哪個 human correction。
- confidence：模型推斷、使用者明示、系統驗證、人工確認要分級。
- effect boundary：能不能影響 scoring、question selection、report claim、only coaching wording。
- decay / deletion：舊 memory 何時降權、何時刪除。

Claude Code 的 memory 文件提醒：memory 是 context，不是 enforcement。Kiwi 不能用 memory 取代 gate、policy 或 scoring rule。

### 6. Orchestration 與 control loop

ReAct loop 只是一個抽象。產品 harness 要決定 loop 如何運行。

需要定義：

- planning strategy：model-driven、rule-first、graph workflow、manager/specialist、handoff、agents-as-tools。
- step budget：最多幾輪、最多幾個 tool call、最大 token/cost。
- deadline：特別是 voice path 的 first-audio latency。
- cancellation：使用者中斷、barge-in、session end、server timeout 如何終止。
- fallback：工具失敗、模型輸出 invalid、上下文不足時用哪條 deterministic path。
- stop condition：完成、block、review、degrade、ask clarification。

Kiwi 的 voice interview 不適合把所有下一題選擇都放進重型 multi-agent deliberation；hot path 要保留 deterministic controller 和 deadline。

### 7. Guardrails、permissions 與 human review

Guardrail 不能只在最外層做一次。高風險 workflow 要分 input、tool、output、publication gate。

需要定義：

- input guardrail：使用者輸入是否越界、是否 prompt injection、是否需要 clarification。
- tool guardrail：tool call 前後參數、權限、資料外流、結果格式是否合格。
- output guardrail：輸出是否包含 unsupported claim、敏感資訊、過度承諾、錯誤分類。
- publication gate：candidate-facing report、score、recommendation 是否可發佈。
- human review gate：blocking / non-blocking、review reason、decision、resume semantics。
- approval record：誰批准、批准什麼、根據什麼版本。

成熟 harness 通常不是讓 agent 更自由，而是把必要 autonomy 放在可審計的邊界內。

### 8. Security、privacy 與 governance

Agent harness 會把傳統「被動檔案」變成可執行或可影響 tool 的資料，attack surface 會變大。

需要定義：

- identity：agent-auth、user-auth、service account、delegated auth。
- least privilege：每個 tool / server / workflow 最小必要資料與 action。
- network boundary：外部 provider、web search、MCP server、local server、VPC / localhost。
- prompt injection defense：user data、retrieved data、tool output 都要當 untrusted content。
- data exfiltration check：tool input/output 前後要檢查敏感資料。
- secret policy：API keys、tokens、CV、recording、transcript 不應進不必要 trace。
- UI escaping：model-generated content 進 UI 前要 escape / sanitize。
- supply-chain boundary：plugin、MCP server、hooks、skills、subagents 都是可變執行面。

對 Kiwi 來說，CV、JD、錄音、逐字稿與面試報告都是敏感資料。harness 文件不能承諾加密、刪除或合規，除非 backend 真的 enforce。

### 9. Observability、trace 與 audit

沒有 trace，就無法知道 agent 做對了什麼、錯在哪裡。

需要記錄：

- workflow run id、session id、user id / privacy-safe user ref。
- model call、tool call、handoff、guardrail、human review、fallback、error。
- action input/output refs，不一定保存 raw sensitive payload。
- latency、cost、token、retry、timeout、cache hit。
- decision summary：user-safe reason、signals、evidence refs、alternatives，不保存 raw chain-of-thought。
- failure classification：context、tool、model、permission、verification、environment、human input。
- trace redaction：developer trace 與 user-visible trace 要分層。

Trace 的目標不是展示模型思考，而是留下可 debug、可審計、可回放的 engineering evidence。

### 10. Verification、evaluation 與 replay

Agent 不能用「我完成了」當完成證據。

需要定義：

- deterministic checks：schema validation、lint、unit test、grounding check、dedupe check、latency check。
- eval datasets：versioned cases、synthetic / real / human-calibrated 分開標示。
- trajectory evaluation：expected steps、actual steps、tool sequence、intermediate response。
- output evaluation：final response correctness、grounding、policy compliance、user-safe explanation。
- replay：recorded session 在新 harness / 新模型下能否重跑比較。
- release gate：pass / warn / block / review 的門檻。
- model+harness configuration：評估結果要標明模型、prompt、tool set、memory policy、context policy、budget，而不是只標 model name。

Harness-Bench 的核心提醒是：agent capability 應該在 model+harness configuration 層報告。

### 11. Failure attribution 與 recovery

成熟 harness 要能說明失敗原因，而不是把所有問題都歸咎於模型。

常見分類：

| Failure class | 例子 | Harness response |
| --- | --- | --- |
| Context failure | 漏看 JD constraint、引用過期 transcript | context selection audit、active evidence set、compaction fix |
| Tool failure | API timeout、schema mismatch、server unavailable | retry / fallback / timeout / typed error |
| Permission failure | tool 需要 approval、network 被擋 | approval request、degrade path、user-visible explanation |
| Model failure | 產生 invalid JSON、錯誤判斷 | structured output validation、repair prompt、fallback model |
| Verification failure | report claim 無 evidence、test fail | block publication、repair loop、human review |
| Environment failure | local server 掛、credential 缺失 | environment preflight、clear blocker |
| Human-input failure | user answer 不完整、STT 低信心 | clarification、understanding confirmation、不要直接扣分 |

### 12. Cost、latency 與 resource budget

Production harness 要把 cost 和 latency 當設計變數，不是事後監控。

需要定義：

- token budget、tool call budget、wall-clock deadline。
- model routing：fast / cheap / capable model 何時使用。
- cache / compaction：什麼資料可以 cache，什麼資料必須每次重新驗證。
- concurrency：parallel work 是否值得；是否會造成 side effect 或 state conflict。
- degradation path：超時時顯示 partial output、fallback question、ask user confirmation。
- billing / usage audit：每次 run 的 model、tokens、tool usage、external API 成本。

對 Kiwi voice path，latency 是產品 contract；對 report path，grounding 和 QA 可以慢一點，但要可驗證。

### 13. Human collaboration 與 UX boundary

Human-in-the-loop 不只是 approval popup。它要成為 episode trace 的一部分。

需要定義：

- 何時問使用者 clarification，何時問 reviewer approval。
- 人類輸入是否覆蓋模型結果，還是只補充 evidence。
- UI 顯示的是 user-safe explanation 還是 internal trace summary。
- 人類修正是否寫回 memory、eval dataset、failure taxonomy。
- 如何避免 hidden human correction 把 agent 能力評估灌水。

對候選人可見的 UI 應顯示「為什麼問這題 / 這個建議根據什麼 evidence」，不應顯示 raw reasoning 或內部敏感 trace。

### 14. Entropy audit 與 maintainability

一次 demo 成功不代表 harness 好。Agent 可能引入長期維護負擔。

需要檢查：

- 是否新增重複邏輯、弱化測試、留下臨時檔。
- 是否增加不必要 dependency 或 provider coupling。
- 是否讓 docs/spec 與 runtime 分離。
- 是否讓 trace schema 膨脹但沒有實際 debug value。
- 是否讓 prompt 成為隱形 business rule。
- 是否讓人工介入變成不可見支撐。

這是 AI Harness Engineering 論文中的 entropy auditing 對產品 repo 的實際含義。

## 建議的 harness planes

這些 planes 不是一定要變成資料夾或微服務，而是後續 spec 要能覆蓋的責任切分。

| Plane | 回答的問題 | 典型 artifact |
| --- | --- | --- |
| Control Plane | 誰可以做什麼？何時可以做？ | `TaskContract`、`ActionContract`、`ToolScope`、`EvaluationPolicy` |
| Context and Evidence Plane | 這次模型看到什麼？哪些 evidence 支援結果？ | `ContextPacket`、`EvidenceSet`、retrieval refs、trust metadata |
| Memory Plane | 哪些歷史資料可以被讀寫？能否影響 scoring？ | `MemoryPolicy`、session memory、user coaching memory、provenance |
| Execution Plane | 這次 run 實際發生了什麼？ | `AgentEpisode`、`WorkflowRun`、`ExecutionSpan`、`ActionExecution` |
| Verification Plane | 結果能否被信任？ | `GateResult`、QA checks、trajectory eval、replay reports |
| Governance Plane | 什麼資料/行為需要被限制或審核？ | permission rules、human review、privacy policy、retention policy |
| Observability Plane | 怎麼 debug、監控、比較版本？ | trace events、metrics、cost records、failure classification |
| UX Plane | 使用者看到什麼解釋與控制？ | user-safe reason、approval UI、clarification prompt、trace redaction |

## 成熟度層級

| Level | 定義 | 適合的 Kiwi 用途 |
| --- | --- | --- |
| H0: Prompt-only | 只有 task prompt 與模型輸出，沒有明確 tool/state/verification。 | 只適合低風險草稿，不適合候選人評分、報告、voice scoring。 |
| H1: Tool harness | 有受控 tool / action registry、schema、timeout、基本 error handling。 | 可用於 mock-safe local checks、簡單資料查詢、低風險 generation。 |
| H2: Context-memory harness | H1 加上 context selection、session state、project/user memory policy、artifact refs。 | interview planning、RAG evidence selection、question selection 至少要達到 H2。 |
| H3: Observability-verification harness | H2 加上 trace、failure attribution、deterministic checks、human review、replay eval。 | report grounding、voice state machine、Role-Fit release、production-facing output 應以 H3 為目標。 |
| H4: Shared governance harness | H3 加上跨 workflow shared policy、data retention、cost control、central eval、model/provider routing。 | 長期方向；適合 Kiwi 多 agent workflow 穩定後再抽成全產品治理層。 |

## Kiwi 對應整理

Kiwi 不是 coding-agent 產品，但問題很相似：模型不能直接決定候選人能力、下一題品質、報告結論或 voice transcript 是否可評分。Kiwi 需要一層受控 harness，把 candidate evidence、JD requirement、match analysis、interview state、voice transcript、RAG retrieval、question selection、report generation 和 QA guard 接起來。

| Kiwi area | Harness engineering 問題 | 後續 requirement 應補的欄位或證據 |
| --- | --- | --- |
| CV/JD matching | 模型如何知道哪些是 CV evidence，哪些只是 JD expectation？ | `sourceType`、`claimSourcePolicy`、`evidenceStrength`、unsupported-claim check |
| Question planning | 下一題為什麼被選？是否覆蓋 gap、level、novelty、session state？ | `selectionReason`、`expectedSignal`、`alternativesConsidered`、`rankingSignals` |
| Text interview | agent 如何避免重複題、跳題、把 repair turn 算正式題？ | state machine、question counter policy、dedupe trace、turn classification |
| Voice interview | STT 低信心、barge-in、repair prompt、latency budget 如何控制？ | confidence path、confirmation state、latency markers、non-question turn reason |
| RAG retrieval | 哪些 chunk 支援哪個 claim？retrieval 錯了如何 fallback？ | ranked chunks、retrieval quality reason、claim-to-source mapping、fallback record |
| Report generation | 報告 claim 如何證明不是 hallucination？ | claim IDs、supporting answer/evidence refs、QA gate、publication status |
| Memory / progress | session-local memory 與 user-level coaching memory 如何分界？ | `memoryScope`、provenance、confidence、`canAffectScoring`、retention class |
| Eval runners | 如何知道新 harness 真正降低錯誤？ | versioned dataset、trajectory metrics、failure attribution、human calibration sample |
| UI trace | 使用者應看到多少 explanation？developer 應看到多少 trace？ | user-safe summary、internal trace redaction、privacy boundary |

## 後續 spec 可直接使用的 acceptance checklist

一個 Kiwi agent / AI workflow 可以被稱為有 harness support，至少要滿足：

- Task contract 明確：有 objective、scope、success criteria、stop condition、forbidden behavior。
- Context 可追蹤：能說明本輪使用了哪些 CV/JD/transcript/report/RAG evidence，以及為什麼。
- Tool/action surface 受控：工具、參數、timeout、retry、fallback、side effect 都有邊界。
- State 不靠 prompt 記憶：關鍵狀態存在 session / repository / artifact / trace record。
- Memory 有 provenance：每個 memory 有 source、writer、confidence、scope、retention、effect boundary。
- Failure 有分類：失敗時能分辨 context、tool、model、permission、verification、environment、human input。
- Completion 有證據：不能只靠 LLM 說完成；要有 deterministic check、test、eval、QA guard 或人工 gate。
- 權限與隱私有邊界：secret、CV、transcript、recording、外部 network、寫入動作都有最小必要權限。
- Human intervention 可見：人類提示、批准、覆核、修正都要能回到 episode trace。
- Trace 分層：developer audit、candidate-facing explanation、raw sensitive payload 要分開。
- Cost / latency 有 budget：每次 run 有 deadline、token/tool budget、degrade path。
- Entropy 被檢查：不能為了通過單次 demo 引入過期文件、弱測試、重複邏輯、不必要 dependency。
- Evaluation 能比較：每次改 harness 要能比較 before/after，不只看單一成功案例。

## 第一版不建議直接做的事

- 不要把 self-evolving harness loop 當第一版。AHE 需要大量 trajectory、可回滾 action space、prediction contract 和 task-level outcome feedback，現在更適合當研究方向。
- 不要把 agent framework 當產品架構替代品。Kiwi 的核心風險是面試證據、候選人資料、題目選擇、transcript eligibility 與 report grounding。
- 不要把 eval harness 分數直接當產品品質。要分開標示 synthetic dataset、real provider、production corpus、human calibration、voice live gate。
- 不要把 memory 當 scoring authority。除非有 explicit policy、provenance、confidence 和 `canAffectScoring` gate。
- 不要保存 raw chain-of-thought。用 decision signals、evidence refs、gate results、failure classification 取代。

## 後續開放問題

- Kiwi 是否要把 harness engineering 定義為全產品橫切能力，還是先聚焦 Role-Fit / interview-control / report-grounding 三個高風險流程？
- 面向候選人的 UI 要顯示多少 harness trace？目前較安全方向是 user-safe explanation，不顯示 raw model reasoning 或完整 internal trace。
- 是否要建立共用 `AgentEpisode` / `WorkflowRun` / `ExecutionSpan` / `GateResult` schema，讓 question selection、RAG retrieval、report QA 和 voice decision 共用 audit contract？
- 是否要把 H2 / H3 作為 release gate 名稱，例如「Role-Fit V2 必須達 H3」？
- Voice path 的 latency budget 應如何和 H3 verification 共存？哪些 verification 必須 async，哪些必須 hot path 前完成？

Evidence status：外部 source summary 基於 2026-07-15 查詢的公開官方文件與論文摘要；Kiwi mapping 是 reference interpretation，尚未改動 runtime code。
