# Match critic agent

match critic agent 检查 CV-JD match result 是否过度乐观、缺少证据或硬要求错配。它是 guarded match loop 的 second opinion。

## 它在哪里被调用

critic 实现在 [match critic agent](../../backend/src/services/match/matchCriticAgent.js)，由 [guarded match service](../../backend/src/services/match/guardedMatchService.js) 调用。

## 一个代表 case

```text
输入: jdRubric + cvProfile + first matchResult
动作: critic review -> decide pass/revise -> optional recompare
输出: safeguard verdict、issues、reparseInstructions、finalStatus
边界: missing hard requirements 不应仍然得到 strong_match
```

## 它做什么决策

它不替代 matcher，只指出需要降低信心、移除无证据 strengths、或重跑 compare 的情况。mock mode 会走 heuristic fallback，方便本地 robustness tests。

## 输出和持久化

match safeguard 会附着在 match result 和 `matchingDetails.safeguard`，并随 match analysis record 被下游使用。

## 怎么检查

相关 tests 在 `backend/tests/robustness/match/guardedMatchHumanReviewRobustness.test.js`、`semanticEvidenceRobustness.test.js`、`preparationStabilityMatch.test.js`。

继续读 [match 与问题准备](feature-match-and-question-prep.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

