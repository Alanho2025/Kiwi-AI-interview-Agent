# 术语表

| 术语 | 项目里的意思 | 延伸阅读 |
| --- | --- | --- |
| CV review gate | 用户确认 match-relevant CV fields 后，后续 match 和 question seed 才能更可信地使用 CV 证据 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| JD rubric | 从 pasted JD 解析出的结构化岗位要求、角色信息、技能和 metadata，不等同于原始 JD 文本 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| businessModel | `company_understanding_v2` 里对公司商业模式线索的 source-linked 分类；来自已有 company facts，不是外部研究结论 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| customersOrUsers | `company_understanding_v2` 里对服务对象、用户或客户线索的 source-linked 分类 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| productsOrServices | `company_understanding_v2` 里对产品、服务、平台、工具或分析能力线索的 source-linked 分类 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| operatingContext | `company_understanding_v2` 里对工作流程、运营场景或业务上下文线索的 source-linked 分类 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| hiringContextHypotheses | `company_understanding_v2` 里基于已审查来源生成的招聘背景假设；默认需要用户确认，不是雇主事实 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| role_intent_decoder_v2 | Role intent 的 v2 preparation artifact；保留 legacy requirement items，同时输出 role purpose、business hypotheses、workflow pain、ideal signals、interview probes 和 diagnostics | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| role_fit_diagnostics_v1 | Role-Fit compact diagnostics payload；只传状态、counts、coverage、degraded reasons 和 source limitations，不复制 CV/JD/company 原文 | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| JD section heading guard | match candidate hygiene 防线；把 `Skills & Experience:`、`Roles & Responsibilities:` 等 JD 标题挡在 role intent、requirement、semantic target 和 UI fallback 外 | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| evidence strength status cap | Requirement evidence 的展示约束；`met` 才能显示 strong，`partial` 最多 partial，`inferred` 最多 weak，`not_met` 必须 missing | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| low_confidence_hiring_logic | RoleIntentDecoder 缺少 grounded company support 等情境下的 degraded reason；表示 hiring logic 仍是低信心准备假设 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| matchAnalysisId | 已持久化的 CV-JD match record 标识，让 interview plan 不只依赖前端临时状态 | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| matchMode | 2026-07-23 provisional backend field；2026-07-26 runtime branch/output 已移除，legacy request value 只会被忽略，不能选择较弱 scorer | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| match_completed | `match_stream_event_v1` 的唯一成功 terminal event；只在 canonical Match 已持久化并完成 JD question-filter boundary 后发出，前端收到后才请求 interview preparation | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| Improve your CV for this role | 被明确排除的 Analyze 产品方向；Kiwi 的 Match 主线服务 interview preparation，不在 Match result 增加 CV rewrite、ATS keyword 或 tailoring workflow | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| stepSummary | `performanceTrace` 里按 step 名称聚合的耗时摘要；用于看同一环节出现几次、累计耗时和最慢一次 | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| slowestSteps | `performanceTrace` 里按 `durationMs` 排序的最慢 measured steps；用于快速定位 CV-JD match latency 热点 | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| prepared question pool | 访谈前生成的候选问题池；运行时仍会被 ranker、dedupe、follow-up 控制影响 | [interviewer agent](modules/agent-interviewer.md) |
| accepted answer | 可以进入报告计分的数据；repair、clarification、repeat、system turn 不属于它 | [报告与 QA](modules/feature-report-and-qa.md) |
| RAG | 本项目的 session/global evidence retrieval；当前用 deterministic hash embedding + pgvector + fusion score | [RAG 检索层](modules/rag-retrieval.md) |
| agent | 这里指一组有输入、决策、输出和 fallback 的服务；并非全部都在 `agentRegistry` 中注册 | [agent registry](modules/agent-registry-and-task-runner.md) |
| runTask | 后端 AI task runner；按 `taskType` 把 interview next turn、report generation、report QA 等任务接到 retrieval、controller、agent 和 persistence | [agent registry](modules/agent-registry-and-task-runner.md) |
| workflowRunId | M1 shadow harness 为一次 canonical product turn 建立的 correlation ID；用于关联 action、gate、state、memory、failure 和 late background events，不取代 session/domain record | [访谈控制机制](modules/feature-interview-control.md) |
| enforced=false | Harness gate 只记录 decision，不会改变 controller、write、visibility 或 export 行为；升级 enforcement 需要所属 domain 的 gate、证据和批准 | [报告与 QA](modules/feature-report-and-qa.md) |
| SessionAnalysis | MongoDB artifact record；保存 controller state、decision/evaluator/trajectory records、RAG index status、agent memory、report artifacts 等 | [数据与保留](modules/data-persistence-retention.md) |
| SessionReport | MongoDB report record；保存最新报告、QA result、状态、版本和 repair history | [报告与 QA](modules/feature-report-and-qa.md) |
| interviewEvaluator | 正式 registry 里的 evaluator callable；把最新答案转成 specificity、evidence、misunderstanding、coverage 等 planner signals | [interview evaluator](modules/agent-interview-evaluator.md) |
| npm run test:all | package-level broad test command；backend 包含 configured robustness groups including retention，frontend 覆盖 hooks/utils/components，real AI eval 不包含在常规 mock-safe 检查里 | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run quality:all | Frontend aggregate quality gate；依序执行 lint、component/unit tests 和 production build，不等同于 browser、human 或 live-provider validation | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:retention | 后端 focused retention lifecycle robustness check；覆盖 audit、backup/quarantine、transaction adapters、policy 和 cleanup planning | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:questions | 后端 focused question pipeline robustness check，覆盖 pool、dedupe、ranker、turn orchestration 和 metadata | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:report | 后端 focused report robustness check，覆盖 report dataset、QA、grounding、rewrite 和 score consistency | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:retrieval | 后端 focused retrieval robustness check，覆盖 RAG payload、quality assessor 和 retrieve-for-turn | [RAG 检索层](modules/rag-retrieval.md) |
| npm run eval:retrieval | 版本化 synthetic runtime benchmark；共用 production fusion ranker，并分开输出 ranked retrieval 与 claim grounding；不是 real-provider 或已人工校准的 production gate | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:e2e:role-fit-visual | Frontend Playwright visual gate；用 mock API 打开报告，验证 Answer Alignment、Role-Fit evidence 与 Report Trust Status，并输出 desktop/mobile screenshots | [报告与 QA](modules/feature-report-and-qa.md) |
| npm run test:e2e:voice-real-backend | Frontend Playwright real-backend voice flow；使用 test STT/TTS providers 跑 authenticated voice socket，并把 3 秒 next-question SLO 结果写入 artifact | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:voice | 后端或前端 voice focused check；具体覆盖取决于从 `backend` 还是 `frontend` 目录运行 | [voice interview](modules/feature-voice-interview.md) |
| voice confidence gate | 把 ASR transcript 分为 accepted、rejected、needs confirmation 的产品规则层 | [voice interview](modules/feature-voice-interview.md) |
| contextual glossary | voice STT session 使用的动态词汇上下文；来自已存在 CV/JD/profile/plan，帮助识别专业词，但不能变成用户 spoken evidence | [voice interview](modules/feature-voice-interview.md) |
| transcriptCalibration | accepted voice transcript 的校准 provenance；记录 raw transcript、calibrated transcript、decision type、N-best metadata 和 guardrail flags | [voice interview](modules/feature-voice-interview.md) |
| transcriptReviewDecision | voice transcript uncertainty 的後校準決策；分類為 auto_accept、deferred_review、immediate_confirmation 或 reject_unusable，並保存 scoring policy 與 evidence boundary | [voice interview](modules/feature-voice-interview.md) |
| deferred_review | 中風險 transcript uncertainty；不中斷 live interview，但 report 前需要顯示 review risk，scoring 只能以 reduced evidence confidence 使用 | [voice interview](modules/feature-voice-interview.md) |
| immediate_confirmation | 高風險 transcript uncertainty；未確認前不得進入 scoring 或 next-question selection，confirmation turn 不計入 interview question | [voice interview](modules/feature-voice-interview.md) |
| TranscriptRiskSection | report page 的 transcript risk 顯示元件；目前只展示 review evidence 和 boundary copy，不提供持久化 review actions | [voice interview](modules/feature-voice-interview.md) |
| bounded repair | 报告 QA 后有限次 wording repair；不能掩盖 deterministic blocking flags | [report QA agent](modules/agent-report-qa.md) |
| retention | 数据保留、audit、cleanup、backup/quarantine 的后台能力；不等同于已完成 account-wide deletion guarantee | [数据与保留](modules/data-persistence-retention.md) |
