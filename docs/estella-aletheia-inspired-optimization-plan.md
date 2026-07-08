# Estella Aletheia Report 對 Kiwi 的優化計畫

本文根據朋友的 PDF 報告 `COMPSCI703-AGI projects-final report-Estella Liu(1).pdf` 與 Kiwi 目前程式結構，整理哪些設計可以轉化成 Kiwi 的下一輪優化。這不是已實作說明，而是後續優化 roadmap。

## 來源與判讀邊界

朋友的報告描述 `Aletheia`：一個用於 NZ-US cross-border tax-contract compliance audit 的 compound AI system。核心設計包括 regulatory vector database、兩個 adversarial LLM auditors、Chain-of-Verification、human-in-the-loop adjudication、live FX API、deterministic evaluation suite、adversarial contracts、component ablation 與 backend-conditional safety nets。

這些設計跟 Kiwi 有高度相關性，因為 Kiwi 也有 CV/JD parsing、CV-JD matching、RAG retrieval、interview controller、report generation、report QA、voice confidence gate、agent trace、mock-safe tests 和 real provider evals。不過 Aletheia 是 legal compliance audit，Kiwi 是 interview practice product；不能直接照搬報告中的 latency/cost/accuracy 數字，只能借用 architecture pattern 與 evaluation discipline。

## 目前 Kiwi Baseline

| 區域 | 目前狀態 | 主要檔案 |
| --- | --- | --- |
| Agent orchestration | `runTask` 串接 retrieval、interviewer、reportGenerator、reportQa、interviewEvaluator；另有 JD/match critic agents | `backend/src/services/masterAiService.js`, `backend/src/services/agentRegistryService.js` |
| RAG | `weighted_hash_ngram_v2` deterministic 256 維 embedding、`document_chunks`、pgvector、keyword/metadata fusion、quality assessor、corrective retry | `backend/src/services/embeddingService.js`, `backend/src/services/ragRetrievalService.js`, `backend/src/services/retrieval/retrievalQualityAssessor.js` |
| Report grounding | 以 claim overlap、evidence labels、QA blocking flags 降低 unsupported feedback | `backend/src/services/report/claimGroundingService.js`, `backend/src/services/agents/reportQaAgent.js` |
| Voice | 有 transcript confidence gate、confirmation flow、turn counting contract、latency trace；產品目標是 `user speech end -> next question first audio <= 3 seconds` | `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`, `backend/src/services/voice/*`, `backend/src/services/aiControl/voiceAgentDecisionService.js` |
| Evaluation | 已有 robustness tests、mock eval、real provider eval、Google Agents CLI trace builders | `backend/tests/robustness/*`, `backend/eval/runners/*` |

## 優化總方向

優化重點不是「多加一個 agent」，而是把 Kiwi 從 demo-capable agent workflow 推到 evaluated compound AI system：

```text
current artifacts
-> retrieval with measurable evidence quality
-> role-specific evaluation / adversarial review
-> claim-level verification
-> transparent user or reviewer gate
-> trace + eval + cost accounting
```

優先順序應該是：

1. 先補 evaluation 和 observability，避免後面改 RAG/agent 時不知道是否真的變好。
2. 再升級 retrieval quality，因為 report、interview next-question、QA 都依賴 evidence。
3. 接著做 report-level Chain-of-Verification，這是低 latency 風險、最高可信度收益的地方。
4. 最後再把 dual/adversarial agent 放進 match/report/interview 的高價值節點；voice hot path 要非常保守。

## Optimization 1: 把 RAG 從 MVP Retrieval 升級成可評估的 Evidence Layer

### 優化哪裡

- `backend/src/services/embeddingService.js`
- `backend/src/services/ragRetrievalService.js`
- `backend/src/services/ragIndexService.js`
- `backend/src/services/retrieval/retrievalSourceSelector.js`
- `backend/src/services/retrieval/retrievalQualityAssessor.js`
- `backend/eval/runners/runRetrievalEval.js`
- `backend/eval/datasets/rag-grounding/retrieval-eval.json`

### 為什麼值得做

Aletheia 用 sentence embedding、MMR-diversified retrieval、chunk manifest 和 retrieval eval，把 RAG 視為可以單獨測量的 product subsystem。Kiwi 目前的 `weighted_hash_ngram_v2` 很適合 mock-safe、deterministic tests，但它不是 production-grade semantic retrieval。只要 retrieval 給錯 evidence，後面的 interviewer、report QA 和 claim grounding 都會被迫在錯誤材料上做判斷。

### 怎麼做

1. 新增 embedding provider interface：
   - `local_hash` 保留現有 `weighted_hash_ngram_v2`，作為 CI/mock-safe baseline。
   - `semantic_provider` 作為可選 provider，初期可用 HuggingFace/Sentence-BERT 或其他 approved provider。
   - schema 需要支援 provider、dimension、model version，避免 256 維和新 embedding 混在同一 index。

2. 增加 dual-index migration path：
   - 新 chunk 寫入時同時記錄 `embeddingModel`、`embeddingDimension`、`embeddingVersion`。
   - retrieval 時只查相容 dimension。
   - rollout 期間允許 `local_hash` 和 semantic provider 並存，eval 分開報告。

3. 加入 MMR reranking：
   - 先用 pgvector/fusion 取 `fetchK`，再用 MMR 或 source-diversity reranker 選 topK。
   - 目標是減少同一 CV/JD/report chunk 重複佔滿 evidence bundle。
   - 對 `sourceType`、`sourceId`、`topic` 做 diversity constraint，讓 report/interview 更容易看到互補 evidence。

4. 改善 indexing reproducibility：
   - 對 source artifact 建 manifest hash，未變更就跳過重建。
   - chunking 記錄 `sourceHash`、`chunkingStrategy`、`chunkOrdinal`。
   - 對 OCR/noisy upload 加低資訊 chunk 過濾，例如過短、符號密度過高、alpha ratio 過低。

5. 升級 retrieval eval：
   - 每個 case 至少標出 expected sourceTypes、must-hit keywords、forbidden sourceTypes。
   - 報告 `retrieval recall@k`、`source diversity`、`unsupported top1 rate`、`quality assessor retry rate`。

### 預期效果

- `reportQaAgent` 和 `claimGroundingService` 的 evidence label 更可信。
- interview next-question selection 更容易拿到相關 CV/JD/match gap evidence。
- retrieval eval 可以清楚比較 `local_hash` vs semantic provider，不再靠主觀感覺判斷 RAG 是否變好。
- 風險是 latency、成本和 schema migration 變複雜，所以必須保留 `local_hash` 作為 deterministic fallback。

## Optimization 2: 在 Report QA 加入 Claim-level Chain-of-Verification

### 優化哪裡

- `backend/src/services/agents/reportGeneratorAgent.js`
- `backend/src/services/agents/reportQaAgent.js`
- `backend/src/services/report/claimGroundingService.js`
- `backend/src/services/report/reportQaRepairOrchestratorService.js`
- `frontend/src/components/report/EvidenceSourcesSection.jsx`
- `frontend/src/components/report/EvidenceBadge.jsx`

### 為什麼值得做

Aletheia 的 CoVe 設計不是只讓 LLM 自我反省，而是把每個 citation 拆出來，重新問 verification question，再標成 `Verified`、`Needs Review`、`Source Not Found`。Kiwi 目前已經有 `evidenceLabel`、`confidenceLevel`、`feedbackStatus` 和 blocking QA flags，但主要是 overlap/heuristic grounding。下一步應該把 report 裡的重要 claims 顯式驗證，讓使用者知道哪些 feedback 是有證據、哪些只是需要確認。

### 怎麼做

1. 建立 claim extractor：
   - 從 `candidateFeedback.strengthHighlights`、`improvementPriorities`、`coachingAdvice`、`turnBreakdowns`、`summary` 抽出可驗證 claim。
   - 每個 claim 要有 `claimId`、`claimText`、`claimKind`、`expectedEvidenceSource`。

2. 建立 verification retrieval pass：
   - 對每個 claim 生成或 deterministic build 一個 `verificationQuery`。
   - 用 retrieval service 重新取 evidence。
   - label 成 `verified`、`needs_review`、`source_not_found`。
   - 初期先 deterministic，不必一開始加 LLM verification question generation。

3. 把 verification label 接回 report QA：
   - `verified` 可以保留高 confidence。
   - `needs_review` 要降級為 `needs_user_confirmation` 或 `downgraded_feedback`。
   - `source_not_found` 不能出現在高 confidence recommendation。

4. UI 顯示：
   - `EvidenceBadge` 顯示 `Verified`、`Needs Review`、`Source Not Found`。
   - report section 不要宣稱「完全準確」，只呈現 evidence status。

### 預期效果

- 減少 unsupported high-confidence feedback。
- report 更適合後續優化，因為每個 claim 都能回溯到 evidence query 和 source chunk。
- 可能出現 Aletheia 同樣的 trade-off：coverage 下降但 reliability 上升。這是可接受的，但要用 eval 明確量化。

## Optimization 3: 把 Dual / Adversarial Agent 放在 Match 和 Report，不放進 Voice Hot Path

### 優化哪裡

- `backend/src/services/match/matchCriticAgent.js`
- `backend/src/services/match/guardedMatchService.js`
- `backend/src/services/agents/reportQaAgent.js`
- `backend/src/services/report/reportQaRepairOrchestratorService.js`
- `backend/src/services/aiControl/interviewEvaluatorService.js`

### 為什麼值得做

Aletheia 的 `Risk Hunter` 與 `Compliance Maven` 用相反視角找問題：一個找違規，一個找缺失。這個 pattern 對 Kiwi 最適合的地方不是 live voice，而是 asynchronous 或 user-wait-tolerant 的節點：CV-JD match、report QA、final coaching。這些地方允許多一次模型/heuristic pass，收益是能抓到「正面 fit 被高估」與「關鍵 gap 被漏掉」。

### 怎麼做

1. Match 端拆兩個 reviewer：
   - `fitEvidenceReviewer`: 檢查高分項是否真的有 CV/JD evidence。
   - `gapRiskReviewer`: 檢查低覆蓋 requirement、transition risk、unsupported skill claim。
   - 合併結果交給 `guardedMatchService` 做 final decision。

2. Report 端拆兩個 reviewer：
   - `positiveFeedbackVerifier`: 確認 strengths/coaching claims 有 transcript/CV/JD support。
   - `riskAndOmissionReviewer`: 找 report 是否漏掉 repetition、ASR risk、question-count mismatch、unsupported recommendation。

3. Agent disagreement metric：
   - 記錄兩個 reviewer 的 claim/source set。
   - 用 Jaccard distance 或 overlap ratio 衡量它們是否真的互補。
   - 如果兩個 reviewer 永遠給一樣結果，dual-agent 就沒有必要。

4. Feature flag rollout：
   - 用 `ENABLE_DUAL_REPORT_QA`、`ENABLE_DUAL_MATCH_REVIEW` 控制。
   - 初期 eval-only，不直接影響 user report。

### 預期效果

- 更容易抓到 match/report 的 omission，不只是修正錯誤格式。
- 能回答「多 agent 到底有沒有用」；如果沒有用，eval 會顯示 disagreement/coverage 沒改善。
- 成本和 latency 會上升，所以不應預設開在 voice next-question path。

## Optimization 4: HITL Gate 從 Input Review 擴展到 High-risk Output Review

### 優化哪裡

- `frontend/src/pages/AnalyzePage.jsx`
- `frontend/src/components/report/*`
- `backend/src/services/jobDescription/guardedJobDescriptionService.js`
- `backend/src/services/match/guardedMatchService.js`
- `backend/src/services/report/reportQaRepairOrchestratorService.js`

### 為什麼值得做

Kiwi 已經有 CV/JD human review gates，這是很好的 foundation。Aletheia 進一步讓 reviewer 在兩個 junior auditors 之間做 `BOTH`、`ONLY_A`、`ONLY_B` adjudication。Kiwi 不一定需要照做三個按鈕，但可以把同樣思想用在 high-risk outputs：當 match critic/report QA/claim verification 顯示不確定時，不要把結果包裝成確定結論。

### 怎麼做

1. Match result 增加 review-needed state：
   - 如果 `guardedMatchService` 發現 evidence conflict 或 key requirement unsupported，UI 顯示「需要確認的 match gap」。
   - 讓使用者修正 CV/JD extraction 或確認 experience evidence。

2. Report 增加 confirmation surface：
   - 對 `Needs Review` 或 `Source Not Found` 的 coaching claim，顯示 evidence caveat。
   - 提供「這不準確」或「我可以補充」的 feedback hook，未來可回寫 profile/interview memory。

3. Voice transcript confirmation 保持現有 contract：
   - contentful low-confidence transcript 仍走 understanding confirmation。
   - 不把 confirmation turn 計入 interview question count。

### 預期效果

- 使用者更容易理解 AI 結論哪裡可靠、哪裡需要人補證據。
- 減少 report 以高 confidence 輸出薄弱 coaching 的風險。
- 會增加 UI 狀態，需要避免把 report 變得過度複雜。

## Optimization 5: Prompt Injection Hardening 要變成 Per-stage Contract

### 優化哪裡

- `backend/src/services/agenticSafeguards/deepseekJsonClient.js`
- `backend/src/services/jobDescription/*`
- `backend/src/services/match/*`
- `backend/src/services/agents/*`
- `backend/src/services/report/*`
- `backend/tests/robustness/report/promptInjectionReportRobustness.test.js`

### 為什麼值得做

Aletheia 的限制章節指出：multi-call pipeline 會擴大 injection payload 被模型看到的次數。這對 Kiwi 很重要，因為 CV、JD、transcript、uploaded documents、report feedback 都可能包含 untrusted text。如果後續加 CoVe 或 dual agents，call count 會增加，安全邊界也要跟著加。

### 怎麼做

1. 統一 prompt wrapper：
   - 明確分隔 `TRUSTED SYSTEM CONTEXT`、`TRUSTED RETRIEVAL EVIDENCE`、`UNTRUSTED USER CONTENT`。
   - 要求模型把 user content 中的 meta-instruction 視為被分析文本，而不是指令。

2. Schema-constrained output：
   - report、JD parse、match review、verification labels 優先使用 JSON schema validation。
   - 解析失敗時不要默默使用 raw text；走 repair 或 fallback。

3. Per-stage injection tests：
   - CV prompt injection。
   - JD prompt injection。
   - transcript prompt injection。
   - report source quote 中含 forbidden phrase。
   - RAG retrieved chunk 中含 meta-instruction。

4. Metric 不只做 substring fail：
   - Aletheia 遇到 quote injection text 被 strict forbidden substring 誤判的問題。
   - Kiwi eval 應區分「模型遵循 injection」和「模型引用 injection 作為風險證據」。

### 預期效果

- 降低後續 multi-agent / CoVe 架構引入的新 attack surface。
- prompt injection regressions 可以在 mock-safe robustness tests 中先被抓到。
- 不保證完全防 prompt injection；只能提高防線和可觀測性。

## Optimization 6: 建立 Kiwi 專用的 12-case Adversarial Eval Suite

### 優化哪裡

- `backend/eval/datasets/*`
- `backend/eval/runners/runRetrievalEval.js`
- `backend/eval/runners/runCvJdMatchEval.js`
- `backend/eval/runners/runReportQaEval.js`
- `backend/eval/runners/runInterviewControllerEval.js`
- `backend/eval/runners/runVoiceRobustnessEval.js`
- `backend/tests/robustness/*`

### 為什麼值得做

Aletheia 的強項不是只有架構，而是它用 12 個 synthetic contracts、4 個 adversarial cases、baseline vs verified pipeline、component ablation 來檢查架構是否真的有效。Kiwi 目前 tests 很多，但要做下一輪架構優化，需要一個跨 feature 的固定 eval set，讓每次 RAG/agent/report 改動都能比較。

### 建議 12-case set

| ID | 類型 | Kiwi 版本 |
| --- | --- | --- |
| KC-001 | Clear fit | CV/JD 明確匹配，report 應給高 confidence strength |
| KC-002 | Missing evidence | JD 要求 skill，但 CV 無證據，match/report 不應硬說會 |
| KC-003 | Career transition | CV 有 adjacent evidence，應給 medium confidence 和補強建議 |
| KC-004 | Conflicting facts | CV/JD 或 transcript 有互相矛盾資訊 |
| KC-005 | Brief input | 極短 CV/JD 或極短回答，應要求補充或降 confidence |
| KC-006 | Noisy JD | marketing-heavy JD，不應抽太多 fake hard requirements |
| KC-007 | Repetition risk | interview 不應重複問同一 assessment-equivalent question |
| KC-008 | Report grounding | report claims 必須能回到 transcript/CV/JD evidence |
| KC-009 | OCR garbage | upload text 幾乎不可讀，parser/RAG/report 要保守失敗 |
| KC-010 | Prompt injection | CV/JD/transcript 內含 `ignore previous instructions` |
| KC-011 | Excessive length | 關鍵 evidence 在長文本尾端，retrieval 不應只看前段 |
| KC-012 | Voice uncertainty | contentful low-confidence transcript 必須走 confirmation，不得直接評分 |

### Metrics

- `Success Rate`: pipeline 是否完成。
- `Coverage Rate`: planted expected signals 有多少被抓到。
- `Unsupported Claim Rate`: high-confidence claims 中無 evidence 的比例。
- `Retrieval Recall@k`: expected evidence 是否出現在 topK。
- `Adversarial Pass Rate`: injection/OCR/conflict/long-tail 是否通過。
- `Latency`: text flow、report flow、voice hot path 分開量。
- `Cost`: LLM、embedding、speech 分開估。
- `Agent Disagreement`: dual reviewer 是否提供互補 evidence。
- `Wilson 95% CI`: adversarial cases 數量小時，不只報 point estimate。

### Ablation plan

| Cell | 配置 | 目的 |
| --- | --- | --- |
| M1 | current baseline | 現況 |
| M2 | retrieval upgrade only | 隔離 semantic/MMR 效果 |
| M3 | CoVe only | 隔離 claim verification 效果 |
| M4 | dual reviewer only | 隔離 adversarial review 效果 |
| M5 | retrieval + CoVe + dual reviewer | full compound system |

### 預期效果

- 每個 architecture change 都能回答「是 retrieval 變好、verification 變好、還是 reviewer 變好」。
- real AI eval 需要 credentials 和成本批准；mock eval 先確保 regression safety。
- 可以作為之後優化 project 的客觀基線。

## Optimization 7: Voice 優化只借用 Parallelism，不借用 Heavy Multi-agent Hot Path

### 優化哪裡

- `backend/src/services/voice/duplexVoiceAgentService.js`
- `backend/src/services/voice/duplexTurnCoordinator.js`
- `backend/src/services/aiControl/voiceAgentDecisionService.js`
- `backend/src/services/aiControl/questionRanker.js`
- `backend/src/services/latency/voiceLatencySummaryService.js`
- `frontend/src/hooks/voice/*`

### 為什麼值得做

Aletheia 的 parallel fan-out 帶來 latency 改善，但它的任務是 contract audit，不是 live conversation。Kiwi voice 的 user-facing target 是 `user speech end -> next question first audio <= 3 seconds`，所以不能把 dual agents 或 CoVe 塞進下一題生成前的 hot path。

### 怎麼做

1. Hot path 只做必要決策：
   - confidence gate。
   - save answer。
   - evaluator/action planner。
   - question ranker。
   - first sentence TTS。

2. Parallel precompute：
   - 在 user speaking 或 waiting state 預先準備可能的 next question candidates。
   - retrieval warm context 可以提前做，但最終 selection 要用 accepted answer。

3. Slow verification 非同步：
   - report CoVe、claim verification、deep QA 放到 report generation 或 background analysis。
   - 不阻塞下一題 first audio。

4. Trace 每個 latency mark：
   - 繼續追 `speech_end_received`、`confidence_gate_done`、`question_ranked`、`tts_first_audio`。
   - 新增任何 multi-step 後都要能拆出慢點。

### 預期效果

- voice 保持產品契約，同時為 report 和 post-session analysis 提供更可信 evidence。
- 不會因為追求 multi-agent 架構而破壞 live interviewer feel。
- 如果要在 voice 加任何 extra call，必須先用 `voiceLatencyAcceptanceGate` 類測試證明不破 3 秒目標。

## Optimization 8: 統一 Cost、Token、Trace Instrumentation

### 優化哪裡

- `backend/src/services/aiControl/agentTraceService.js`
- `backend/src/services/report/reportScoreService.js`
- `backend/tests/robustness/report/costAccountingRobustness.test.js`
- `backend/eval/runners/*`

### 為什麼值得做

Aletheia 把 token accounting 放在單一 LLM call chokepoint，讓 cost-benefit 和 ablation 有可比性。Kiwi 後續如果加 semantic embeddings、CoVe、dual reviewers，就需要知道品質提升是否值得成本。

### 怎麼做

1. 定義 unified execution cost schema：
   - `llmInputTokens`
   - `llmOutputTokens`
   - `embeddingTokens` 或 embedding request count
   - `speechSeconds`
   - `provider`
   - `taskType`
   - `stageName`

2. 每個 eval report 都輸出：
   - average cost。
   - p50/p95 latency。
   - model/provider split。
   - quality metric delta。

3. report UI 不必顯示成本，但 internal trace 要能追。

### 預期效果

- 避免「品質變好但成本暴增」或「成本變高但指標沒動」。
- 幫助選擇哪些 compound steps 應該 default on，哪些只適合 eval/paid tier。

## Optimization 9: Graph-like Orchestration 與 Trace Export，不必直接搬 LangGraph

### 優化哪裡

- `backend/src/services/masterAiService.js`
- `backend/src/services/aiControl/agentTraceService.js`
- `backend/eval/runners/buildGoogleAgentsCli*Trace.js`
- `repo-docs/flows.md`（只有在實作後更新 current-state guide）

### 為什麼值得做

Aletheia 用 LangGraph 把 pre-HITL、post-HITL、parallel workers 和 CoVe loop 明確化。Kiwi 是 Node/Express codebase，不需要為了像報告一樣而改用 LangGraph；但可以把 orchestration 變成更明確的 graph-like trace。

### 怎麼做

1. 定義 canonical stage names：
   - `artifact_indexing`
   - `retrieval`
   - `evaluation`
   - `action_selection`
   - `question_ranking`
   - `generation`
   - `verification`
   - `qa_repair`
   - `persistence`

2. Trace export：
   - 每次 eval 可輸出 Mermaid 或 JSON trace。
   - 對 failure case 能看到哪一 stage 造成 degraded output。

3. Graph contract tests：
   - 確認某些 task 必須包含 retrieval/verification/QA。
   - voice hot path 不應包含 slow report verification stage。

### 預期效果

- 之後讀 code 不必靠腦補流程。
- eval failure 可以定位到 retrieval、LLM、QA、schema validation 或 persistence。

## Optimization 10: Data Retention 與 RAG Index Freshness 要連在一起

### 優化哪裡

- `backend/src/services/ragIndexService.js`
- `backend/src/services/storageService.js`
- `backend/src/services/cv/cvLifecycleService.js`
- `backend/src/services/recording/*`
- `backend/src/services/retention/*`

### 為什麼值得做

Aletheia 用 SHA-256 manifest 讓 ingest 可重跑、可跳過未變更檔案。Kiwi 已經有 retention pipeline 和 recording idempotency，但 RAG index 也應該明確處理 stale chunks、deleted artifacts、re-index version。

### 怎麼做

1. 每個 indexed artifact 記錄：
   - `artifactType`
   - `artifactId`
   - `sourceHash`
   - `chunkingStrategy`
   - `embeddingModel`
   - `retentionPolicyVersion`

2. artifact 更新時：
   - delete or supersede old chunks。
   - insert new chunks with version。
   - eval/trace 記錄使用哪個 version。

3. retention cleanup 時：
   - 確認 artifact 和 `document_chunks` 一起清理。
   - 加 test 覆蓋 deleted CV/JD/report 不再被 RAG retrieved。

### 預期效果

- 避免使用者刪除或更新 CV/JD 後，舊 evidence 還被 report/interview 用到。
- 隱私聲明可以更保守但更可信。

## 不建議直接做的事

| 不建議 | 原因 |
| --- | --- |
| 直接把 LangGraph 搬進 Node backend | 會引入大架構遷移，收益不一定比明確 stage trace 高 |
| 把 dual agents 放進 voice next-question hot path | 容易破壞 3 秒 first-audio target |
| 用朋友報告的成本/速度數字當 Kiwi 預期 | domain、model、input、provider 都不同 |
| 直接替換 `weighted_hash_ngram_v2` | 它是 mock-safe deterministic tests 的基線，應保留 fallback |
| 把 CoVe label 當成絕對真相 | CoVe 會降低 hallucination risk，但也可能錯過正確 evidence |

## 建議實作順序

### Phase 0: Evaluation-first baseline

- 建 `KC-001` 到 `KC-012` eval dataset。
- 把現有 pipeline 跑成 baseline report。
- 加 metrics：coverage、unsupported claim、retrieval recall、adversarial pass、latency、cost。
- 不跑 real AI eval，除非 credentials 和成本已批准。

### Phase 1: Prompt injection 和 trace hardening

- 統一 prompt wrapper。
- 擴充 injection robustness tests 到 CV/JD/match/interview/report/RAG retrieved chunk。
- 增加 canonical stage trace。

### Phase 2: RAG provider + MMR

- 新增 embedding provider interface。
- 支援 dual-index migration。
- 加 MMR/source diversity rerank。
- 用 `eval:retrieval` 比較 baseline。

### Phase 3: Report CoVe

- 建 claim extractor。
- 建 verification retrieval pass。
- 接入 `reportQaAgent` blocking/downgrade logic。
- UI 顯示 trust badge。

### Phase 4: Dual reviewer eval-only rollout

- Match 和 report 各拆兩個 reviewer。
- 記錄 disagreement metric。
- 跑 ablation：baseline、retrieval only、CoVe only、dual only、full。

### Phase 5: Product rollout

- 只把被 eval 證明有收益的 steps 開給 user-facing flow。
- voice 只採用 precompute/parallel retrieval，不加入 slow CoVe/dual review hot path。
- 更新 `repo-docs/` current-state guide，避免文件和 code drift。

## 驗證與測試計畫

| 改動 | 最小測試 |
| --- | --- |
| RAG provider/MMR | `cd backend && npm run test:retrieval`, `npm run eval:retrieval` |
| Report CoVe | `cd backend && npm run test:report`, `npm run eval:report`（real provider 需批准） |
| Dual match reviewer | `cd backend && npm run test:match`, `npm run eval:match`（real provider 需批准） |
| Prompt injection hardening | `cd backend && npm run test:jd`, `npm run test:match`, `npm run test:report` |
| Voice precompute/latency | `cd backend && npm run test:voice`, voice latency acceptance gate |
| UI trust labels | `cd frontend && npm run test:all`, relevant component tests |

## 文獻與支撐

- Compound AI systems: Berkeley BAIR 的文章指出高品質 AI app 越來越依靠多 component system，而不是單一模型；這支持 Kiwi 把 retrieval、verification、trace、guards 拆成可測量 subsystem。https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/
- Retrieval-Augmented Generation: Lewis et al. 提出 RAG，把 parametric model 與 non-parametric memory 結合，支撐 Kiwi 持續投資 evidence retrieval。https://arxiv.org/abs/2005.11401
- Chain-of-Verification: Dhuliawala et al. 的 CoVe 方法用 verification questions 降低 hallucination，支撐 report claim verification。https://arxiv.org/abs/2309.11495
- MMR reranking: Carbonell and Goldstein 的 MMR 用 diversity-based reranking 減少冗餘 retrieval，支撐 Kiwi source diversity rerank。https://dl.acm.org/doi/10.1145/290941.291025
- Multi-agent debate: Du et al. 顯示多 agent debate 可改善 reasoning/factuality，支撐 dual reviewer 但仍需 Kiwi 自己的 ablation。https://arxiv.org/abs/2305.14325
- RAG evaluation: RAGAS 強調 RAG 需要分開評估 retrieval、faithfulness、answer quality，支撐 Kiwi 建固定 retrieval/report eval metrics。https://arxiv.org/abs/2309.15217
- Indirect prompt injection: Greshake et al. 指出 LLM-integrated apps 會混淆 data 與 instructions，支撐對 CV/JD/transcript/RAG chunk 做 untrusted-content boundary。https://arxiv.org/abs/2302.12173
- Prompt injection benchmark: Liu et al. 提供 prompt injection 攻防 benchmark 思路，支撐 Kiwi adversarial eval cases。https://arxiv.org/abs/2310.12815
- Human-AI interaction: Amershi et al. 的 Human-AI interaction guidelines 支持在不確定時顯示狀態、讓人介入修正，而不是把 AI 結論包裝成確定事實。https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/

## repo-docs 同步決策

本文件是 future optimization plan，不是 current implementation guide。因此本次不更新 `repo-docs/`。等任一 phase 實作後，才需要同步更新 `repo-docs/modules/rag-retrieval.md`、`repo-docs/modules/feature-report-and-qa.md`、`repo-docs/modules/testing-and-evaluation.md`、相關 agent pages 與 `repo-docs/change-log.md`。
