# Agent memory 与 trace

memory 和 trace 不是独立“聊天记忆”产品。它们记录控制器刚刚学到的模式、topic history、evidence gaps、latency breakdown 和 agent trace events，让后续问题选择和报告解释可以追溯。

## 它在哪里被调用

memory 逻辑在 [agent memory service](../../backend/src/services/aiControl/agentMemoryService.js)，trace event 在 [agent trace service](../../backend/src/services/aiControl/agentTraceService.js)。`runTask` 会在 interview turn 中读写这些记录。

## 一个代表 case

```text
输入: latest answer + decisionContext + latestDecision + outcome
动作: updateAgentMemory 记录 topicHistory/recentPatterns/evidenceGaps/projectUsage
输出: SessionAnalysis.agentMemory 和 agentTraceEvents
边界: memory facts 不能被当成 latest answer 直接引用；需要 grounding policy
```

## 它做什么决策

memory 决定哪些模式值得保留：brief answer、general answer tendency、remaining validation targets、probing strategy、project overuse。trace 决定哪些 runtime milestones 和 cost/latency signals 能进入 compact summary。

## 输出和持久化

二者主要写 `SessionAnalysis`：`agentMemory`、`agentTraceEvents`、trajectory 和 compact trace summary。report 也可以读取这些信号展示 RAG used、retrieval sources、latency、cost。

## 怎么检查

重点 tests 在 `backend/tests/robustness/agent/memoryGroundingAndPolicy.test.js`、`voiceMemoryPolicy.test.js` 和 trace/eval contract tests。

继续读 [访谈控制机制](feature-interview-control.md)，看 memory 和 trace 在下一问选择中的位置。

证据状态：除特别标注外，本页基于当前源码已确认。

