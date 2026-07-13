# Agent memory 与 trace

memory 和 trace 不是独立“聊天记忆”产品。它们记录控制器刚刚学到的模式、topic history、evidence gaps、latency breakdown、reflection lessons、user-level coaching memory 和 agent trace events，让后续问题选择和报告解释可以追溯。

## 它在哪里被调用

session memory 逻辑在 [agent memory service](../../backend/src/services/aiControl/agentMemoryService.js)，跨 session coaching memory 在 [user coaching memory service](../../backend/src/services/aiControl/userCoachingMemoryService.js)，reflection lesson 在 [reflection writer service](../../backend/src/services/aiControl/reflectionWriterService.js)，trace event 在 [agent trace service](../../backend/src/services/aiControl/agentTraceService.js)。`runTask` 会在 interview turn 中读写这些记录。

## 一个代表 case

```text
输入: latest answer + decisionContext + latestDecision + outcome
动作: updateAgentMemory 记录 topicHistory/recentPatterns/evidenceGaps/projectUsage；必要时写 reflectionRecord 并同步到 UserCoachingMemory
输出: SessionAnalysis.agentMemory、reflectionRecords、agentTraceEvents 和 UserCoachingMemory.latestSummary
边界: memory facts 不能被当成 latest answer 直接引用；跨 session memory 目前是 bounded coaching summary，不是完整 progress-learning loop
```

## 它做什么决策

session memory 决定哪些模式值得保留：brief answer、general answer tendency、remaining validation targets、probing strategy、project overuse。action planner 目前会直接使用 `agentMemory.projectUsage`，避免候选人反复讲同一个项目。user-level coaching memory 会保存最近 reflection lessons，并在 full memory policy 下进入 `decisionContext.userCoachingMemory`，也会进入 report draft 的 internal coaching summary；它还没有成为 question planner 的强约束或 progress dashboard 的正式 profile。trace 决定哪些 runtime milestones 和 cost/latency signals 能进入 compact summary。

## 输出和持久化

这些记录主要写两个 Mongo family：

| 数据 | 位置 | 作用 |
| --- | --- | --- |
| Session-local memory | `SessionAnalysis.agentMemory`、`reflectionRecords`、`trajectoryRecords`、`agentTraceEvents` | 支撑同一场 interview 的下一问、trace、report grounding 与 diagnostics。 |
| User-level coaching memory | `UserCoachingMemory.memoryRecords`、`latestSummary` | 保存最近几条 reflection lessons，让下一场 session 可以读取 bounded coaching summary。 |

report 可以读取这些信号展示 RAG used、retrieval sources、latency、cost、reflection summary 和 coaching summary。当前 progress dashboard 还需要额外的跨 session aggregation/profile 层，才能把历史 session 指标转成稳定的 next-practice plan。

## 怎么检查

重点 tests 在 `backend/tests/robustness/agent/memoryGroundingAndPolicy.test.js`、`voiceMemoryPolicy.test.js` 和 trace/eval contract tests。

继续读 [访谈控制机制](feature-interview-control.md)，看 memory 和 trace 在下一问选择中的位置。

证据状态：除特别标注外，本页基于当前源码已确认。
