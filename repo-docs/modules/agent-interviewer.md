# Interviewer agent

interviewer agent 把 action planner 的决定变成下一句可问的问题。它选择 prepared root question、follow-up、validation、deep dive、section shift、wrap-up 或 fallback，并在最后做 mode guard 和 novelty guard。

## 它在哪里被调用

实现位于 [interviewer agent](../../backend/src/services/agents/interviewerAgent.js)，由 [interview action executor](../../backend/src/services/aiControl/interviewActionExecutor.js) 或 task runner 间接调用。问题构造 helper 在 [question builder](../../backend/src/services/agents/interviewerAgentQuestionBuilder.js)。

## 一个代表 case

```text
输入: session + decisionContext + actionType = ASK_VALIDATION_QUESTION
动作: buildInterviewTurnPlan -> select root/follow-up candidate -> micro planning -> mode guard -> novelty guard
输出: displayText、questionDecision、rankTrace、deduplication、latency metadata
边界: generated wording 和 base question 都重复时，尝试 alternative；仍无唯一问题则 wrap up
```

## 它做什么决策

它决定当前 action 对应哪种问题形状，并保护三个产品规则：focus mode 不越界、follow-up 保留 parent metadata、root question 不重复 assessment-equivalent 目标。

## 输出和持久化

agent 返回结构化 `questionDecision`，后续由 session/task layer 写入 transcript metadata、prepared item asked state 和 trace。它本身不直接写 response。

## 怎么检查

重点 tests：`interviewerPreparedPoolRuntime.test.js`、`questionMetadataPersistence.test.js`、`questionPoolRankerService.test.js`、`interviewerAgentQuestionBuilderBaseline.test.js`。继续读 [访谈控制机制](feature-interview-control.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

