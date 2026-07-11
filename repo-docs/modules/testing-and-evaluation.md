# 测试与 evaluation 版图

测试策略偏向 robustness、fallback 和 workflow contract，而不是只证明 happy path 能跑。原因很直接：这个系统最容易出错的地方是 parser drift、unsupported evidence、question repetition、voice transcript uncertainty、report grounding 和 ownership boundary。

## 一个代表 case

```text
目标: 确认 repair prompt 不算正式问题
测试位置: backend/tests/robustness/questions/interviewQuestionCounting.test.js
原因: voice/text repair 如果误计数，会提前结束访谈并污染 report dataset
```

## Backend checks

| 命令 | 覆盖意图 |
| --- | --- |
| `npm run test:questions` | question pool、dedupe、ranking、turn orchestration、metadata |
| `npm run test:report` | report dataset、QA、grounding、rewrite、score consistency |
| `npm run test:voice` | duplex voice、confidence gate、provider router、latency guard |
| `npm run test:retrieval` | embedding/retrieval payload、quality assessor、retrieve-for-turn |
| `npm run test:all` | package script 里的 integration + robustness groups |
| `npm run eval:local` | mock-safe deterministic evals |
| `npm run eval:real` | real provider-backed evals，需要 credentials 和成本批准 |
| `npm run eval:retrieval` | 共用 production fusion ranker 的 synthetic ranked retrieval + claim grounding |
| `npm run eval:agent-trajectory` | 正式 planner/tool mapping/trajectory builder contract |
| `npm run eval:role-fit-v2-adversarial` | Role-Fit Closed Loop v2 的 12-case mock-safe adversarial coverage gate |
| `npm run eval:calibration` | human-vs-judge disagreement；未完成人工 review 时禁止数值 threshold |

## Frontend checks

| 命令 | 覆盖意图 |
| --- | --- |
| `npm run test:all` | hooks、utils、components、API wrapper |
| `npm run test:voice` | voice panel、voice session hook、VAD、latency trace |
| `npm run test:e2e:question-pipeline` | browser-level question pipeline flow |
| `npm run test:e2e:recording-recovery` | IndexedDB/background upload recovery |
| `npm run quality:all` | lint + tests + build |

## Eval runners

`backend/eval/runners` 覆盖 CV parse、JD parse、SEEK benchmark、CV-JD match、interview controller、report QA、baseline comparison、retrieval、agent trajectory、Role-Fit v2 adversarial、human calibration、company research、voice quality、stability、preparation stability 和 voice robustness。runtime retrieval/trajectory 与舊 safety fixture 有獨立命令和報告，避免把 0.97 fixture score 當成真實 retriever 品質。Role-Fit v2 adversarial runner 只檢查本地 deterministic coverage，並固定 production claim 被 human calibration blocker 擋住。它們適合回答「這個版本化 local contract 是否退化」，不是普通代碼改動的預設測試，也不是未經人工校準的 production release 結論。

## 为什么这样测

| 风险 | 测试为什么存在 |
| --- | --- |
| JD parse 把 marketing text 当 hard requirements | safeguard 和 SEEK regression tests 抓 field drift |
| prepared questions 重复问同一 assessment | dedupe/ranker/runtime tests 抓 assessment key 与 fingerprint |
| voice low-confidence answer 被直接评分 | confidence gate 和 transcript confirmation tests 抓产品契约 |
| report 高分但证据不支持 | report QA/grounding tests 抓 evidence totals、rubric mismatch、rewrite safety |
| recording 丢 chunk 或重复上传 | resumable upload tests 抓 idempotency、checksum、missing chunk |

继续读 [source evidence](../references/source-evidence.md)，看本指南引用了哪些测试和源码。

证据状态：除特别标注外，本页基于当前源码已确认。
