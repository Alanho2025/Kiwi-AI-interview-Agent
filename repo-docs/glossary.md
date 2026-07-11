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
| low_confidence_hiring_logic | RoleIntentDecoder 缺少 grounded company support 等情境下的 degraded reason；表示 hiring logic 仍是低信心准备假设 | [CV/JD 准备机制](modules/feature-cv-jd-preparation.md) |
| matchAnalysisId | 已持久化的 CV-JD match record 标识，让 interview plan 不只依赖前端临时状态 | [match 与问题准备](modules/feature-match-and-question-prep.md) |
| prepared question pool | 访谈前生成的候选问题池；运行时仍会被 ranker、dedupe、follow-up 控制影响 | [interviewer agent](modules/agent-interviewer.md) |
| accepted answer | 可以进入报告计分的数据；repair、clarification、repeat、system turn 不属于它 | [报告与 QA](modules/feature-report-and-qa.md) |
| RAG | 本项目的 session/global evidence retrieval；当前用 deterministic hash embedding + pgvector + fusion score | [RAG 检索层](modules/rag-retrieval.md) |
| agent | 这里指一组有输入、决策、输出和 fallback 的服务；并非全部都在 `agentRegistry` 中注册 | [agent registry](modules/agent-registry-and-task-runner.md) |
| runTask | 后端 AI task runner；按 `taskType` 把 interview next turn、report generation、report QA 等任务接到 retrieval、controller、agent 和 persistence | [agent registry](modules/agent-registry-and-task-runner.md) |
| SessionAnalysis | MongoDB artifact record；保存 controller state、decision/evaluator/trajectory records、RAG index status、agent memory、report artifacts 等 | [数据与保留](modules/data-persistence-retention.md) |
| SessionReport | MongoDB report record；保存最新报告、QA result、状态、版本和 repair history | [报告与 QA](modules/feature-report-and-qa.md) |
| interviewEvaluator | 正式 registry 里的 evaluator callable；把最新答案转成 specificity、evidence、misunderstanding、coverage 等 planner signals | [interview evaluator](modules/agent-interview-evaluator.md) |
| npm run test:all | package-level broad test command；backend 和 frontend 的覆盖范围不同，real AI eval 不包含在常规 mock-safe 检查里 | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:questions | 后端 focused question pipeline robustness check，覆盖 pool、dedupe、ranker、turn orchestration 和 metadata | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:report | 后端 focused report robustness check，覆盖 report dataset、QA、grounding、rewrite 和 score consistency | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:retrieval | 后端 focused retrieval robustness check，覆盖 RAG payload、quality assessor 和 retrieve-for-turn | [RAG 检索层](modules/rag-retrieval.md) |
| npm run eval:retrieval | 版本化 synthetic runtime benchmark；共用 production fusion ranker，并分开输出 ranked retrieval 与 claim grounding；不是 real-provider 或已人工校准的 production gate | [测试与 evaluation](modules/testing-and-evaluation.md) |
| npm run test:voice | 后端或前端 voice focused check；具体覆盖取决于从 `backend` 还是 `frontend` 目录运行 | [voice interview](modules/feature-voice-interview.md) |
| voice confidence gate | 把 ASR transcript 分为 accepted、rejected、needs confirmation 的产品规则层 | [voice interview](modules/feature-voice-interview.md) |
| bounded repair | 报告 QA 后有限次 wording repair；不能掩盖 deterministic blocking flags | [report QA agent](modules/agent-report-qa.md) |
| retention | 数据保留、audit、cleanup、backup/quarantine 的后台能力；不等同于已完成 account-wide deletion guarantee | [数据与保留](modules/data-persistence-retention.md) |
