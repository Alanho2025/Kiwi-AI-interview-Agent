# 访谈控制机制

访谈控制层决定“下一步做什么”。它先确认 session 和答案，再把任务交给 task runner；task runner 构建 retrieval、evaluator、decision context，并通过 action planner 和 interviewer agent 得到下一问或结束状态。

## 读者应该先记住什么

text mode 的主路径最适合理解系统，因为它绕开 microphone、STT、TTS 和 WebSocket 依赖。用户答案不会直接触发“下一题序号 +1”；系统会评估答案质量、coverage、match gap、time/question limit、重复风险，再生成下一步。

## 一个代表 case

```text
输入: sessionId + text answer
动作: load owned session -> save answer -> runTask(interview_next_turn)
输出: nextQuestion 或 completedBecause
边界: time_limit_reached、question_limit_reached、no_unique_question_remaining 都会结束访谈
```

## 代码怎么追

| 阶段 | 源码入口 | 说明 |
| --- | --- | --- |
| HTTP turn | [interview turn controller](../../backend/src/controllers/interviewTurnController.js) | 验证 session、保存 answer、调用 task runner |
| Task runner | [master AI service](../../backend/src/services/masterAiService.js) | 处理 retrieval、evaluation、decision、memory、trace、report action |
| Evaluator | [interview evaluator](../../backend/src/services/aiControl/interviewEvaluatorService.js) | 抽取 specificity、evidence gain、misunderstanding、skill denial 等信号 |
| Action planning | [action planner](../../backend/src/services/aiControl/actionPlanner.js) | 将 evaluator/context 变成 allowed action |
| Action execution | [interview action executor](../../backend/src/services/aiControl/interviewActionExecutor.js) | 调用 interviewer agent 生成下一问 |
| M1 shadow harness | [shadow harness](../../backend/src/services/harness/interviewNextTurnShadowHarness.js) | flag 开启时在 current controller 外记录 refs-only `WorkflowRun`；失败时 fail-open，不改变产品结果 |

## 控制器保留的透明度

系统会写 decision record、trajectory、agent memory 和 question metadata。这个设计让报告和 diagnostics 能解释为什么问某个问题、它测试什么、用到什么证据、是否来自 prepared pool。

G2/M1 新增一条非 production developer query：`GET /api/interview/harness-runs`。它只查询当前 authenticated owner 的 redacted timeline，可按 `workflowRunId`、`sessionId` 和时间过滤；candidate-facing session API 仍不返回 internal action、gate、failure 或 memory trace。`ENABLE_HARNESS_SHADOW` 默认关闭，关闭后完全走原本的 interview runtime。

目前这个 harness 是 shadow observer，不是第二个 controller。Local replay 已证明 flag OFF/ON legacy result parity、fallback lineage、voice confirmation same-run、duplicate/failure fail-open；human/browser session、live voice provider 和 production shadow 仍未验证。

继续读 [agent registry 与 task runner](agent-registry-and-task-runner.md)，看 `runTask` 如何把不同任务路由到 agent。

证据状态：除特别标注外，本页基于当前源码已确认。
