# 一次从 CV/JD 准备到报告 QA 的真实运行

这个 walkthrough 跟随最稳的 demo 路径：用户登录后上传或选择 CV，粘贴 JD，确认结构化输入，生成 CV-JD match 和问题池，进入 text interview，回答后由控制器选择下一问，完成后生成报告并跑 QA。输入是用户确认过的 CV/JD 和一段文字答案；成功输出是带状态的 report record、QA result、question metadata 和可追踪 evidence。

难点是这条路不是简单的 chatbot。系统必须在每个阶段回答同一个问题：这一步的输出能不能被下游当成证据？如果不能，就要进入 review、fallback、repair、diagnostic 或 non-ready 状态，而不是继续扩大错误。

## Step 1: 用户把原始材料变成可确认的证据

第一步处理的不是“文件上传成功”这么小的事，而是把候选人的 CV 和目标 JD 变成后续匹配可以使用的结构化证据。CV 入口由上传控制器接收文件并委托 CV services；JD 入口由 job-description controller 调用 guarded rubric builder。用户确认之前，这些结构化结果只适合展示和检查，不应该直接变成最终访谈判断。

可追源码：CV 上传从 [upload controller](../../backend/src/controllers/uploadController.js) 进入；JD 解析从 [JD controller](../../backend/src/controllers/jobDescriptionController.js) 进入，核心守门在 [guarded JD service](../../backend/src/services/jobDescription/guardedJobDescriptionService.js)。读完后可以继续看 [CV/JD 准备机制](../modules/feature-cv-jd-preparation.md)。

```text
输入: PDF/DOCX CV + pasted JD
状态变化: file/document content/profile/rubric 被创建或更新
边界: raw JD 改变后旧 summary/review 状态不能继续被信任
```

## Step 2: reviewed inputs 进入 match 和问题准备

当 CV 和 JD 进入 reviewed 状态，match API 才有足够上下文比较候选人证据和岗位要求。这里的输出不是单一分数。match result 会写入 match analysis record，再衍生 JD question filter；interview plan 生成时会恢复或生成 CV question seeds，并准备 DB-backed question pool。

这一步的边界很明显：JD filter 或 question pool 失败时，系统可以继续，但问题会降级为更通用的来源。代码把这种失败记录为 warning，而不是承诺每次都有完整定制问题。

可追源码：match 入口在 [analyze controller](../../backend/src/controllers/analyzeController.js)，匹配核心在 [CV analysis service](../../backend/src/services/cv/cvAnalysisService.js)，问题池准备在 [question pool preparation](../../backend/src/services/questions/questionPoolPreparationService.js)。读完后看 [match 与问题准备](../modules/feature-match-and-question-prep.md)。

```text
输入: reviewed CV + reviewed JD rubric + settings
输出: matchAnalysisId + JD question filter + prepared question pool readiness
失败分支: JD filter/pool composition warning 后继续，但 diagnostics 会更重要
```

## Step 3: text interview 把答案交给控制器，而不是直接问下一题

text mode 是低依赖主路径。用户提交答案后，controller 先确认 session 属于当前用户、状态仍在进行中，再保存答案，并调用 `runTask` 的 `interview_next_turn`。这个 task 会索引 session artifacts、构建 retrieval/evaluator/decision context、选择 action，再让 interviewer agent 生成下一问或结束。

这里的关键是 next question 不是 `questionIndex + 1`。系统会看答案是否具体、是否覆盖 JD/match gap、是否需要 follow-up、是否已经达到时间或问题限制。repair prompt、clarification、transcript confirmation 这类非访谈问题也不能被当作正式问题计数；voice 文档里这条规则更严格。

可追源码：文字回答入口在 [interview turn controller](../../backend/src/controllers/interviewTurnController.js)，task runner 在 [master AI service](../../backend/src/services/masterAiService.js)，访谈 agent 在 [interviewer agent](../../backend/src/services/agents/interviewerAgent.js)。读完后看 [访谈控制机制](../modules/feature-interview-control.md) 和 [interviewer agent](../modules/agent-interviewer.md)。

```text
输入: latest answer
状态变化: transcript 增加 answer turn，controller state 和 question metadata 被更新
输出: nextQuestion / wrap_up / completedBecause
边界: question limit、time limit、duplicate question exhaustion 都可以结束访谈
```

## Step 4: 报告只读取可计分答案和可追踪证据

报告生成不是 transcript summary。报告 agent 会先从 session、match、plan、prepared pool、transcript 和 retrieval bundle 里组织证据，再构建 accepted-answer dataset。repair、repeat、clarification、system、barge-in acknowledgment 这类 turn 不应进入计分数据。

报告 QA 是第二道门。它检查 section、evidence references、score/metric 一致性、rubric 对齐、rewrite 质量、transcript risk 是否可见。失败时报告可以进入 `needs_review` 或 `repair_failed`，bounded repair 最多只适合改 wording，不能掩盖 deterministic integrity flags。

报告载入后，Report Trust Status 会把 persisted status 映射为 candidate-safe explanation：通过、修复后通过、需要复核或验证未完成。需要时页面提供重新检查/重新生成，但不会显示 raw QA flags 或 internal trace；下载与 TXT/PDF export 行为没有因这个 status card 改变。

可追源码：报告 API 在 [report controller](../../backend/src/controllers/reportController.js)，安全状态映射在 [publication summary service](../../backend/src/services/report/reportPublicationSummaryService.js)，状态 UI 在 [Report Trust Status](../../frontend/src/components/report/ReportTrustStatusCard.jsx)，报告 agent 在 [report generator](../../backend/src/services/agents/reportGeneratorAgent.js)，QA agent 在 [report QA agent](../../backend/src/services/agents/reportQaAgent.js)，修复编排在 [QA repair orchestrator](../../backend/src/services/report/reportQaRepairOrchestratorService.js)。继续看 [报告与 QA](../modules/feature-report-and-qa.md)。

```text
输入: completed session + match/plan/transcript evidence
输出: SessionReport.latestStatus = ready | ready_after_repair | needs_review | repair_failed
边界: blocking QA flags 不应被 wording rewrite 隐藏
```

## Step 5: 复核这条理解是否成立

最小复核路径不需要 real AI provider。后端可以从 `backend` 跑 `npm run test:questions`、`npm run test:report`、`npm run test:retrieval`；前端可以从 `frontend` 跑 `npm run test:all`。如果要验证 voice live path，需要有效 speech provider credential、浏览器麦克风权限、authenticated WebSocket 和 live session，这不是常规文档验证步骤。

如果这条解释是错的，最容易被证伪的地方是：`backend/src/controllers/analyzeController.js` 不再创建 match/question artifacts，`backend/src/services/masterAiService.js` 不再做 retrieval/evaluator/action planning，或 report QA 不再写状态。对应 evidence ledger 在 [source evidence 审计表](../references/source-evidence.md)。

证据状态：除特别标注外，本页基于当前源码已确认。
