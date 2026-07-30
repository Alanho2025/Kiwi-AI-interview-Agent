# Match 与问题准备

match 层把 reviewed CV 和 reviewed JD 变成两类下游资产：可展示的 fit 分析，以及访谈控制器可以使用的问题材料。它不是只算一个分数。

## 读者应该先记住什么

`matchCV` 先核对 persisted role-fit review 的 owner、fingerprint、profile ID 和 version，再调用现有 CV-JD match service。Matcher 为每个 role intent 生成 grounded Role Evidence Map，按 `direct`、`adjacent`、`weak`、`gap` 分级；没有明确 CV source trace 的语义相似结果不能进入 direct/adjacent。新的 map 是 `role_evidence_map_v2`，会把 CV evidence 的 proof angle、how-to-say-it、avoid-using guidance 和 hiring-logic links 一起带下去，并保留 `role_evidence_map_v1` compatibility marker。结果写入 match analysis record 后，系统再尝试生成 JD question filter。RFV2-008 后，match、proof strategy、session view 和 report 还共享 `role_fit_diagnostics_v1` compact diagnostics；它只传 readiness、count、coverage、degraded reason 和 source limitation，不传 CV/JD/company 原文。2026-07-15 后，match API 还会为每次请求生成当次 `performanceTrace`，记录 role-fit gate、CV load、cache read/hit/miss、fresh compare、semantic evidence、critic/recompare、record persistence、JD filter 和 usage recording 等 step duration；trace 只存 sanitized metadata，不复制 CV/JD 原文，也不会写入 reusable match cache。`performanceTrace.steps` 保留原始时间序列，`stepSummary` 聚合同名 step，`slowestSteps` 按耗时排序，completed log 也会输出这些字段，便于直接从日志判断慢点。

2026-07-15 的 match output hygiene 修复后，JD section heading（例如 `Skills & Experience:`、`Roles & Responsibilities:`）会在 JD parser、RoleIntentDecoder、semantic evidence target 和 Role Evidence Map 四层被过滤，不能再被当成 role intent 或 requirement 评分。Requirement evidence 还会按最终 status 约束 strength：`met` 才能保留 `strong`，`partial` 最多 `partial`，`inferred` 最多 `weak`，`not_met` 必须是 `missing`；泛化的一词 overlap（例如只匹配到 `engineer`）不能显示成 strong proof。Analyze 前端也会对旧缓存结果做同样的 heading 防御过滤，并隐藏 scorer/debug 术语，PDF/print 下 action card 不再 sticky 覆盖 match 内容。

2026-07-23 的 JobSync 优化先落地为后端切片。所有 match 会先清理 HTML、统一空白和 bullet，并对过短、过长或疑似损坏的 CV/JD 返回 `TOO_SHORT`、`TOO_LONG` 或 `CORRUPTED`。当时还加入 provisional `settings.matchMode = fast` branch，以及 `atsKeywords`、`tailoringTips` 和 `matchMode` output。

2026-07-26 的实现把产品收敛为「一个完整 Match 直接服务 interview preparation」：runtime fast branch、专用 parser 和 ATS/tailoring output 已移除；legacy `settings.matchMode` 即使传入也不会改变 scorer。`POST /api/analyze/match/stream` 现在只观察同一条 canonical pipeline，输出 ordered candidate-safe SSE；Match record 持久化并完成 JD question filter boundary 后才发出 `match_completed`。前端随后单独请求 interview plan，plan preparing 或 failed 都不会隐藏已完成的 Match，plan-only retry 也不会重跑 Match。方向与实现边界见 [Match → Interview Preparation Goal](../../docs/jobsync-match-optimization-goal.md)、[Spec](../../docs/jobsync-match-optimization-spec.md) 和 [UI plan](../../docs/UI_match_plan.md)。

| JobSync 优化项 | 当前状态 | 边界 |
| --- | --- | --- |
| 输入清理与损坏防御 | 后端已接入 | focused tests 覆盖 HTML、空白、bullet、长度与连续特殊字元；未在本轮执行真实损坏 PDF 上传 |
| Fast Match | runtime branch 与专用 parser 已移除 | legacy `matchMode` 被忽略；没有 mode selector 或较弱 scorer |
| ATS keywords / tailoring tips | runtime output 已移除 | Analyze 不显示 ATS、CV rewrite 或 `Improve your CV for this role` |
| Current Match streaming | 已实现 canonical SSE route、safe stage reporter 和 frontend parser/reducer | 不串流 partial score；同一 service 仍负责 JSON compatibility route |
| Match → interview preparation UI | 已分离 Match / plan state，并提高 preparation priorities 层级 | 只显示 bounded focus、gap、题数、hint 和 risk；不暴露完整题库或 private artifacts |
| Match latency | 已移除重复 CV load，并把 secondary CV/JD reusable-cache warming 移出 response critical path | scorer、evidence judge、critic/recompare、canonical cache write、persistence 和 question filter 不跳过；尚无 real-provider 加速百分比 |

## 一个代表 case

```text
输入: cvId + rawJD/jdRubric + settings
动作: executeCanonicalMatch -> runCvJdMatchExecution -> createMatchAnalysisRecord -> buildJdQuestionFilter
输出: matchAnalysisId + source-linked evidenceRefs + roleEvidenceMap + performanceTrace + prepared question pool readiness
边界: 新 match 未带 owner-scoped persisted Role-Fit review 时直接阻挡；旧 `humanReviewStatus` client marker 不再能开启新 match
```

## 代码怎么追

| 机制 | 源码入口 | 下游影响 |
| --- | --- | --- |
| match API orchestration | [analyze controller](../../backend/src/controllers/analyzeController.js) 和 [canonical Match execution](../../backend/src/services/match/matchAnalysisExecutionService.js) | JSON/SSE 共用 Match、persistence、JD filter 和 trace boundary；plan 保持独立请求 |
| candidate-safe Match stream | [Match stream event service](../../backend/src/services/match/matchStreamEventService.js) 和 [frontend stream API](../../frontend/src/api/matchStreamApi.js) | 输出 ordered allowlisted stages 和单一 terminal event，不暴露内部 critic/provider 文案 |
| 详细 CV-JD 匹配与评分管道 | [CV-JD Matching & Scoring Pipeline](../../docs/cv-jd-matching-pipeline.md) | 包含详细數據加載、向量相似度與文字重疊比對、動態領域評分權重、置信度扣分公式、質量評測及 hrtime 高解析度時延追蹤 |
| CV-JD comparison | [CV analysis service](../../backend/src/services/cv/cvAnalysisService.js) 和 [match services](../../backend/src/services/match) | 产出 strengths、gaps、score、evidence |
| input guard 与 single-path cleanup | [文字处理工具](../../backend/src/utils/textProcessing.js)、[match service](../../backend/src/services/matchService.js) 和 [match result builder](../../backend/src/services/match/matchResultBuilder.js) | request-scoped input guard 保留；runtime fast/ATS/tailoring branch/output 已移除 |
| Match / plan frontend state | [Match analysis flow hook](../../frontend/src/hooks/useMatchAnalysisFlow.js) 和 [Analyze page](../../frontend/src/pages/AnalyzePage.jsx) | Match completed 后保留结果；plan preparing/failed/ready 单独转换，failed 只 retry plan |
| JD heading / candidate hygiene | [JD section heading guard](../../backend/src/services/jobDescription/jobDescriptionSectionHeadingGuard.js)、[semantic evidence service](../../backend/src/services/match/semanticEvidenceService.js) 和 [frontend match view model](../../frontend/src/utils/matchResultViewModel.js) | 防止 JD 标题进入 role intent、requirement、semantic target 或旧结果 UI |
| candidate evidence strategy | [CV evidence builder](../../backend/src/services/cv/cvEvidenceProfileBuilder.js) | 生成 `candidate_evidence_graph_v2`，保留 stable evidence ID、source trace、proof angles、strength signals 与使用限制 |
| grounded evidence 分级 | [Role Evidence Map service](../../backend/src/services/match/roleEvidenceMapService.js) | 使用 semantic relevance、requirement/intent fit、specificity、ownership 与 outcome signals 分级，并输出 `fitType`、`proofAngle`、`evidenceGuidance`、`hiringLogicLinks` |
| Role-Fit readiness diagnostics | [Role-Fit diagnostics service](../../backend/src/services/roleFit/roleFitDiagnosticsService.js) | 汇总 company context、role intent、evidence map、proof strategy 和 answer alignment 的状态；blocked match 也会带 degraded diagnostics |
| match persistence | [match analysis record service](../../backend/src/services/cv/matchAnalysisRecordService.js) | 让 interview plan 使用稳定 `matchAnalysisId` |
| match performance trace | [match performance trace service](../../backend/src/services/match/matchPerformanceTraceService.js) | 为当次 match 生成 `match_performance_trace_v1`，并由 `MatchAnalysisRecord.performanceTrace` 保存 `steps`、`stepSummary`、`slowestSteps`；completed log 也输出这些字段；cache 存 match artifact，不存当次 trace |
| JD filter | [JD question filter service](../../backend/src/services/questions/jdQuestionFilterService.js) | 把 JD priority 和 gap 变成问题选择信号 |
| pool composition | [question pool composer](../../backend/src/services/questions/questionPoolComposerService.js) | 组合 opening、role requirement、gap、behavioural、wrap-up 等问题 |
| pool readiness | [question pool preparation](../../backend/src/services/questions/questionPoolPreparationService.js) | 去重、生成 reserves、标记 degraded readiness |

## Phase 3 当前行为

### 2026-07-29 Voice question intelligence（CP1/CP2 已批准并激活）

Voice preparation 现在有一个独立的、版本化 `QuestionCatalogItem` 边界。`2026.1` seed 覆盖行为、动机、AI 和 ML question families，保存 minimal research URL、role/level eligibility、expected signals、`not eligible` counterexample 和 lifecycle；AI-delivery alias 也带 version、lifecycle、review date 与 source metadata。它不保存 CV/JD/transcript、user/session ID、report 或 raw model reasoning。所有新 seed 都是 `draft`：activation 同时要求 CP1 content governance manifest 与 CP2 executable-policy manifest 通过，同一 reviewer 的版本、完整 ID/scenario set、日期、理由和 digest 都必须匹配。CP1 digest 覆盖 question items、AI-delivery taxonomy 与 ML aliases；CP2 digest 覆盖 role/level/count matrix、AI/ML coverage 和 follow-up-vs-root outputs。两份完整 human-review Markdown 均由 source/runtime policy 自动生成，并由 byte-for-byte drift test 约束。环境 reviewer 名称本身不能激活内容。通过后，内容才会在**新 Voice session** preparation 时复制为 private `InterviewQuestionPoolItem` snapshot。Text session 不读取 catalog；Mongo/catalog 不可用时 preparation 保留旧 pool，并标记 `catalog_unavailable`，不会阻塞 Voice next-turn hot path。

Snapshot 会保留 catalog ID、version、target level、eligibility reason、selection policy、coverage slot 和 report dimensions。CP3 还只复制 candidate-safe 的 `ambiguityMode`、`clarificationContextVersion` 和 `clarificationContext.responseText`，不会复制内部 scope options 或 raw policy。每个 catalog family 有 stored Junior／Intermediate／Senior wording；不支援某个 level 的 item 仍由 `targetLevels` hard gate 排除。ranker 在分数比较前排除非 `approved` snapshot，并在只剩关键题数时保护 AI/ML coverage reservation；non-tech AI judgement 还要求明确 AI 或 digital-work signal。follow-up 与 next root 使用同一尺度比较，`next_root` decision 会真的切换 lane，不再只在 reservation urgent 时生效。Voice 完成时，未满足的 required coverage 会写入 redacted developer trace；candidate result 只收到 status 与 counts。

Career-transition 与 NZ study/work family 只会从 CV 的明确 summary、experience、education 或 project 叙述导出私有 eligibility signal，不能从姓名、地址、国籍或模型猜测推断，且不会把原文带入 catalog/snapshot metadata。`Senior` 是新 UI/payload 和 backend 的 canonical value，legacy `Advanced` 可读并映射为 `Senior`。Product Owner 已以 `heminghan` 核准 CP1/CP2；staging Mongo database `test` 已 seed 并激活 `2026.1`，唯读复核为 21 个 unique IDs、21 个 `approved` lifecycle 和 21 个相同 reviewer。Database activation 本身不代表 deployed runtime；只有部署含本实现的 SHA 后，新 Voice session 才会读取这些内容。report dimension 的 candidate coaching 属于后续 CP4，而非本切片。

CP3 的 local controller contract 已实现，但已核准的 `2026.1` 仍全部是 `ambiguityPolicy.mode=none`，也没有可执行的 versioned clarification context。系统因此保持 fail closed；真实 scope response 必须来自另行 review 的新 catalog version，不能静默修改现有 approved digest。

2026-07-10 的 Phase 3 checkpoint 已完成 proof strategy、role-fit question metadata、must-cover reconciliation、coverage/gap ranking 和 evidence overuse penalty。2026-07-11 的 V2-4 slice 又把 Role Evidence Map v2 的 proof angle、evidence guidance 和 hiring-logic links 接到 proof strategy、question item、rank trace 和 Analyze preparation summary。新 question item explicit write 与 model default 都是 v3；pre-cutover 的 v2/无版本 snapshot 仍通过 bounded reader 完成旧 session。新 match/result/RAG/report 主路徑優先使用 `roleEvidenceMap`，不再把 legacy match evidence summary 當第二份資料來源。

Role Evidence Map 可以只有部分 role intent；当高优先 intent 没有对应 map row 时，`buildInterviewProofStrategy` 建立没有 evidence 的 `role_intent` coverage，让后续 question-pool fallback 继续补题，而不是让已经保存的 Match 无法创建 interview plan。这个边界由 `backend/tests/robustness/questions/roleSpecificPracticePlanner.test.js` 的缺行回归测试覆盖。

Gap 可以继续作为内部选题依据，但不会再被朗读成 `I want to validate one possible gap around ...`。Composer 产生自然的候选人问题，micro-planner 在 model success/fallback 两条路都检查 assessor/rubric preamble；完整 gap summary 只保留在 private metadata，供选择与诊断使用。

| 验收项 | 当前状态 | 主要边界 |
| --- | --- | --- |
| 每个 must-cover 有问题或显式降级 | 已通过 | `roleFitQuestionCoverageService` 检查实际 pool；缺题时建立 bounded deterministic v3 fallback，仍无法表示时标记 degraded |
| v2/v3 session 并行 | 已通过 | 新 item 写 v3；v2/无版本 snapshot 由现有 validator/preparation defaults 读取，targeted compatibility tests 已覆盖 |
| live payload 不含 evidence hints | 已通过 | HTTP、SSE 与 WebSocket 使用 allowlisted session/turn view；proof/evidence/rank/ReAct private fields 不进入 client payload |
| preparation guidance 与 rank trace | 已通过 first slice | Analyze summary 只显示 focus、hint 和 risk；rank trace 保留 proof-angle / hiring-logic adjustment；active session sanitizer 移除 private preparation fields |
| compact diagnostics propagation | 已通过 | match result、blocked result、proof strategy、session analysis/setup 和 report 都带 `role_fit_diagnostics_v1`；session sanitizer 只保留 compact diagnostics |
| CP1/CP2 activation integrity | 已批准并完成 staging activation | 两个 manifest 都为 `approved` 且 reviewer/version/digest/完整集合一致；Mongo `test` 的 `2026.1` 为 21/21 approved，CP1 digest `374784f7…a08de`、CP2 digest `36311aef…d8116` |
| CP2 AI/ML coverage boundary | 已通过 local fixtures 与 human policy review | 8/15 questions、三种 level、Software、AI Solution、ML 与 non-tech policy 已覆盖；真实 Voice/browser/provider calibration 仍未执行 |
| completion coverage privacy | 已通过 local contract | developer trace 可见 slot-level degraded reason；candidate completion 只返回 status/counts |

Analyze 页面只取得 focus area、gap、题数、preparation hint 和 risk 的安全摘要，并以非技术使用者能理解的英文说明是否可开始练习或需要检查输入；不会显示 schema、coverage ID、proof point、evidence ID、ranking 术语、semantic scorer 名称或 `role intent` 这类内部标签。

## 怎么检查

后端相关测试集中在 `backend/tests/robustness/cv`、`match`、`questions`、`server` 和 `voice`。Candidate Evidence Graph 的 proof angle / guidance / private artifact contract 在 `cvParsingRobustness.test.js`；Role Evidence Map 的 source-trace gate、v2 schema、v1 compatibility marker、evidence guidance、hiring-logic links、JD heading filtering 和 semantic target hygiene 在 `roleEvidenceMapRobustness.test.js`。`jobsyncOptimization.test.js` 现在锁定 input guard、legacy `matchMode` 不改变 canonical semantics，以及 ATS/tailoring output 不再出现；`matchStreamEventService.test.js`、`matchAnalysisExecutionService.test.js`、`roleFitMatchCutover.test.js` 和 `guardedMatchLatency.test.js` 分别覆盖 ordered terminal contract、persistence/question-filter boundary、坏输入在 matcher 前阻挡、CV load reuse 与 non-critical reusable-cache warming。2026-07-26 focused Match gate为 11 files / 57 tests。前端 `matchStreamApi.test.js`、`useMatchAnalysisFlow.test.jsx`、`AnalysisStatusCard.test.jsx`、`AnalyzeActionsCard.test.jsx` 和 `ProofStrategyReviewPanel.test.jsx` 覆盖 stream parser、stale sequence、Match/plan 分离、plan-only retry、真实 stage UI 和 candidate-safe priorities。

Analyze 已沿用这条边界：Match completed 后先显示完整结果；question preparation 尚在执行时只显示 `Preparing your interview focus`；ready 后显示 focus、gap、题数、hint 和 risk。它没有增加 `Improve your CV for this role`、ATS/tailoring 区块，也不会把完整 prepared question text、evidence ID、coverage 或 rank trace 暴露给候选人。Mocked API Playwright human flow 已从 Match stream 走到 preparation ready，并进入 Voice Interview 起始页；这不是 real-provider、真实麦克风或 production 证据。

继续读 [interviewer agent](agent-interviewer.md)，看运行时如何从 prepared pool、follow-up 和 fallback 中选择下一问。

证据状态：除特别标注外，本页基于当前源码已确认。
