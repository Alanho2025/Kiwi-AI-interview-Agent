# Retrieval agent

retrieval agent 的职责是按当前 objective 找证据，而不是把所有 source 都盲目取回来。它先决定 sourceTypes，再分 session evidence 和 global knowledge，最后做 quality assessment 和 corrective retry。

## 它在哪里被调用

正式注册在 [agent registry service](../../backend/src/services/agentRegistryService.js)，实现位于 [retrieval agent](../../backend/src/services/agents/retrievalAgent.js)。底层检索复用 [RAG retrieval service](../../backend/src/services/ragRetrievalService.js)。

## 一个代表 case

```text
输入: query + sessionId + objective = COLLECT_REPORT_EVIDENCE
动作: selectRetrievalSources -> retrieveSessionEvidence -> assessRetrievalQuality
输出: items、sourceQuality、evidenceSummary、recommendedUses
边界: no results 或 low topic alignment 会 broaden query 并扩展 sources retry 一次
```

## 它做什么决策

objective 决定 source policy：报告取 match、transcript、prepared pool、JD、CV、decision；role-specific question 会取 JD、match、prepared pool 和 global banks；validation 会偏向 session evidence。

## 输出和持久化

retrieval agent 自身不直接写 DB。它返回 bundle 给 controller、interviewer 或 report generator 使用；索引和存储由 RAG index/retrieval services 负责。

## 怎么检查

`backend/tests/robustness/retrieval/retrievalRobustness.test.js` 检查 no result、low alignment、generic evidence 的 retry 建议。想看底层 embedding 和 fusion score，继续读 [RAG 检索层](rag-retrieval.md)。

证据状态：除特别标注外，本页基于当前源码已确认。

