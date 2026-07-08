# Agent registry 与 task runner

这个项目没有把所有智能行为交给一个大 agent。正式 registry 只登记几个可调用 agent，而 `runTask` 是把 interview、report、QA 等任务串进同一个控制流的 task runner。

## 它在哪里被调用

HTTP controllers 和 voice turn coordinator 最终会进入 [master AI service](../../backend/src/services/masterAiService.js)。正式 agent registry 在 [agent registry service](../../backend/src/services/agentRegistryService.js)，包含 `retrieval`、`interviewer`、`reportGenerator`、`reportQa`、`interviewEvaluator`。

## 一个代表 case

```text
输入: taskType = interview_next_turn, sessionId, latest answer
动作: runTask 读取 session -> ensureSessionArtifactsIndexed -> retrieval/evaluator/action planner -> interviewer agent
输出: nextQuestion、metadata、trace、可能的 completedBecause
边界: time/question limit 会在 agent 生成下一问前结束
```

## 它做什么决策

`runTask` 决定当前 task 需要哪些上下文、是否索引 session artifacts、是否运行 retrieval、如何选择 action，以及是否持久化 decision/trajectory/memory/report artifacts。它不是 LLM wrapper；它更像产品控制器。

## 输出和持久化

它会写入 `SessionAnalysis` 中的 controller snapshot、decision records、evaluator records、trajectory、agent memory、trace events，也会在 report task 中写 `SessionReport`。

## 怎么检查

相关 tests 在 `backend/tests/robustness/agent`、`backend/tests/robustness/questions`、`backend/tests/robustness/report`。继续读 [retrieval agent](agent-retrieval.md) 或 [interviewer agent](agent-interviewer.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

