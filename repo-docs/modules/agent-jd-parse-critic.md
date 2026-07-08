# JD parse critic agent

JD parse critic agent 检查 structured JD rubric 是否忠实于 raw JD。它服务于 JD safeguard loop，目标是阻止错把福利、营销文案或 bonus skills 当成核心要求。

## 它在哪里被调用

critic 实现在 [JD parse critic agent](../../backend/src/services/jobDescription/jdParseCriticAgent.js)，由 [guarded JD service](../../backend/src/services/jobDescription/guardedJobDescriptionService.js) 调用。

## 一个代表 case

```text
输入: rawJD + firstParsed rubric
动作: DeepSeek JSON critic 或 mock/heuristic fallback
输出: verdict、confidence、issues、blockMatch、reparse instructions
边界: provider disabled 或 mock mode 时，不能让缺失 provider 阻断本地测试
```

## 它做什么决策

critic 不重写整个 JD。它指出字段级问题、风险、是否需要 reparse、是否应该 block match。gate service 再决定是否用 reparse agent 做第二轮。

## 输出和持久化

critic result 被附加到 rubric 的 `safeguard` 和 metadata，前端和 match layer 可以据此要求 human review 或阻止未确认 match。

## 怎么检查

相关 tests 在 `backend/tests/robustness/jd/jdParseAgenticSafeguard.test.js`、`jdParseLumaAnalyticsSafeguard.test.js`、`jdSafeguardAiBudget.test.js`。

继续读 [JD reparse agent](agent-jd-reparse.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

