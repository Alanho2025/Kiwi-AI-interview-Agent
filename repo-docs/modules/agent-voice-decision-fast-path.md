# Voice decision fast path

voice decision fast path 是 voice 模式下的 bounded model-assisted decision。它把 answer understanding 和 action selection 合并成一次 JSON 决策，目标是减少 live voice turn 等待，同时保持 allowed action 边界。

## 它在哪里被调用

实现位于 [voice agent decision service](../../backend/src/services/aiControl/voiceAgentDecisionService.js)。[master AI service](../../backend/src/services/masterAiService.js) 在 voice optimization config 允许时调用它。

## 一个代表 case

```text
输入: decisionContext + evaluatorOutput + localUnderstanding + candidateActions + fallbackPlan
动作: callDeepSeek JSON -> parse selectedAction -> verify selectedAction in allowedCandidates
输出: latestAnswerUnderstanding + plan
边界: invalid JSON、provider failure、disallowed action 都回到 fallbackPlan
```

## 它做什么决策

它只能从 `candidateActions[].action` 中选一个 action。它可以补充 key facts、technologies、metrics、ownership signals、missing evidence 和 semantic opportunity，但不能覆盖 time limit、question limit、mode boundary 或 safety rules。

## 输出和持久化

返回的 plan 会进入 normal decision/action path；task runner 后续负责 decision record、trace 和 memory。这个 service 本身不直接写 DB。

## 怎么检查

相关行为由 voice single-blocking policy、agent control 和 action completeness tests 间接覆盖。继续读 [interview evaluator](agent-interview-evaluator.md)，看 local understanding 的来源。

证据状态：除特别标注外，本页基于当前源码已确认。

