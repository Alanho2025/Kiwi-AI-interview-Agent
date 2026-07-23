# Pre-Harness Trace Coverage

狀態：pre-harness coverage map 草案，不改變目前 runtime 行為。

本文件把現有可追蹤資料對照到 target harness read model。目標是回答：現在不是完全沒有 trace；問題是 trace 分散，缺 workflow/span/gate correlation，所以新 feature 只靠 `console.log` 已經不夠快。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[Pre-Harness Gate Taxonomy](pre-harness-gate-taxonomy.md)。

## 1. Current trace stores

| Current store | 狀態 | Source | Captures | Missing |
| --- | --- | --- | --- | --- |
| `decisionRecords` | 已確認 | [decisionRecordService](../../backend/src/services/aiControl/decisionRecordService.js)、[SessionAnalysis](../../backend/src/db/models/sessionAnalysisModel.js) | decision id、tool、record payload。 | workflow/span id、gate correlation。 |
| `trajectoryRecords` | 已確認 | [trajectoryService](../../backend/src/services/aiControl/trajectoryService.js) | selected/fallback/candidate actions、planner signals、generated question、evaluator。 | shared span schema、side-effect outcome。 |
| `agentTraceEvents` | 已確認 | [agentTraceService](../../backend/src/services/aiControl/agentTraceService.js) | event type、mode、payload、latency breakdown。 | stable event taxonomy、span correlation、gate refs。 |
| `reportArtifacts` | 部分確認 | `SessionAnalysis` report artifacts + SessionReport。 | report/QA/repair artifacts。 | publication gate read model。 |
| `evaluatorRecords` | 部分確認 | interview evaluator writes. | latest evaluator outcome。 | direct mapping to task/action gate not standardized。 |
| `reflectionRecords` / memory | 部分確認 | reflection/user memory services。 | coaching memory signals。 | provenance and scoring boundary. |

## 2. Target read model mapping

| Target | Current candidates | Coverage status | First adapter |
| --- | --- | --- | --- |
| `AgentEpisode` | session id + task type + mode | 未確認 | Derive from `runTask` invocation and SessionAnalysis records. |
| `WorkflowRun` | one `interview_next_turn` or `generate_report` execution | 未確認 | Shadow id in task-level wrapper, no new collection first. |
| `ExecutionSpan` | trajectory step, retrieval step, report QA step | 部分確認 | Map `trajectoryRecords` to action span and retrieval/report events to spans. |
| `AgentEvent` | `agentTraceEvents`, decision records | 部分確認 | Normalize event type and attach `workflowRunId` / `spanId`. |
| `GateResult` | report QA flags, action allowed check, transcript confirmation | 部分確認 | Adapter from report QA first. |
| `MemoryWrite` | session `agentMemory`, `UserCoachingMemory` updates | 未確認 | Shadow envelope with source refs. |

## 3. Trace completeness checklist

| Requirement | 狀態 | Current state |
| --- | --- | --- |
| Can answer “why did agent choose this action?” | 部分確認 | trajectory has selected/fallback/candidate actions and rationale signals. |
| Can answer “what evidence was used?” | 部分確認 | retrieval/report/question metadata has evidence refs, but not unified. |
| Can answer “which gate blocked publication?” | 部分確認 | report QA flags exist; shared gate result missing. |
| Can answer “did model violate allowed action boundary?” | 部分確認 | selector returns fallback error; not persisted as gate event consistently. |
| Can answer “which memory write affected this turn?” | 未確認 | memory has no per-write provenance. |
| Can answer “did a retry create duplicate action?” | 需要測試 | duplicate/retry replay not established. |
| Can answer “where was latency spent?” | 部分確認 | latency breakdown exists; p95 baseline and failure threshold missing. |

## 4. Minimum trace fields for first harness slice

```json
{
  "workflowRunId": "string",
  "taskType": "interview_next_turn",
  "sessionId": "string",
  "startedAt": "ISO-8601",
  "status": "running | completed | failed | review | degraded",
  "spans": [
    {
      "spanId": "string",
      "spanType": "retrieval | action_planning | model_selection | action_execution | qa | memory_write",
      "status": "completed | failed | skipped | degraded",
      "sourceRecordRefs": []
    }
  ],
  "gateResults": [],
  "sideEffects": []
}
```

## 5. Console log boundary

只靠 `console.log` 不足的情境：

| Debug question | 為什麼 log 不夠 |
| --- | --- |
| 為什麼這一輪問了這題？ | 需要同時查 retrieval、decision context、candidate actions、model/fallback、question metadata。 |
| 為什麼 report 被標 needs review？ | 需要 QA flags、blocking set、repair history、evidence refs。 |
| 為什麼 voice 變慢？ | 需要 stt/retrieval/planning/model/tts timing，不是單點 log。 |
| memory 是否影響 scoring？ | 需要 memory read/write provenance 和 policy gate。 |
| retry 是否造成雙題？ | 需要 idempotency key、span correlation、transcript/question side effects。 |

## 6. Audit carry-back

Trace/observability readiness 維持 **部分確認**。已有可用原始資料，但缺 formal read model 和 correlation；下一步應先做 adapter/coverage map，不應先大改 persistence schema。
