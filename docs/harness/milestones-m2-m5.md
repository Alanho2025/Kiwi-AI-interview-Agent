# Product Harness M2-M5 Milestone Contract

- 狀態：本地 implementation/eval 已執行；promotion gate 未全部通過
- Authority：`policy/safety > current controller > observed contract/gate > deterministic rule > model > wording`
- Runtime coverage：`interview_next_turn`、`generate_report`、`qa_report`
- Docs/shadow mapping only：`cv_jd_match`、`prepare_question_pool`
- Default behavior：harness、user memory planning、publication enforcement 均不得預設改變 candidate behavior

本文件補上 [M1 spec](spec.md) 之後的 milestone contract。它記錄已實作的本地範圍、可重跑證據與 promotion 前的 hard gates；不是 production rollout approval。

## Milestone status

| Milestone | Local implementation | Default runtime | Local evidence | Promotion blockers |
| --- | --- | --- | --- | --- |
| M2 observed contracts | 已完成 | `shadow`；允許 local `observe` | [M2 evidence](evidence/m2-observed-contracts.md) | human H1、production observe、warn/enforce approval |
| M3 user interview memory | 已完成，flag default off | 只有 `observe` + memory flag 才可影響 planning | [M3 evidence](evidence/m3-memory-outcomes.md) | threshold/user control/source delete/human repeated sessions/production observe |
| M4 report publication | observe adapter 已完成 | 不 enforce、不改 candidate visibility | [M4 evidence](evidence/m4-report-publication.md) | false-block calibration、explicit repair child-run、visibility policy、enforcement approval |
| M5 voice/release evidence | local functional evidence 已完成 | 無新 warn/enforce | [M5 evidence](evidence/m5-voice-regression.md) | 3 秒 SLO、human mic、live provider、production observe |

## M2: observed contract semantics

每個 observed run 必須使用 versioned `GateResult` 和 `FailureClassification`。Local config 只接受 `shadow` / `observe`；`warn` / `enforce` 不能透過環境值自行升級。

```text
input: current controller observation
gates: action allowed + question counting + novelty + transcript eligibility + memory policy
output: refs-only WorkflowRun
authority: current controller result is returned unchanged
```

正確拒絕 duplicate candidate 是 pass；真的選到 duplicate 才是 observed violation。Voice confirmation 只 block scoring，不得被算成正式問題。Model action invalid/error 必須保留 bounded fallback lineage。

## M3: user-scoped interview memory

Projection 只從該 user 已有的 `SessionAnalysis.trajectoryRecords` 重算，並只把 refs/derived status 寫進目前 session 的 `agentMemory.userInterviewProjection`。不新增 raw answer/question 長期副本。

| Policy | Current local rule |
| --- | --- |
| Promotion evidence | 至少 2 個獨立 sessions |
| Freshness | 90 天 |
| Applicability | role、competency、question family 必須相容 |
| Conflict | stale/conflicting evidence 進 revalidation，不 suppress |
| Allowed effect | question planning、selection、depth、coverage |
| Forbidden effect | matching、answer evaluation、report scoring |

`ENABLE_USER_INTERVIEW_MEMORY_PLANNING=false` 是預設。只有 harness 開啟、execution mode 為 `observe` 且 memory flag 明確開啟時，planner 才可 switch/deepen。這個 default-off slice 尚未取得 user controls、source-delete invalidation 與真人 repeated-session evidence。

## M4: report publication observe gate

`generate_report` 與 `qa_report` 都建立 refs-only run。QA adapter 將現有 `qaResult` 映射為 shared publication gate：

| QA outcome | Observed gate | Harness publication status | Enforced |
| --- | --- | --- | --- |
| pass | `pass` | `ready` / `ready_after_repair` | no |
| critical flag | `block` | `needs_review` | no |
| other failed QA | `review` | `needs_review` | no |

`qa_report` 只執行 QA，不 silent rewrite。現有 `generate_report` 仍有 bounded inline wording repair；harness 會記錄 `legacyInlineRepairObserved=true`、`explicitChildRunsComplete=false`。在 repair 轉為 explicit action/child run、false-block calibration 和 candidate visibility policy 決定完成前，不得進 enforcement。

## M5: voice and final release evidence

Automated browser H1 使用真實 frontend/backend/WebSocket，但 AI 是 mock、STT/TTS 是 test provider。最新兩 turn 都完成並有兩個唯一 canonical interview runs；report run 也產生 publication gate。First-audio latency 是 `3390 ms`、`2089 ms`，只有 1/2 達到 `<= 3000 ms`，所以 M5 release gate 未通過。

CV-JD match 和 question-pool preparation 本輪只有既有 workflow mapping 與全套 regression coverage，沒有新增正式 `WorkflowRun` runtime。Final scorecard 不得把它們列為 runtime harness complete。

## Rollback and promotion

| Surface | Rollback | Promotion requirement |
| --- | --- | --- |
| M1/M2 run recording | `ENABLE_HARNESS_SHADOW=false` | production observe evidence + explicit approval |
| M3 planning | `ENABLE_USER_INTERVIEW_MEMORY_PLANNING=false` | product policy、user control、human outcome evidence |
| M4 publication | current controller status remains authority | visibility/download/export policy + false-block evidence + explicit enforcement approval |
| Voice | no harness-specific hot-path flag promotion | live provider SLO + human microphone + reconnect/timeout evidence |

任何 rollback 都不能改寫既有 source retention/deletion semantics。Warn/enforce、candidate visibility、memory scoring、raw snapshot allowlist 和 voice hot-path heavy work仍是 approval hard stop。

## Verification commands

```bash
cd backend
npm run test:all
npm run eval:harness-m1
npm run eval:harness-m2
npm run eval:harness-m3
npm run eval:harness-m4
npm run eval:harness-m5

cd ../frontend
npm run quality:all
npm run test:e2e:harness-h1-voice
```

Real AI eval、human microphone、live speech provider 和 production observe 不包含在上述 mock-safe local commands。
