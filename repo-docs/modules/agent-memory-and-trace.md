# Agent memory 与 trace

memory 和 trace 不是独立“聊天记忆”产品。它们记录控制器刚刚学到的模式、topic history、evidence gaps、latency breakdown、reflection lessons、user-level coaching memory、user interview projection 和 agent trace events，让后续问题选择和报告解释可以追溯。

## 它在哪里被调用

session memory 逻辑在 [agent memory service](../../backend/src/services/aiControl/agentMemoryService.js)，跨 session coaching memory 在 [user coaching memory service](../../backend/src/services/aiControl/userCoachingMemoryService.js)，M3 projection 在 [user interview memory service](../../backend/src/services/aiControl/userInterviewMemoryService.js)，reflection lesson 在 [reflection writer service](../../backend/src/services/aiControl/reflectionWriterService.js)，trace event 在 [agent trace service](../../backend/src/services/aiControl/agentTraceService.js)。`runTask` 会在 interview turn 中读写这些记录。M1 shadow harness 还会把这些 background write 以 `workflowRunId` 关联回同一次 turn，并由 [harness run trace service](../../backend/src/services/harness/harnessRunTraceService.js) 在 task queued 与 durable persisted 两个阶段输出 redacted backend trace。

## 一个代表 case

```text
输入: latest answer + decisionContext + latestDecision + outcome
动作: updateAgentMemory 记录 topicHistory/recentPatterns/evidenceGaps/projectUsage；必要时写 reflectionRecord 并同步到 UserCoachingMemory
输出: SessionAnalysis.agentMemory、reflectionRecords、agentTraceEvents 和 UserCoachingMemory.latestSummary
边界: memory facts 不能被当成 latest answer 直接引用；M3 projection 只能影响 planning，不能影响 match、answer evaluation 或 report scoring
```

## 它做什么决策

session memory 决定哪些模式值得保留：brief answer、general answer tendency、remaining validation targets、probing strategy、project overuse。action planner 会使用 `agentMemory.projectUsage`，避免候选人反复讲同一个项目。user-level coaching memory 会保存最近 reflection lessons，并在 full memory policy 下进入 `decisionContext.userCoachingMemory` 和 report draft 的 internal coaching summary。

M3 新增的 user interview projection 从同一 user 的既有 `SessionAnalysis.trajectoryRecords` 重算，只在当前 session 保存 refs 和 derived status。相同 competency/question family 至少要有两个独立 session、90 天内且 role 适用，才可令 planner deepen 或切换到未覆盖主题；stale、role mismatch 或 conflict 会要求 revalidation，不会直接 suppress。`ENABLE_USER_INTERVIEW_MEMORY_PLANNING` 默认关闭，并且只有 harness `observe` mode 才能启用。它仍不是 progress dashboard 的正式 profile，也没有 user control 或 source-delete invalidation contract。

## 输出和持久化

这些记录主要写两个 Mongo family：

| 数据 | 位置 | 作用 |
| --- | --- | --- |
| Session-local memory | `SessionAnalysis.agentMemory`、`reflectionRecords`、`trajectoryRecords`、`agentTraceEvents` | 支撑同一场 interview 的下一问、trace、report grounding 与 diagnostics。 |
| User-level coaching memory | `UserCoachingMemory.memoryRecords`、`latestSummary` | 保存最近几条 reflection lessons，让下一场 session 可以读取 bounded coaching summary。 |
| User interview projection | 当前 `SessionAnalysis.agentMemory.userInterviewProjection` | 保存同 user 历史 trajectory 的 refs/derived status；default off planning slice，不复制 raw answer/question。 |
| Shadow run correlation | `HarnessWorkflowRun.memoryWrites`、`timeline` | 保存 refs/status/count，不复制 answer、question、prompt 或 memory 内容；不是产品 source of truth。 |
| Immediate harness trace | Backend `Harness workflow trace` | task 完成时显示 `queued` / correlation `pending`，durable append 后显示 `persisted` 与实际计数；只输出 allowlisted metadata，不替代 `HarnessWorkflowRun`。 |

report 可以读取这些信号展示 RAG used、retrieval sources、latency、cost、reflection summary 和 coaching summary。当前 progress dashboard 还需要额外的跨 session aggregation/profile 层，才能把历史 session 指标转成稳定的 next-practice plan。

## 怎么检查

重点 tests 在 `backend/tests/robustness/agent/memoryGroundingAndPolicy.test.js`、`voiceMemoryPolicy.test.js`、`userCoachingMemoryProvenance.test.js`、`userInterviewMemoryProjection.test.js`、`userInterviewMemoryPlanning.test.js`，以及 `backend/tests/robustness/contracts/harnessRunCorrelationService.test.js`、`harnessRunTraceService.test.js` 和 `harnessPersistenceTrace.test.js`。M3 deterministic eval 的五个 eligible cases 中 same-depth repeat 从 5 降到 0、untouched coverage 从 0 升到 5、wrong suppression 为 0，且 evaluator output 不变；真人 repeated sessions 仍未验证。Automated browser H1 的两笔 interview runs 和四笔 memory writes 也已持久化，但使用 test STT/TTS 与 mock AI，不能推定 production correlation。

继续读 [访谈控制机制](feature-interview-control.md)，看 memory 和 trace 在下一问选择中的位置。

证据状态：除特别标注外，本页基于当前源码已确认。
