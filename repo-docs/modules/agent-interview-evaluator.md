# Interview evaluator

interview evaluator 把候选人的最新答案转成控制器能使用的信号。它不会直接写下一题；它告诉 action planner 这段答案是否具体、是否有证据、是否误解、是否重复、是否暴露 gap。

## 它在哪里被调用

正式注册为 `interviewEvaluator`，实现位于 [interview evaluator service](../../backend/src/services/aiControl/interviewEvaluatorService.js)。`runTask` 会把它的输出放入 decision context。

## 一个代表 case

```text
输入: latest answer + current topic + required skills + coverage state
动作: classifySpecificity、detectMisunderstanding、detectSkillDenial、computeEvidenceGainScore
输出: plannerSignals、suggestedNextMode、specificity、evidenceGainScore
边界: 候选人自我纠正不应被误判成 misunderstanding
```

## 它做什么决策

它主要做 deterministic signal extraction：技术名词、metrics、ownership signals、friction、candidate question、skill denial、STAR/STARR completeness、coverage pressure。model-assisted path 可补充，但不能替代产品规则。

## 输出和持久化

evaluator output 会被 task runner persist 到 `SessionAnalysis.evaluatorRecords`，也会进入 trajectory 和 report trace summary。

## 怎么检查

相关 tests 在 `backend/tests/robustness/agent/fastAnswerUnderstandingRobustness.test.js`、`interviewControllerActionCompleteness.test.js`、`reasoningPolicyCompleteness.test.js`。

继续读 [voice decision fast path](agent-voice-decision-fast-path.md)，看 voice mode 如何用一次 bounded model decision 减少等待。

证据状态：除特别标注外，本页基于当前源码已确认。

