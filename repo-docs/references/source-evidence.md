# Source evidence

这是固定 evidence ledger，不是第二套说明文。理解内容在 walkthrough 和 modules；这里记录本次构建用来证明或限制说法的来源。

## Evidence Traversal Log

| Pass | Purpose | Inspected evidence | What changed in the model |
| --- | --- | --- | --- |
| Pass 1 | Main path | `README.md`, `AGENTS.md`, `backend/package.json`, `frontend/package.json`, [API composition](../../backend/src/api.js), [analyze controller](../../backend/src/controllers/analyzeController.js), [interview turn controller](../../backend/src/controllers/interviewTurnController.js), [report controller](../../backend/src/controllers/reportController.js) | 主线确定为 CV/JD -> match -> question pool -> text interview -> report QA，而不是全功能目录导览 |
| Pass 2 | Socratic challenge/fill | [voice product contract](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md), [RAG index](../../backend/src/services/ragIndexService.js), [retrieval service](../../backend/src/services/ragRetrievalService.js), [embedding service](../../backend/src/services/embeddingService.js), [agent registry](../../backend/src/services/agentRegistryService.js), [voice agent decision](../../backend/src/services/aiControl/voiceAgentDecisionService.js), `backend/tests/robustness/**`, `frontend/src/**/*.test.*` | 修正了 RAG 不是 production embedding、voice 需要 live dependencies、agent 分正式 registry 和功能内 critic、测试覆盖以 robustness/fallback 为核心 |

## Coverage And Scope

覆盖：主产品链路、feature modules、正式 agent、JD/match critic、voice agent、RAG、验证、测试、持久化和保留。

不追踪：`node_modules`、`backend/uploads`、backup folders、历史 eval generated results 的逐项内容、真实 `.env`、real provider live run。相邻路径已查看但不作为主线：pricing/landing UI、commercial planning docs、historical incident docs。

## Falsifying Check

如果以下证据发生变化，本指南需要同步：`backend/src/controllers/analyzeController.js` 不再生成 match/question artifacts；`backend/src/services/masterAiService.js` 不再作为 task runner；`backend/src/services/embeddingService.js` 改用外部 embedding；`VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md` 改变 transcript confidence 或 question counting contract；report QA 不再写明确状态。

## Likely Reader Follow-up

下一问通常会是：哪些代码最值得先优化？本指南先建立现状理解，不排序优化工作；优化应从 oversized controller/service、ownership coverage gaps、RAG embedding quality、voice live verification 和 report QA calibration 这些已暴露边界开始。

## Claim Audit

| Claim | Evidence | Confidence | Caveat | Used by |
| --- | --- | --- | --- | --- |
| text interview 是最低依赖主路径 | [root instructions](../../AGENTS.md), [interview turn controller](../../backend/src/controllers/interviewTurnController.js) | 已确认 | voice 也 product-wired，但需要外部条件 | walkthrough, feature-interview-control |
| CV/JD 准备先形成 reviewable evidence | [upload controller](../../backend/src/controllers/uploadController.js), [guarded JD service](../../backend/src/services/jobDescription/guardedJobDescriptionService.js) | 已确认 | UI review 状态还需结合 frontend 页面理解 | feature-cv-jd-preparation |
| match 输出会持久化并喂给问题准备 | [analyze controller](../../backend/src/controllers/analyzeController.js), [match record service](../../backend/src/services/cv/matchAnalysisRecordService.js), [JD filter service](../../backend/src/services/questions/jdQuestionFilterService.js) | 已确认 | JD filter 失败是 warning/degraded path | feature-match-and-question-prep |
| prepared question pool 是候选材料，不是固定脚本 | [question pool preparation](../../backend/src/services/questions/questionPoolPreparationService.js), [interviewer agent](../../backend/src/services/agents/interviewerAgent.js), [question ranker tests](../../backend/tests/robustness/questions/questionPoolRankerService.test.js) | 已确认 | runtime 仍可 fallback 或 ask follow-up | feature-match-and-question-prep, agent-interviewer |
| adaptive controller 不是简单 questionIndex + 1 | [master AI service](../../backend/src/services/masterAiService.js), [action planner](../../backend/src/services/aiControl/actionPlanner.js), [interview control tests](../../backend/tests/robustness/agent/interviewControlRobustness.test.js) | 已确认 | 部分 model-assisted selection 依赖 provider 或 mock mode | feature-interview-control |
| voice 需要 state machine 和 confidence gate | [voice product contract](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md), [speech confidence gate](../../backend/src/services/voice/speechConfidenceGate.js), [duplex coordinator tests](../../backend/tests/robustness/voice/duplexTurnCoordinator.transcriptConfirmation.test.js) | 已确认 | live provider E2E 仍需要 credentials 和 browser device | feature-voice-interview |
| report 只应使用 accepted/countable answers | [report turn dataset](../../backend/src/services/report/reportTurnDatasetService.js), [report generator](../../backend/src/services/agents/reportGeneratorAgent.js), [report tests](../../backend/tests/robustness/report/reportTurnDatasetRobustness.test.js) | 已确认 | transcript quality risks 需要在报告中显式展示 | feature-report-and-qa |
| report QA 有 blocking flags 和状态 | [report QA agent](../../backend/src/services/agents/reportQaAgent.js), [master AI persistReportArtifact](../../backend/src/services/masterAiService.js), [report QA tests](../../backend/tests/robustness/report/reportFrameworkQa.test.js) | 已确认 | wording repair 不能修 deterministic integrity failure | agent-report-qa |
| RAG 当前用 deterministic 256 维 hash embedding | [embedding service](../../backend/src/services/embeddingService.js), [Postgres schema](../../backend/src/config/postgresSchemaStatements.js), [retrieval service](../../backend/src/services/ragRetrievalService.js) | 已确认 | 不应宣传为 production-grade semantic embedding | rag-retrieval |
| retrieval agent 会按 objective 选 source 并可能 corrective retry | [retrieval agent](../../backend/src/services/agents/retrievalAgent.js), [source selector](../../backend/src/services/retrieval/retrievalSourceSelector.js), [corrective retrieval](../../backend/src/services/retrieval/correctiveRetrievalService.js) | 已确认 | global/session retriever 当前都复用 evidence bundle retrieval | agent-retrieval, rag-retrieval |
| auth、CSRF、rate limit 和 WebSocket origin 是入口保护 | [API composition](../../backend/src/api.js), [CSRF middleware](../../backend/src/middleware/csrfMiddleware.js), [rate limits](../../backend/src/middleware/rateLimitMiddleware.js), [WebSocket security](../../backend/src/api/webSocketSecurity.js) | 已确认 | route-complete ownership coverage 仍是 hardening area | validations-and-guards |
| recording 是 resumable/idempotent 且与 report readiness 分离 | [recording routes](../../backend/src/api/routes/recordingRoutes.js), [recording upload service](../../backend/src/services/recording/recordingUploadService.js), [frontend recorder hook](../../frontend/src/hooks/voice/useSessionAudioRecorder.js), [recording tests](../../backend/tests/robustness/recording/resumableRecordingUpload.test.js) | 已确认 | browser profile recovery 和 conversion worker 需要运行环境支持 | feature-recording |
| 测试策略以 robustness/fallback/eval 为中心 | [backend package scripts](../../backend/package.json), [frontend package scripts](../../frontend/package.json), [testing docs](../../docs/testing-and-evaluation.md), [test files](../../backend/tests) | 已确认 | real AI eval 和 live voice provider 不应常规运行 | testing-and-evaluation |

