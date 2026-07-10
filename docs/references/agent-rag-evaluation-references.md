# Agent、ReAct 與 RAG Evaluation 參考

狀態：研究筆記與後續 implementation reference，不改變目前產品行為。  
日期：2026-07-10  
Repo baseline：`0849da5bc448cdca2d7d2512a22f213f6dabe4a1`

本文件先回答兩個產品問題：Kiwi 的 agent 應如何採用 ReAct，以及目前 RAG evaluation 與 RAGAS 的差距在哪裡。外部專案是用來借鏡資料契約、評估方法和 trace 設計，不代表要直接引入其 runtime 或 dependency。

## 結論

- Kiwi 已經有「選 action -> 執行 action -> 記錄 observation」的受控訪談流程，但它不是原始論文意義上的 fully autonomous ReAct loop。
- 目前的 `reactTrace` 是 deterministic audit trace：它記錄 controller 的選擇、結構化 reason 和上一輪答案摘要；不能把它稱為模型逐步 Chain-of-Thought，也不應顯示給候選人。
- Kiwi 目前有有價值的 retrieval robustness suite 和 anti-overclaim guard，但尚未做到 RAGAS 所代表的「從實際 RAG run 收集 `query + retrieved contexts + response`，再用可比較的 metric 評估 retrieval 與 generation」的程度。
- 對 Kiwi 最合適的演進是保留 deterministic controller / privacy boundary，在現有 JS eval harness 增加 RAGAS-style dataset contract、ranked-retrieval metrics、claim-level grounding judge 和 agent trajectory metrics；不需要先把產品遷移到 Python、LangGraph 或完整 RAGAS runtime。

## 目前 Kiwi 的證據基線

### Retrieval 與 evaluation 現況

| Area | Current implementation | Boundary |
| --- | --- | --- |
| Retrieval | `backend/src/services/ragRetrievalService.js` 從 `document_chunks` 取 top 100，使用 hash embedding 的 pgvector score、keyword overlap、metadata boost 組成 fusion score，再取 top K。 | `weighted_hash_ngram_v2` 是 deterministic 256-dimensional embedding，不是 production semantic embedding。 |
| Quality gate | `backend/src/services/retrieval/retrievalQualityAssessor.js` 檢查 no result、literal topic alignment、top fusion score、generic chunk，必要時 trigger corrective retrieval。 | 它判斷「這次結果是否顯然不足」，不是離線衡量 retriever ranking quality。 |
| Retrieval agent | `backend/src/services/agents/retrievalAgent.js` 依 objective 選 source、分 session/global retrieval、merge、retry，最後回傳 evidence bundle。 | `qualityAssessment.score` 是 runtime heuristic，不能當 benchmark metric。 |
| Offline retrieval eval | `backend/eval/runners/runRetrievalEval.js` 讀取 8 個 hand-written scenario，`backend/eval/helpers/retrievalJudge.js` 用 phrase presence、token overlap、safe fallback 和 expected outcome 的字串規則打分。 | dataset 的 `sources` 是 fixture，不是實際 retriever 的 returned ranked chunks；runner 不呼叫 `retrieveChunks` 或 generation。 |
| Latest result | `backend/eval/reports/retrieval-eval.latest.json` 記錄 8 cases、average `0.97`，產物生成於 `2026-06-02T20:48:45.430Z`。 | 此數字表示 fixtures 達到 judge 的預期，不能解讀為 RAG precision/recall 或 report faithfulness。 |
| Report grounding | `backend/tests/robustness/report/reportGroundingRobustness.test.js` 與 report QA 會保護 evidence claim、rewrite 和 report integrity。 | 它是報告層的 safeguard，沒有把每個 generated output 對照本輪 retrieved contexts 量化。 |

### Current ReAct-shaped flow

```text
latest answer / session state
  -> deterministic evaluator + decision context
  -> deterministic candidate actions and fallback plan
  -> optional constrained model action selection
  -> action executor may call retrieval
  -> interviewer selects a controlled base question
  -> bounded LLM micro-planning only naturalizes spoken wording
  -> guards, dedupe, persistence, trajectory record
```

具體責任分界：

- `backend/src/services/aiControl/actionPlanner.js` 先從 session、coverage、match validation、repetition 和 interview mode 產生受限的 candidate actions。
- `backend/src/services/masterAiService.js` 選擇 rule fallback 或驗證過的 model action，然後交給 `backend/src/services/aiControl/interviewActionExecutor.js`。
- `backend/src/services/agents/interviewerAgent.js` 選 root/follow-up question，最後的 `runBoundedQuestionMicroPlanning` 只處理 spoken wording；dedupe 與 mode guard 在它之後仍可否決輸出。
- `backend/src/services/agents/interviewerAgentQuestionBuilder.js` 的 `buildReactTrace` 由已選 action 和 current state 組出 `thoughtSummary` / `observationSummary`。它不是模型產生且未驗證的 private reasoning transcript。
- `backend/src/services/aiControl/trajectoryService.js` 將 action、tool、observation summary、candidate actions、planner signals 和 output 存為可稽核 trajectory。

## 開源參考專案

| Project | Related capability | Readable pattern to borrow | Kiwi adoption decision |
| --- | --- | --- |
| [vibrantlabsai/ragas](https://github.com/vibrantlabsai/ragas) | RAG / agent evaluation | 將單一 RAG run 正規化成 input、retrieved contexts、response、optional reference，再把 retrieval 和 generation 指標分開。 | 借 metric contract 與 dataset design；暫不直接引入 Python runtime。 |
| [ysymyth/ReAct](https://github.com/ysymyth/ReAct) | 原始 ReAct prompting 實作 | Interleave `Thought -> Action -> Observation`，以 observation 更新下一步，而不是先寫完固定 plan。 | 借「action 有工具、觀察會改變 decision」的 loop；不要存或展示 raw private thoughts。 |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | Stateful agent orchestration | 狀態、durable execution、human oversight、memory 與 trace 分離；graph / state-machine 而非 giant prompt。 | Kiwi 已有相近 state-machine direction；不要為功能重複而遷移 framework。 |
| [deepset-ai/haystack](https://github.com/deepset-ai/haystack) | Modular RAG pipeline evaluation | 把 retrieval、routing、generation 和 evaluator 當成顯式 component；faithfulness 以 answer claims 對 contexts 逐項判斷。 | 借 claim-level result shape 和 evaluator input contract；保留 Node service boundaries。 |
| [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix) | Observability / experimentation | 對 runtime trace 做 versioned datasets、experiments、retrieval/response eval，讓 regression 可定位到一個具體 run。 | 借 trace schema、dataset version 和 experiment comparison；先輸出 local JSON/Markdown，不引入平台。 |
| [confident-ai/deepeval](https://github.com/confident-ai/deepeval) | LLM test harness | 把 LLM eval 放進 test workflow，支援 custom rubric、task completion、tool correctness 和 judge explanations。 | 借 test-case / threshold / failure report shape；目前 Vitest harness 足夠承載。 |

### 為什麼這些不是 direct dependencies

這些專案大多以 Python 或平台 service 為主，而 Kiwi 的 product contract 需要 Express backend、deterministic controller、voice latency budget、Mongo/Postgres persistence 與可控的 mock-safe test path。直接包一層 framework 會把核心 decision ownership 從目前的 services 移走，卻沒有先解決 metric dataset、judge calibration、privacy 和 cost 的真正缺口。

## ReAct：正確的工程解讀

### 原始概念

Yao et al. 的 ReAct 是讓 language model 交錯產生 reasoning trace 與 task action：reasoning 用來建立、更新或修正 plan；action 讀取外部環境並返回 observation，讓後續 reasoning 依新證據調整。原始 QA setting 的關鍵不是「有一段 thought text」，而是 action 真的能改變可用資訊與下一個 decision。

```text
State_0
  -> decision / rationale for a bounded action
  -> Action(tool, validated args)
  -> Observation(tool result, error, empty result, or user input)
  -> State_1 with explicit stop/budget checks
  -> next action or final user-facing output
```

### Kiwi 需要的 ReAct contract

| ReAct element | Kiwi equivalent | Requirement |
| --- | --- | --- |
| State | `decisionContext`, evaluator state, coverage state, session state | Persist compact, inspectable fields; do not rely on prompt-only memory. |
| Reason / plan | `candidateActions`, planner signals, selected action, rationale | Use structured reasons and evidence references, not raw model chain-of-thought. |
| Action | retrieval, select prepared question, ask follow-up, switch topic, wrap-up, report generation | Only allow actions from enum/registry; validate inputs before execution. |
| Observation | retrieval bundle, empty/error/degraded result, latest accepted answer, evaluator output | Store source IDs, score/quality, and failure reason so the next decision can change safely. |
| Loop guard | question/time limit, repair counter, duplicate guard, retrieval retry budget, voice latency budget | Every looping action must have explicit stop criteria and fallback. |
| Trace | decision record + trajectory + latency markers | Record a user-safe `reasoningSummary`, tool, args, observation summary, candidate alternatives, and outcome. |

### What not to do

- 不要把 `thoughtSummary` 當作 raw model reasoning，或把它輸出到 candidate-facing UI。
- 不要讓 model invent arbitrary tools、source types、question evidence 或 completed state。
- 不要在 voice turn 中開放 unbounded `retrieve -> reason -> retrieve` loops；這會違反 latency / transparency contract。
- 不要用 ReAct 名稱掩蓋 deterministic state-machine 缺口。Kiwi 的可稽核 controller 比 autonomous loop 更符合面試產品需要。

### Recommended target trace shape

這是下一輪 implementation 應採用的 user-safe trace，而不是 chain-of-thought capture：

```json
{
  "traceVersion": "v1",
  "turnId": "...",
  "stateBefore": {
    "stage": "technical_validation",
    "coverageGaps": ["deployment_validation"],
    "retrievalBudgetRemaining": 1
  },
  "candidateActions": [
    {
      "action": "ASK_VALIDATION_QUESTION",
      "priority": 0.82,
      "evidenceNeed": ["claim_validation"]
    }
  ],
  "selectedAction": "ASK_VALIDATION_QUESTION",
  "selectionReason": "Unresolved JD claim needs direct candidate evidence.",
  "toolCall": {
    "name": "retrieve_interview_evidence",
    "args": { "targetTopic": "deployment_validation", "topK": 5 }
  },
  "observation": {
    "status": "limited",
    "retrievedChunkIds": ["..."],
    "qualityReasons": ["LOW_TOPIC_ALIGNMENT"]
  },
  "outcome": {
    "questionId": "...",
    "fallbackUsed": false
  }
}
```

## RAGAS comparison

### What the 2023 paper actually adds

RAGAS is a reference-free RAG evaluation framework. Its premise is that RAG must be evaluated on separate dimensions: whether retrieval finds focused/relevant context, whether generation is faithful to that context, and whether the resulting answer is useful. It does not require every case to have human ground truth, though reference answers/contexts enable stronger recall and correctness metrics.

Current Ragas also exposes RAG metrics such as context precision, context recall, noise sensitivity, response relevancy and faithfulness, plus agent metrics such as tool-call accuracy and goal accuracy. Metric implementations and APIs evolve, so Kiwi should borrow the evaluation model rather than hard-code an external library's exact current API.

### Gap matrix

| Evaluation question | RAGAS-style measurement | Kiwi today | Gap |
| --- | --- | --- | --- |
| Did top-ranked chunks answer the query before irrelevant chunks? | Context precision / ranked relevance at K. | Fusion score exists, but `eval:retrieval` checks phrase presence in fixture sources, not the actual ranked `retrieveChunks` output. | High |
| Did retrieval return all evidence needed to support a known reference answer? | Context recall against reference answer, reference chunks, or stable source IDs. | No per-query reference set or retrieval recall calculation. | High |
| Did irrelevant or misleading chunks cause a wrong result? | Noise sensitivity over query, contexts, response and optional reference. | Has blocked-evidence fixtures, but no generated response linked to retrieved chunks. | High |
| Is the generated report/coaching/question grounded in retrieved evidence? | Claim-level faithfulness: supported generated claims / total generated claims. | Report QA has grounding guards, but retrieval eval does not compare an actual output against that run's contexts. | High |
| Does the response answer the intended task? | Response relevancy / role-specific rubric. | Interview evaluator and report tests exist, but are not joined with retrieval outcomes in one case record. | Medium |
| Did the agent choose and invoke the correct action/tool? | Tool call accuracy / ToolCallF1 / goal accuracy over expected trajectory. | `eval:agent-trajectory` checks simplified trace scenarios; it is not derived from runtime action calls and does not check tool args as a first-class contract. | Medium |
| Can a regression be compared across prompt, retriever, embedding, chunking and model changes? | Versioned evaluation dataset + per-case metric output + experiment metadata. | Latest JSON/Markdown reports exist but no common run schema, dataset version, model/retriever config fingerprint or regression baseline by metric. | High |
| Can automated scores be trusted for hiring-coaching domain claims? | Judge calibration against human-labeled sample; inspect disagreements. | No calibration set or inter-rater agreement process found. | High |

### Why the current 0.97 does not mean RAGAS-level quality

The `0.97` result is still useful: it proves the handcrafted judge accepts the intended safety cases, including weak evidence and timeout fallback. But it cannot measure the production retriever because the runner never runs the indexed corpus/query path. It also cannot establish faithfulness because it has no actual generated output to split into claims and compare against the retrieved contexts.

Therefore the accurate statement is: **Kiwi has deterministic retrieval safety regression tests, not a full RAGAS-class RAG evaluation system.**

## Recommended Kiwi evaluation architecture

### Phase 1: Actual retrieval benchmark, mock-safe

Add a versioned JSON dataset where each case includes real indexed chunks (stable `chunkId` / source IDs), query, source filter, expected relevant chunk IDs, expected forbidden chunk IDs, and domain/risk label. The eval runner must call the actual retrieval service or a deterministic in-memory equivalent that reuses the same scoring function.

Required metrics:

- `precisionAtK`, `recallAtK`, `MRR`, `nDCG` for ranked retrieval.
- source policy accuracy: correct source types were selected for objective.
- prohibited-evidence retrieval rate and safe degraded-fallback rate.
- slice results for CV, JD, match analysis, transcript, prepared pool and report evidence.

### Phase 2: Generation-grounding dataset

For report/coaching and candidate-question-answer use cases, capture an evaluation record after a real deterministic/e2e run:

```json
{
  "caseId": "report-gap-validation-001",
  "input": { "objective": "ground_report_generation", "query": "..." },
  "retrieval": {
    "chunkIds": ["..."],
    "contexts": ["..."],
    "configFingerprint": "embedding=...;fusion=...;topK=..."
  },
  "output": { "text": "...", "claimRefs": ["..."] },
  "reference": {
    "requiredClaims": ["..."],
    "forbiddenClaims": ["..."]
  },
  "labels": { "domain": "interview_report", "risk": "high" }
}
```

Run deterministic checks first: citation/source-ID validity, forbidden claim phrases, output schema, no direct PII in eval artifact. Then use an LLM judge or NLI-style judge only for bounded claim support, with the prompt/version and per-claim decision persisted.

Required metrics:

- claim faithfulness / groundedness;
- required-claim coverage (a Kiwi-specific analogue of recall);
- output relevancy to interview objective;
- noise sensitivity when irrelevant CV/JD/company context is intentionally injected;
- candidate safety: unsupported seniority/company/skill claims must remain zero-tolerance failures.

### Phase 3: Agent trajectory evaluation

Use the existing decision records and trajectory records to produce cases with expected action, allowed actions, required tool, validated args, expected observation class and terminal condition. Evaluate both strict order and flexible order depending on whether the stage is safety-critical.

Important Kiwi-specific metrics:

- `actionSelectionAccuracy`: selected action is valid for the state and expected strategy.
- `toolArgumentValidity`: only allowed source types, session IDs, topK/budget and target topic are used.
- `evidenceUseAccuracy`: question/report claims cite appropriate evidence source rather than only retrieving it.
- `interviewStateSafety`: repair turns do not count as interview questions; low-confidence voice input is confirmed, not silently scored.
- `latencyBudgetCompliance`: voice decision remains within the contract; no unbounded extra ReAct loop.

### Phase 4: Judge calibration and release gate

Build a small human-reviewed holdout set from anonymized / synthetic CV-JD-report cases. Compare judge result against reviewer labels by slice, inspect disagreements, then set thresholds. Do not use a generic threshold such as `faithfulness >= 0.8` without reviewing the hiring-risk category: unsupported skill/company claims should be blocking even if an average score is high.

## Sources read

| Source | What it substantiates |
| --- | --- |
| [Es et al., Ragas: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) | RAGAS is reference-free evaluation of retrieval relevance/focus, faithful use of context, and generation quality. |
| [Ragas metrics overview](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/) | Current Ragas covers RAG and agent/tool metrics. |
| [Ragas Context Precision](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/context_precision/) | Ranking-sensitive context precision and reference/response variants. |
| [Ragas Context Recall](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/context_recall/) | Claims from reference supported by retrieved contexts. |
| [Ragas Faithfulness](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/faithfulness/) | Claim-level response support from retrieved contexts. |
| [Ragas Noise Sensitivity](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/noise_sensitivity/) | Wrong answers caused by relevant/irrelevant retrieved content. |
| [Ragas agent/tool metrics](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/agents/) | Topic adherence, tool call accuracy/F1, and agent goal accuracy. |
| [Yao et al., ReAct](https://arxiv.org/abs/2210.03629) | Interleaved reasoning/action/observation and dynamic plan adjustment. |
| [ReAct reference implementation](https://github.com/ysymyth/ReAct) | Original prompt/code examples for knowledge QA and interactive environments. |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Stateful, durable agent orchestration with human oversight and traceability. |
| [Haystack FaithfulnessEvaluator](https://docs.haystack.deepset.ai/docs/faithfulnessevaluator) | Statement-level evaluator input/output and score interpretation. |
| [Haystack](https://github.com/deepset-ai/haystack) | Explicit pipeline boundaries for retrieval, routing, memory and generation. |
| [Phoenix](https://github.com/Arize-ai/phoenix) | Open-source trace, dataset, experiment and retrieval/response evaluation model. |
| [DeepEval](https://github.com/confident-ai/deepeval) | LLM app testing, custom criteria and tool correctness patterns. |

Evidence status: current Kiwi statements are based on inspected source and eval artifacts at the baseline SHA above; external project behavior is based on the linked official repositories, papers and documentation as read on 2026-07-10.
