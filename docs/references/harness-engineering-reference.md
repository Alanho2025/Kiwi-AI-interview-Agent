# Harness Engineering 定義參考

狀態：研究筆記與後續 technical requirement reference，不改變目前產品行為。  
日期：2026-07-13  
Repo baseline：`c1f9d8f`

本文件只討論 software / AI agent / coding-agent 語境中的 harness engineering，不包含汽車或電子製造裡的 wire harness engineering，也不把 Harness.io 這類 DevOps 平台品牌名稱當成概念定義。

## 結論

目前市面上對 harness engineering 還沒有單一標準定義。比較穩定的共識是：**harness 不是模型本身，而是包在模型或 agent 外面的 runtime substrate，負責讓 agent 看見正確上下文、使用受控工具、保存任務狀態、接收可解釋回饋、通過權限邊界、產生驗證證據，最後把一次 agent run 變成可審計的工程 episode。**

對 Kiwi 後續 requirement 最有用的定義可以寫成：

> Harness engineering 是設計、實作與評估 AI agent runtime 支撐層的工程工作。它把 foundation model 的潛在能力接到實際產品或 repository 環境，並用明確的 task contract、context selection、tool registry、memory/state、observability、failure attribution、verification、permission boundary、human intervention log 與 entropy audit，讓 agent 的輸出可追蹤、可驗證、可回滾、可維護。

這個定義刻意把 harness engineering 與 prompt engineering 分開：prompt 可以是 harness 的一個部件，但 harness engineering 關心的是整個執行系統，而不是單次模型訊息。

## Source Summary

| Source | 對定義的可用結論 |
| --- | --- |
| [ISTQB Glossary: Test Harness](https://glossary.istqb.org/en_US/term/test-harness) | 傳統 test harness 是測試用支撐層：用替身、driver、fixture、測試資料或自動化執行環境，把待測元件放進可控條件下執行。這是 AI harness 語義的早期來源。 |
| [Claude Code Overview](https://code.claude.com/docs/en/overview) | Claude Code 把 coding agent 定位成可讀 codebase、改檔、跑 command、整合 dev tools 的 agentic coding tool；它還提供 MCP、instructions、memory、skills、hooks、多 agent 與 Agent SDK。這代表市場上的 agent harness 通常不只是一個 prompt，而是一整套工具、記憶、權限與工作流支撐。 |
| [OpenAI Codex CLI](https://learn.chatgpt.com/docs/codex/cli) | Codex CLI 主打在 terminal 內 inspect、edit、run code，支援本地 coding loop、skills/plugins、review、subagents、MCP、cloud handoff。這說明 coding-agent harness 需要把 repository、terminal、diff、review、delegation 和外部工具整合成一個可操作 runtime。 |
| [OpenAI Codex Sandbox](https://learn.chatgpt.com/docs/sandboxing) 與 [Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security) | Codex 把 sandbox 與 approval 分成兩層控制：sandbox 定義 agent 技術上能做什麼，approval policy 定義何時必須停下來請求確認。這是 harness engineering 裡 permission boundary 的市場化實例。 |
| [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents) | OpenAI 將 agents 描述為能 plan、call tools、協作並保存足夠 state 完成 multi-step work 的 applications。SDK 是建立 agent app 的 framework，但完整 harness 還要包含產品自己的工具實作、狀態儲存、approval 決策、observability 和 verification。 |
| [OpenHands Introduction](https://docs.openhands.dev/overview/introduction) | OpenHands 把 agent 能力拆成 Agent Canvas、Cloud、Enterprise 與 Software Agent SDK；SDK 是 composable engine，Cloud/Enterprise 加上 GitHub/GitLab/Bitbucket、Slack/Jira/Linear、multi-user、RBAC、usage reporting、budgeting。這說明商用 harness 通常同時包含 agent runtime、協作面、權限與營運控制。 |
| [SWE-agent documentation](https://swe-agent.com/latest/) | SWE-agent 讓 language model 自主使用 tools 來修 GitHub repo issue、找 security vulnerabilities 或做 custom task，並強調可配置、研究友好與 SWE-bench 表現。這是 agent-computer interface 與 eval benchmark 導向 harness 的代表。 |
| [AI Harness Engineering: A Runtime Substrate for Foundation-Model Software Agents](https://arxiv.org/abs/2605.13357) | 這篇 2026 paper 將 AI Harness Engineering 正式定義成包住 foundation-model software agent 的 runtime substrate，並列出 task specification、context selection、tool access、project memory、task state、observability、failure attribution、verification、permissions、entropy auditing、intervention recording 等責任。 |
| [What makes a harness a harness](https://arxiv.org/abs/2606.10106) | 這篇 paper 指出 agent harness 在市場上用法混雜：有時指 Claude Code / Codex CLI 這種整個產品，有時指 SWE-bench 這種 eval scaffold，也常被混同為 framework、SDK、IDE plugin 或 orchestrator。後續文件需要先標明範圍。 |
| [Agentic Harness Engineering](https://arxiv.org/abs/2604.25850) | Agentic Harness Engineering 是更進階的 closed loop：讓 agent 依 component observability、experience observability、decision observability 自動修改並驗證 harness。這比較像 research frontier，不應直接當 Kiwi 的第一版需求。 |
| [Harness Engineering as Categorical Architecture](https://arxiv.org/abs/2605.12239) | 這篇把 harness 視為包含 prompts、tools、memory、orchestration logic 的 system layer，並嘗試用 formal architecture 描述跨 framework 的保證保存。它補強一點：harness 是結構化系統，不是散落的 prompt 技巧。 |

## 市場語義分層

| 層級 | 市面上常見說法 | 定義重點 | 與 harness engineering 的關係 |
| --- | --- | --- | --- |
| Test harness | unit / integration test harness | 用可控環境、stub、driver、fixture、test data 讓程式可測。 | 詞源與工程直覺來源。它主要測 software component，不一定涉及 AI agent。 |
| Evaluation harness | benchmark harness, SWE-bench harness, eval runner | 把 model / agent 放進固定 task set，執行、收集 metrics、比較結果。 | 衡量 agent 表現，但通常不直接塑造產品內的 runtime 行為。 |
| Agent harness | coding-agent harness, AI agent harness | 包住 LLM / foundation model，提供 context、tools、memory、state、permissions、observation、verification。 | 最接近 Kiwi 需要採用的核心概念。 |
| Agent framework / SDK | Agents SDK, LangGraph, AutoGen, OpenHands SDK | 提供建立 agent loop、tool calling、handoff、state 或 orchestration 的開發框架。 | 可以用來做 harness，但不等於 harness；產品還要定義任務、權限、驗證、資料與 UX 邊界。 |
| Agent product | Claude Code, Codex CLI, OpenHands Cloud, Cline, Aider | 使用者直接操作的完整 coding agent 產品。 | 產品裡通常含有 harness，但產品名稱不等於概念定義。 |
| Agentic harness engineering | self-evolving harness, observability-driven harness evolution | agent 透過可觀測資料自動修改 harness component，並用下一輪結果驗證。 | 研究前沿。適合當長期方向，不適合直接作為 Kiwi 第一版。 |

## 必要邊界

### 不是 prompt engineering

Prompt engineering 主要處理模型輸入怎麼寫。Harness engineering 會包含 prompt，但還要處理 agent 能看到什麼、能做什麼、如何被阻止、如何驗證、失敗如何歸因、產物如何保存、何時需要人類介入。

### 不是單純 agent framework

Framework 提供 building blocks；harness 是特定產品或 repository 讓 agent 完成任務時真正暴露出來的 runtime contract。即使用同一個 framework，不同產品的 harness 也可能完全不同。

### 不是 eval harness 而已

Eval harness 主要測量行為。Development / product harness 會塑造行為。Kiwi 需要兩者：產品 runtime harness 控制訪談、取證與報告；eval harness 衡量這些控制是否真的降低錯誤與風險。

### 不是讓 agent 更自由

成熟 harness 反而通常會縮小任意行動空間：工具清單更明確、權限更窄、驗證更硬、trace 更完整。目標不是 autonomy 最大化，而是讓必要 autonomy 在可審計邊界內發生。

## Harness Engineering 的核心責任

| Responsibility | 中文定義 | 缺少時的典型失敗 |
| --- | --- | --- |
| Task contract | 明確說明目標、限制、成功條件、不可做事項。 | agent 解錯問題、做過頭、把非需求當需求。 |
| Context selection | 決定 agent 應看哪些 source、文件、trace、資料片段，並記錄原因。 | 看錯檔、漏掉約束、依賴不相關上下文。 |
| Tool registry | 定義可用工具、參數、權限、成本、timeout、fallback。 | tool misuse、無限嘗試、危險 command、不可重現結果。 |
| Memory / project knowledge | 保存穩定的架構、約定、已知限制、前次學到的 repo knowledge。 | 重複探索、違反架構邊界、修錯層。 |
| Task state | 記錄目前 hypothesis、已檢查內容、open questions、下一步。 | agent 漂移、重複工作、前後矛盾。 |
| Observability | 暴露 logs、trace、tool output、runtime error、latency、decision record。 | 成功不可證明，失敗不可診斷。 |
| Failure attribution | 把失敗拆成 context、tool、feedback、verification、model、permission 或 environment 類型。 | 看到錯誤就亂 patch，或把所有失敗都怪模型。 |
| Verification protocol | 把成功條件映射到 deterministic checks、tests、lint、eval、manual gate。 | 自稱完成但沒有證據。 |
| Permission boundary | 限制 filesystem、network、secret、destructive command、side-effecting tool。 | 安全事件、資料外洩、不可逆更改。 |
| Intervention recording | 記錄人類何時介入、介入了什麼、是否代表 harness 缺口。 | 實際依賴人類支撐，卻被誤判成 agent 能力。 |
| Entropy audit | 檢查 agent 是否引入維護負擔：殘留檔案、弱化測試、依賴膨脹、文件過期。 | 短期 task 過了，長期 codebase 變差。 |

## 成熟度層級草案

| Level | 定義 | Kiwi 若採用時的判準 |
| --- | --- | --- |
| H0: Minimal | agent 只有 task 描述與 repo / product 資料，沒有明確工具、記憶或驗證協議。 | 現階段不應把高風險面試決策放在 H0；最多適合草稿生成。 |
| H1: Tool harness | 有 tool registry、測試/查詢工具與使用規則，但上下文與完成判斷仍弱。 | 可用於低風險 mock-safe 工具調用，例如 deterministic local checks。 |
| H2: Context-memory harness | H1 加上 project memory、context selection、task state、已知 failure。 | Kiwi 的 interview planning、RAG evidence selection、question selection 應至少達到 H2。 |
| H3: Observability-verification harness | H2 加上 failure attribution、deterministic check registry、verification report、rollback/intervention record。 | Kiwi 的 report grounding、voice state machine、Role-Fit cutover、production release gate 應以 H3 為目標。 |

## 對 Kiwi 的定義映射

Kiwi 不是 coding-agent 產品，但它有相同的 harness engineering 問題：LLM 不能直接決定候選人能力、題目品質或報告結論。產品需要一層受控 harness，把 candidate evidence、JD requirement、match analysis、interview state、voice transcript、RAG retrieval、question selection、report generation 和 QA guard 接起來。

| Kiwi area | Harness engineering 問題 | 後續 requirement 應補的欄位或證據 |
| --- | --- | --- |
| CV/JD matching | 模型如何知道哪些 evidence 可用，哪些只是 JD expectation？ | `sourceType`、`claimSourcePolicy`、`evidenceStrength`、forbidden claim check。 |
| Question planning | 下一題為什麼被選，是否符合 level、gap、coverage 與 session state？ | `selectionReason`、`expectedSignal`、`alternativesConsidered`、`rankingSignals`。 |
| Text interview | agent 如何避免重複題、跳題、把 repair turn 算成正式題？ | state machine、question counter policy、dedupe trace、repair/clarification classification。 |
| Voice interview | STT 低信心、barge-in、repair prompt 和 latency budget 如何被控制？ | confidence path、confirmation state、latency markers、non-question turn reason。 |
| RAG / evidence retrieval | retrieval 結果如何被評估、何時 fallback、哪些 chunk 支援哪個 claim？ | ranked chunks、quality reason、retrieval budget、claim-to-source mapping。 |
| Report generation | 報告 claim 如何證明不是 hallucination？ | claim IDs、supporting answer/evidence refs、unsupported claim zero-tolerance check。 |
| Eval runners | 如何知道一次 agent workflow 真的更可靠？ | versioned dataset、trajectory metrics、failure attribution、human calibration sample。 |
| UI trace | 哪些 trace 可以給 user 看，哪些只給 developer audit？ | user-safe reasoning summary、internal trace redaction、privacy boundary。 |

## 後續 spec 可直接使用的 acceptance checklist

一個 Kiwi agent / AI workflow 可以被稱為有 harness support，至少要滿足：

- Task contract 明確：有 objective、scope、success criteria、stop condition、不可做事項。
- Context 可追蹤：能說明本輪使用了哪些 CV/JD/transcript/report/RAG evidence，以及為什麼。
- Tool surface 受控：工具、參數、timeout、retry、fallback、side effect 都有邊界。
- State 不靠 prompt 記憶：關鍵狀態存在 session / repository / trace record，而不是只存在模型上下文。
- Failure 有分類：失敗時能分辨是 context 不足、tool 失敗、model 判斷錯、資料缺失、permission gate 還是 verification 不足。
- Completion 有證據：不能只靠 LLM 說完成；要有 deterministic check、test、eval、QA guard 或人工 gate。
- 權限與隱私有邊界：secret、CV、transcript、recording、外部 network、寫入動作都有最小必要權限。
- Human intervention 可見：人類提示、批准、覆核、修正都要能回到 episode trace，而不是隱形加分。
- Entropy 被檢查：不能為了通過單次 demo 引入過期文件、弱測試、重複邏輯、不必要 dependency 或不可維護 trace。
- Evaluation 能比較：每次改 harness 要能比較 before/after，不只看單一成功案例。

## 暫不建議放進 Kiwi 第一版的內容

- 自動修改 harness component 的 self-evolving harness loop。它需要大量 trajectory、可回滾 action space、prediction contract 和 task-level outcome feedback，現在更適合當研究方向。
- 把 agent framework 當成產品 architecture 的替代品。Kiwi 的核心風險是面試證據、候選人資料、題目選擇與報告 grounding，不是缺少一個 generic agent loop。
- 把 eval harness 分數直接當產品品質。即使 local eval 通過，也要分開標示 synthetic dataset、real provider、production corpus、human calibration、voice live gate。

## 開放問題

- Kiwi 是否要把 harness engineering 定義為全產品橫切能力，還是只放在 Role-Fit / interview-control / report-grounding 三個高風險流程？
- 面向候選人的 UI 要顯示多少 harness trace？目前比較安全的方向是顯示 user-safe explanation，不顯示 raw model reasoning 或完整 internal trace。
- 後續 spec 是否要建立一個共用 `agentEpisode` / `decisionTrace` schema，讓 question selection、RAG retrieval、report QA 和 voice decision 共用同一套 audit contract？
- 是否需要把 H2 / H3 作為 release gate 名稱，例如「Role-Fit V2 必須達 H3」？

Evidence status：外部 source summary 基於 2026-07-13 查詢的公開文件與論文摘要；Kiwi mapping 是根據目前產品方向的 reference interpretation，尚未改動 runtime code。
