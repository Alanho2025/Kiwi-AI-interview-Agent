# Role-Fit Closed Loop v2 Implementation Narrative

狀態：final implementation narrative；3 秒 voice SLO 仍是 known issue  
日期：2026-07-11 NZST  
關聯文件：[goal](2026-07-11-role-fit-v2-goal.md)、[spec](2026-07-11-role-fit-v2-spec.md)、[trace](2026-07-11-role-fit-v2-implementation-trace.md)

## 從原產品到 Role-Fit

原本的 Kiwi 已經不是單純 chatbot：它能讓使用者上傳 CV、貼 JD、做人審、跑 CV-JD match、生成 prepared questions、完成 text/voice interview，最後產出 evidence-grounded report 和 QA。問題是這條鏈主要回答「requirements 有沒有對上」；它還不能完整回答使用者真正需要的 Role-Fit 問題：

1. 這家公司為什麼可能需要這個 role？
2. 面試官想降低什麼 hiring risk？
3. 候選人的哪段真實經驗能從什麼角度證明 fit？
4. 每個回答是否真的對準該題的 role intent？

V2 沒有另開第二套 Role-Fit app，也沒有新增永久 feature mode。實作選擇是原地升級現有 preparation -> match -> question -> interview -> report 主鏈，讓新資料自然流過既有 API、storage、QA、RAG、voice 和 report export。

## 實作分塊

### 1. Trust contract hardening

先把信任語意補對。`sourceConfidence` 和 `reviewConfidence` 被拆開，使用者確認只提升 review confidence，不會把 website/JD/manual context 的 source trust 冒充成外部事實。缺少 company context 時，JD preparation 不再安靜產生 Role-Fit path；URL-only context 會標成 `supplied_url_only` / `url_supplied`。

這樣做是因為 Role-Fit 的後續推論很多，如果第一步把「使用者確認目前解讀」寫成「事實已被驗證」，後面的 match、question、report 會一起放大錯誤。

### 2. Company understanding grounding

Website support 被做成 bounded evidence capture，而不是 crawler 或 external search。系統只抓 public HTTP(S) URL、manual redirect、不跨 host、限制 content type/size/timeout，只保存 snippets，不保存 full HTML。Manual company context 明確否定 website snippet 的 domain term 時，輸出 conflict diagnostics。

實際和原 plan 的差異是：沒有把 company research 擴成搜尋型產品。這是刻意收斂，因為本 repo 沒有外部 search provider、也沒有 retention policy 去承接 full-page/company research corpus。

### 3. Hiring logic decoder

Role intent 從 requirements list 升級成 deterministic `company_understanding_v2` 和 `role_intent_decoder_v2`。新增 business model、users/products、operating context、hiring context hypotheses、role purpose、business problem hypotheses、workflow pain points、ideal candidate signals、interview probe map 和 uncertainties。

這裡先用 deterministic builder，不用新的 LLM critic。原因是 V2 要先穩住可測 contract：每個 hypothesis 都要有 source/review confidence、claim status 和 compact diagnostics；等 contract 穩定後再接更重的 model 才不會把不可控輸出放進核心 product gate。

### 4. Candidate evidence and Role Evidence Map

CV evidence 被升級為 Candidate Evidence Graph v2，保留 stable evidence ID、private source trace、proof angles、strength signals、how-to-say-it、avoid-using guidance 和 fit limits。Match 層的 Role Evidence Map v2 再把 role intent 和 candidate evidence 接成 direct、adjacent、weak 或 gap，並記錄 hiring-logic links。

這一步把 match 從「分數與摘要」改成「可追溯的證明策略」。後續 question ranking 和 report alignment 都讀同一份 map，避免每層各自重新猜 candidate fit。

### 5. Proof Strategy and no-hint interview

Proof Strategy 被放在 preparation UX，而不是 live interview。使用者在開始前看到 focus、best evidence angle、risk 和 gap；active session payload sanitizer 會移除 `preparationGuidance`、`evidenceGuidance`、`hiringLogicCoverage` 等 private guidance，live question 只保留可提問的 metadata。

這個取捨是產品層面的：Role-Fit 要教使用者準備，但 live interview 不應在答題時提示「請用哪個例子」，否則練習會變成照稿。

### 6. Question ranking metadata

Question rank trace 新增 proof-angle fit、hiring-logic link、unmet coverage、gap risk 和 overuse signals。Voice/text runtime 使用 precomputed metadata，不在 turn-time 做 website fetch、unbounded retrieval loop 或新的 heavy role-intent LLM decode。

這是為 voice latency 留邊界。Role-Fit 可以提升問題選擇，但不能把重型 reasoning 塞進每個 voice turn 的 hot path。

### 7. Answer Alignment report

Report 層升級成 Answer Alignment v2，只對 accepted/countable answers 產生逐題 feedback。每題有 six-dimension score：question alignment、evidence fit、evidence clarity、role intent fit、naturalness、concision，並記錄 evidence-use diagnosis 和 better spoken answer plan。Report QA 新增 missing dimensions、out-of-range score、wrong evidence use、unsupported company claim、missing evidence ID、must-cover omission 等 blocking flags。

這樣做是為了讓 report 不只說「你表現不錯」，而是能指出：這題想測什麼、你是否回答到題、例子是否選對、缺什麼 proof、下次怎麼更自然地講。

### 8. Evaluation and release gates

V2 補了 12-case adversarial dataset，覆蓋 prompt injection、fake/manual conflict、SSRF/URL-only grounding、CV skill-only overclaim、wrong example answer、live hint leakage、repair turn counting、missing alignment dimensions等風險。Manual calibration dataset 也完成 12/12 review，threshold decision 為 0.85。

最後新增 release gate 聚合：

- human calibration：12/12 reviewed，threshold 0.85
- adversarial gate：12-case dataset checks passed，production claim allowed
- cutover/retention contract：Role-Fit-bearing runtime docs 走 private retention contract，新 question default v3，legacy reviewed-JD entrypoint 已移除
- browser visual：Role-Fit report desktop/mobile screenshots 和 UI assertions
- voice flow：real-backend voice browser flow with test STT/TTS providers

目前 release gate 是 `ready_with_known_issues`。已知問題是 real-backend voice next-question first audio latest artifact 約 4415ms，超過 3 秒產品目標。這不是本輪 blocker，但必須保留為下一輪 voice latency work。

### 9. Cutover and retention boundary

新流量已 cut over 到 Role Evidence Map、question v3、report v7 和 private retention registry。沒有保留 legacy reviewed-JD 新 match 入口，也沒有永久 dual-flow mode。Production 14-day telemetry / migration proof 不在本地 repo 內，所以文件只聲稱 local cutover/retention contract passed，不聲稱已完成 production telemetry。

## 與原 plan 不同的地方

- 沒有建立第二套 Role-Fit route/app。實作改成原地升級，降低雙軌資料不一致風險。
- 沒有引入 external search 或 full website crawler。只做 bounded same-origin snippets，因為 retention、安全與 provider contract 尚未準備。
- 沒有把 RoleIntentDecoder 做成新的 live LLM hot path。先用 deterministic fields 和 diagnostics，保護 voice latency 與可測性。
- Browser visual gate 補的是 Role-Fit report UI 截圖；不是把 component tests 冒充視覺驗收。
- Voice flow 有跑 real-backend E2E，但 3 秒 next-question SLO 沒達標，已進 release known issue。
- Production retention telemetry 仍是外部資料依賴；本輪完成的是 source/model/registry contract gate。

## Verification snapshot

本輪新增或重跑的代表證據：

- `cd backend && npm run test:contracts`
- `cd backend && npm run test:retrieval`
- `cd backend && npm run eval:calibration`
- `cd backend && npm run eval:role-fit-v2-adversarial`
- `cd frontend && npm run test:e2e:role-fit-visual`
- `cd frontend && npm run test:e2e:voice-smoke`
- `cd frontend && npm run test:e2e:voice-real-backend`
- `cd backend && npm run eval:role-fit-release-gate`

最新 release gate 輸出在 `backend/eval/reports/role-fit-release-gate.latest.json` 和 `.md`。狀態為 `ready_with_known_issues`，release blockers 為 none，known issue 為 `voice_next_question_3s_slo_exceeded`。

## Final interpretation

Role-Fit v2 現在已完整落到產品主鏈：準備階段建立 hiring logic 和 proof strategy，match 階段建立可追溯 evidence map，interview 階段用 metadata 選題但不提示答案，report 階段逐題評估 alignment，eval/release 階段用 adversarial、人審校準、browser、voice 和 cutover contract 聚合證據。

它仍不是 employer-side hiring decision system，也不宣稱 production semantic retrieval / real-provider voice SLO 已全面達標。它是 candidate-side Role-Fit interview coach 的 final local implementation，帶一個明確可追的 voice latency known issue。
