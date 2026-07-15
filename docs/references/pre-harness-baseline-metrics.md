# Pre-Harness Baseline Metrics

狀態：selected mock focused verification 已完成；recorded/live/real AI baseline 尚未完成。

本文件定義進入 harness implementation 前要收集的 baseline。它不是 production dashboard；用途是避免升級後只靠感覺判斷 agent 是否變好或變壞。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[Pre-Harness Replay Fixtures](pre-harness-replay-fixtures.md)。

## 1. Baseline principles

1. 先用 mock/local tests 建 deterministic baseline。
2. 不把 real AI eval 當 routine audit step；除非明確批准成本與 credentials。
3. 每個 baseline 都要能回到 source area、test command、artifact 或 fixture。
4. baseline 不等於 target KPI。它是升級前的 current-state snapshot。

## 2. Metric matrix

| Area | Metric | Source/test candidate | Current status | Harness use |
| --- | --- | --- | --- | --- |
| Action selection | invalid/disallowed model action fallback | `backend/tests/robustness/agent/interviewControlRobustness.test.js` | 已確認（mock） | 確認 invalid allowed-action selection 回到 rule fallback。 |
| Action selection | fallback action rate | interview controller/action planner tests | 部分確認 | fallback 行為有測試；尚未產出 runtime aggregate rate。 |
| Question quality | duplicate question rejection | `backend/tests/robustness/questions/questionDeduplicationService.test.js` | 已確認（mock） | 防止 harness wrapper 造成重複提問。 |
| Question counting | repair/confirmation non-countable coverage | `backend/tests/robustness/questions/interviewQuestionCounting.test.js` | 已確認（mock） | 防止 repair prompt 被算成正式題。 |
| Report QA | QA pass/fail/blocking behavior | `backend/tests/robustness/report` | 已確認（mock） | 建立 publication gate regression baseline。 |
| Report grounding | unsupported high-confidence feedback blocked | report grounding/QA tests | 部分確認 | grounding/QA suite 通過；尚未有 production unsupported-claim rate。 |
| Retrieval | low alignment/retry/failure behavior | `backend/tests/robustness/retrieval` | 已確認（mock） | 建立 `retrieval_quality` regression baseline。 |
| Memory | session memory write shape | `backend/tests/robustness/agent/memoryGroundingAndPolicy.test.js` | 已確認（mock，legacy shape） | 確認 memory 仍只作 planning signal；不代表 provenance schema 已存在。 |
| Memory/retention | derived memory delete/retention coverage | `backend/tests/robustness/retention` | 部分確認 | retention framework 與 `UserCoachingMemory` index 有測試；derived-memory propagation 未直接驗證。 |
| Voice transcript | confirmation requested/resolved/rejected | `backend/tests/robustness/voice` | 已確認（mock） | 建立 transcript eligibility regression baseline。 |
| Voice latency | acceptance threshold behavior | `backend/tests/robustness/voice/voiceLatencyAcceptanceGate.test.js` | 部分確認 | acceptance gate 有測試；mock timing 不是 production p95。 |
| Trace | decision/trajectory/agentTrace event presence | agent trajectory tests | 部分確認 | trajectory evaluation 有測試；完整 workflow/span/event correlation 未驗證。 |

## 3. Commands selected for this audit

| Command | Purpose | Expected scope |
| --- | --- | --- |
| `npm run test:agent` | action planner、interview control、memory policy 局部 baseline。 | mock robustness tests。 |
| `npm run test:questions` | question counting、dedupe、prepared pool、question metadata baseline。 | mock robustness tests。 |
| `npm run test:report` | report QA、grounding、repair、candidate-facing report safety baseline。 | mock robustness tests。 |
| `npm run test:retrieval` | retrieval quality/retry/source safety baseline。 | mock robustness tests。 |
| `npm run test:voice` | transcript confirmation、voice latency、duplex flow baseline。 | mock robustness tests。 |
| `npm run test:retention` | deletion/retention framework baseline for derived records. | mock robustness tests。 |

## 4. Result log

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:agent` | PASS | `13 test files / 81 tests` passed；cover action fallback、interview control、trajectory evaluator、memory policy。 |
| `npm run test:questions` | PASS | `25 test files / 97 tests` passed；cover dedupe、non-countable repair、prepared pool、question metadata。 |
| `npm run test:report` | PASS | `17 test files / 86 tests` passed；cover QA、grounding、repair boundary、transcript risk。預期 warning 顯示 deterministic Role-Fit failure 不會被 wording repair 清掉。 |
| `npm run test:retrieval` | PASS | `10 test files / 32 tests` passed；cover retrieval robustness、runtime evaluator、grounding evaluator。 |
| `npm run test:voice` | PASS | `22 test files / 81 tests` passed；cover transcript confirmation、confidence gate、duplex flow、mock latency acceptance。 |
| `npm run test:retention` | PASS | `15 test files / 55 tests` passed；cover retention policy/saga/execution/index/audit/rollback。預期 stderr 驗證 PostgreSQL rollback failure 會被明確 surfaced。 |
| Aggregate | PASS | `102 test files / 432 tests` passed，全部使用 `NODE_ENV=test AI_TEST_MODE=mock`。 |

未執行 real AI eval、browser/live voice、production traffic 或真實 p95 latency measurement。這些結果是 deterministic local regression baseline，不是 production readiness 證明。

## 5. Baseline gaps that remain even if commands pass

| Gap | Why it remains |
| --- | --- |
| 沒有 full recorded-session replay dataset | group tests 能防 regression，但不能完整比較 before/after agent trajectory。 |
| 沒有 production p95 voice latency | mock tests 不能代表真實 STT/TTS/network。 |
| 沒有 shared gate artifact | tests pass 只證明局部行為，不能證明 harness read model ready。 |
| 沒有 memory provenance schema | tests 可能確認 legacy memory 行為，但不能補 provenance 缺口。 |
| 沒有 real AI eval result | mock baseline 不能證明 real model output distribution。 |
