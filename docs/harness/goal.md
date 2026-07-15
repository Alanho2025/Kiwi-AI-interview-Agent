# Kiwi Product Harness Goal

- 狀態：G2/M1 local shadow runtime 已實作；等待 Human Gate H1
- Product Owner approval：2026-07-15
- 第一個 implementation milestone：`interview_next_turn` shadow harness
- Execution mode：`shadow -> observe -> warn -> enforce`
- Canonical status page：本文件
- Current final verdict：G2/M1 `READY_FOR_HUMAN_VALIDATION`；G0 `NOT_VERIFIED`

本文件是完整 goal、sub-goal status、final result 與 evidence verdict 的單一 source of truth。詳細 spec/evidence 可以分檔，但每次狀態變更與最終結論必須回寫本頁。

## Goal

在不重寫現有 product controller、不改變合法輸出與 fallback 的前提下，為 Kiwi 的 CV-JD、question、interview、memory、report、QA 和 voice workflow 建立同一套可追蹤、可驗證、可回放、可治理的 product harness。

第一個工程目標不是完整 memory plane 或 report blocking，而是讓每個 `interview_next_turn` 都有可查詢的 `WorkflowRun`、context/action/gate/memory/failure correlation。這是後續 user-level adaptive memory、report publication gate 和 voice reliability 的共同基礎。

## Final Result You Can See

全部完成時，不同使用者應看到不同結果：

| Audience | 最後可看到的成果 | 不應看到的內容 |
| --- | --- | --- |
| Product Owner | 本頁的 final verdict、每個 sub-goal 狀態、before/after scorecard、未通過 gate 和 evidence links。 | 沒有證據的「已完成」宣稱。 |
| Developer | 可按 run/session/user/time 查詢的 redacted timeline；context/action/gate/state/memory/failure/latency 一頁可重建。 | 需要跨多個 `console.log`、collection 和 service 手動拼流程。 |
| Candidate | 更少同深度重複題、更合理的問題深度與 coverage、重要 progress summary、可信 report、不中斷的 voice flow。 | Internal action ranking、raw trace、failure detail、chain-of-thought。 |
| Reviewer/Eval | Frozen replay dataset、before/after diff、human calibration、gate false-positive/negative、rollback evidence。 | 只憑單次 demo 或 mock pass 判定 production ready。 |

M1 完成時 candidate 體驗應刻意保持不變。M1 的「更好」是 developer 更快、更準確地重建和定位 agent 行為，而且產品沒有 regression。第一個 user-visible improvement 在 M3 user memory，之後是 M4 report 和 M5 voice。

## Approved Product Decisions

1. Product harness 最終涵蓋全產品；不是每個使用 LLM 的 component 都是 agent。
2. V0 正式 task 是 `interview_next_turn`、`generate_report`、`qa_report`；`cv_jd_match`、`prepare_question_pool` 先建立 docs/shadow mapping。
3. 第一個 runtime slice 是 `interview_next_turn` shadow/observe；第一個候選 enforce slice 是 report QA。
4. Authority order 是 `policy/safety > controller > contract/gate > deterministic rule > model > wording`。
5. User-level memory 跨 session 影響 question planning、selection、depth、coverage 和 coaching；V0 `canAffectScoring=false`。
6. Report QA-only 不得 silent rewrite。Blocking result 進 `needs_review`；repair 必須是 explicit action 或 child run。
7. Context 採 refs/hash/version-first；只有必要 replay case 可保存 redacted snapshot。
8. Voice immediate confirmation 使用 same-run `waiting -> running`；失效或不可安全恢復才建立 child run。
9. Full run/span/gate/failure/memory detail 只給 developer；一般使用者只看重要、非技術性的 progress、evidence 和 next-step summary。

## Goal Tree

```text
G0  Kiwi product harness is verified better than the current baseline
|
+-- G1 / M0  Architecture and decision baseline
+-- G2 / M1  interview_next_turn shadow foundation
+-- G3 / M2  observed action/question/transcript/memory contracts
+-- G4 / M3  user-scoped adaptive interview memory
+-- G5 / M4  verified report publication gate
`-- G6 / M5  voice reliability and final cross-product release evidence
```

| Goal | Outcome | Mode | Depends on | Exit gate |
| --- | --- | --- | --- | --- |
| G0：Final product outcome | Developer 可重建 agent 行為；candidate 得到更深、更少重複、更可信且不中斷的體驗。 | governed | G1-G6 | Final scorecard 顯示所有必要 gate verified，無隱藏 production gap。 |
| G1 / M0：Architecture baseline | Boundary map、contract spine、pressure tests、decision register。 | docs-only | none | Current/target 與 approved/pending decision 分開。 |
| G2 / M1：Interview shadow foundation | 每個 `interview_next_turn` 有 queryable `WorkflowRun` 與七個 shared contract refs。 | shadow | G1 | Legacy parity、correlation、privacy、replay、debug benchmark、rollback。 |
| G3 / M2：Observed contracts | Action/question/transcript/memory gates 可觀測，不改合法 output。 | observe/warn | G2 | Violation 可分類；duplicate、fallback、voice confirmation 可 replay。 |
| G4 / M3：User interview memory | User-scoped contribution/projection，shadow/observe skip/deepen/switch。 | shadow/observe | G2-G3 | Provenance、applicability、freshness、revalidation、planner/evaluator isolation 與 user outcome。 |
| G5 / M4：Report publication gate | QA adapter 進 shared `GateResult`，只對驗證過的 critical rule enforce。 | shadow -> enforce | G2-G3 | QA parity、grounding、false-block、repair/version、rollback。 |
| G6 / M5：Voice and release evidence | Lightweight correlation/gates 接入 hot path，彙整跨產品 final evidence。 | observe/warn | G2-G5 | Reconnect、timeout、duplicate、latency、question counting、final release review。 |

## Live Goal Status and Evidence

狀態定義：`not_started`、`spec_review`、`in_progress`、`ready_for_human_validation`、`blocked`、`verified`。`ready_for_human_validation` 代表 local automated gates 已通過，但 human/browser/live/production evidence 仍待取得；只有所有適用 evidence gate 通過才能標 `verified`。

| Goal | Current status | 現在已有什麼 | 完成時 evidence artifact | Latest verdict |
| --- | --- | --- | --- | --- |
| G0 | `not_started` | Product direction 和 goal tree 已定義。 | `docs/harness/evidence/final-scorecard.md` | `NOT_VERIFIED` |
| G1 / M0 | `verified` | Boundary、spine、四 case pressure test、readiness audit、decision register；spec lint 通過。 | Current docs under `docs/further_plan/`、`docs/references/` | `VERIFIED_DOCS_ONLY` |
| G2 / M1 | `ready_for_human_validation` | Local shadow runtime、refs-only contracts、text/voice correlation、owner-scoped developer query、rollback、replay 與 deterministic debug proxy 已完成。 | [Shadow run sample](evidence/m1-shadow-run-sample.json)、[before/after replay](evidence/m1-before-after-replay.md)、[debug benchmark](evidence/m1-debug-benchmark.md)、[machine-readable replay](evidence/m1-replay-result.json) | `READY_FOR_HUMAN_VALIDATION` |
| G3 / M2 | `not_started` | Gate taxonomy 和 replay candidates 已定義。 | `m2-observed-contracts.md` | `NOT_RUN` |
| G4 / M3 | `not_started` | User-memory target/policy/replay cases 已定義。 | `m3-memory-outcomes.md` | `NOT_RUN` |
| G5 / M4 | `not_started` | Report QA adapter/gate boundary 已定義。 | `m4-report-publication.md` | `NOT_RUN` |
| G6 / M5 | `not_started` | Voice product contract 和 replay cases 已存在。 | `m5-voice-regression.md`、`final-scorecard.md` | `NOT_RUN` |

G2/M1 evidence 已產生並連結在本表。後續 milestone 的 artifact name 在檔案實際產生前仍只作 required output contract，不是假連結；不得只在聊天中宣稱完成。

## G2/M1 Evidence Verdict

| Gate | Evidence | Verdict |
| --- | --- | --- |
| Legacy output parity / rollback | Frozen deterministic fixtures 比較 harness OFF/ON；flag OFF 不進 harness path。 | PASS |
| Contract / correlation / privacy | 七個 shared contract view、same-run voice confirmation、memory source run correlation、refs/hash/version-only payload。 | PASS |
| Failure / duplicate / fail-open | Invalid model action fallback、duplicate canonical run、shadow persistence failure均有 deterministic scenario。 | PASS |
| Backend regression | Backend `npm run test:all`：15 groups、590 tests passed；backend lint passed。 | PASS |
| Frontend regression | Frontend `npm run quality:all`：52 files、301 tests、lint、production build passed。 | PASS |
| Replay | `npm run eval:harness-m1`：8/8 scenarios passed。 | PASS |
| Debug improvement | 5 個 fixed failure tasks 的 deterministic lookup proxy：correctness 100%，median 4.5232 ms -> 0.0005 ms，降低 99.99%。 | PROXY_PASS |
| Human/browser H1 | 實際 session 中，以 developer timeline 定位 action/fallback/memory/failure，並確認候選人體驗不變。 | PENDING |
| Live voice / production shadow | Real provider latency、production storage/access/retention telemetry。 | NOT_RUN |

`PROXY_PASS` 不是人類 developer 的 wall-clock benchmark。G2 在 H1 前不得升為 `verified`，也不得開始 M2/M3 promotion 或 enforce。

### Human Gate H1

1. 以 local app 完成至少一個 text interview turn；可再做一個低信心 voice confirmation turn。
2. 在同一登入 session 開啟 `/api/interview/harness-runs?sessionId=<SESSION_ID>`，確認只返回自己的 redacted timeline。
3. 只使用 timeline 回答：這一 turn 選了什麼 action、是否 fallback、state 如何改變、memory write 是否完成、failure owner 是誰。
4. 確認 candidate-facing response 沒有 internal gate、failure、memory trace，且問題、計數和 fallback 體驗未改變。
5. 將 human diagnosis time、正確性、異常與是否接受 M1 記錄回本頁；通過前保持 `ready_for_human_validation`。

## Before/After Verification Scorecard

所有 improvement 使用 frozen baseline 和同一組 inputs 比較：

```text
Baseline：current runtime / harness OFF
Treatment：target milestone / harness shadow-observe-warn-enforce
Comparison：product output + run/action/state + latency + failure + privacy + human review
```

| Outcome | Baseline | Pass target | Applicable goal |
| --- | --- | --- | --- |
| Legacy user-output parity | Current fixture output | 100% in M1 shadow | G2 |
| Run reconstructability | 目前要跨 logs/records 手動拼接 | Required run fields與 source lineage 100% | G2 |
| Deterministic failure attribution | 目前 failure semantics 分散 | Frozen failure fixtures 100% classified；unclassified 0 | G2-G3 |
| Debug task completion time | Deterministic proxy 已量測 4.5232 ms；human wall-clock baseline 待 H1 | Proxy 已降低 99.99%；H1 median 仍須至少降低 50% | G2 |
| Harness-introduced duplicate question | Current baseline | 0 | G2-G3-G6 |
| Internal trace exposed to candidate | Current baseline | 0 | G2-G6 |
| Same-depth repeat rate | M3 前 frozen repeated-session baseline | Eligible cases 至少降低 30% | G4 |
| Untouched competency coverage | M3 前 baseline | Eligible cases 至少提高 20% | G4 |
| Wrong suppression from stale/role-mismatched memory | 0-tolerance fixture set | 0 | G4 |
| Memory effect on matching/scoring | V0 baseline | 0 | G4 |
| Unsupported claim in publishable report | Current report replay baseline | 0 | G5 |
| Critical report QA false negative | Frozen critical fixture set | 0 | G5 |
| Voice duplicate countable question | Current voice replay baseline | 0 | G6 |
| Speech end -> first audio | Current/live baseline | Product contract `<= 3s`；不得被 harness 放寬 | G6 |

M3 的 30%/20% 是 initial target。M3 開工前必須先凍結 baseline、sample definition 和 human-review rubric；若 baseline 顯示門檻不合理，只能經 Product Owner 記錄理由後修改，不能在結果不佳時事後調低。

## Final Outcome Demo

G0 只有在 Product Owner 可以按以下順序查看結果時才可完成：

1. 用同一 interview fixture 分別執行 harness OFF/ON，candidate output 在 M1 完全一致。
2. 注入 invalid model action、duplicate event、orphan memory write、voice confirmation 和 shadow persistence failure。
3. Developer 只用一個 run timeline 找到 failure owner、fallback、state/memory side effects；和目前 log-debug baseline 比較時間。
4. 用 repeated-session fixtures 展示已證明能力停止同深度重問、轉向 coverage gap 或提高深度，且 scoring 不變。
5. 用 report fixtures 展示 unsupported claim 無法成為 publishable report，QA-only 不 silent rewrite。
6. 用 voice fixtures/live gate 展示 same-run confirmation、無雙題、非正式 turn 不計題且 latency 不退化。
7. 開啟本頁 final scorecard；每個 goal 有 evidence，未驗證的 live/production gate 清楚列出。

## V0 Success Criteria

- 一次 candidate turn 只對應一個 canonical `WorkflowRun`。
- State before/after、candidate/selected/fallback action、question/result、gate、memory write 和 failure 都能追到 source refs。
- Harness V0 不增加同步 model/tool call，不改 interview output、scoring、question count 或 fallback。
- Uncorrelated background write 不得靜默；在進 M3 前 orphan target 為 0。
- Candidate-sensitive payload 預設不複製；不保存 raw chain-of-thought。
- Developer 可按 run/session/user/time 查詢 redacted timeline；candidate API 不暴露 internal trace。
- 每次 mode 升級都有 deterministic replay、before/after parity、rollback 和未驗證邊界。

## Non-goals

- 不建立第二套 orchestration engine。
- 不把所有 service call 改成平級 agent/task。
- 不先做 dashboard 或 candidate-facing harness UI。
- 不在 V0 讓 cross-session memory 影響 matching/scoring。
- 不在沒有 replay evidence 時啟用 block。
- 不重寫現有 report QA、question dedupe、voice confidence 或 controller fallback。

## Remaining Product Decisions

- User memory promotion 需要幾個獨立 session、什麼 confidence/freshness/conflict threshold。
- Report QA 不同 severity 下的 candidate visibility、download/export 和 reviewer SLA。
- Gate 從 warn 進 enforce 的 false-block、latency regression 和 human-review cost threshold。
- User-safe progress summary 的第一個 UI placement。

## References

- [First milestone spec](spec.md)
- [Harness execution rules](AGENTS.md)
- [Product Harness Boundary Map](../further_plan/product-harness-boundary-map.md)
- [Product Harness Contract Spine](../further_plan/product-harness-contract-spine.md)
- [Contract Pressure Tests](../further_plan/product-harness-contract-pressure-tests.md)
- [Decision Questionnaire](../further_plan/product-harness-decision-questionnaire.md)
- [Pre-Harness Readiness Audit](../references/pre-harness-readiness-audit.md)
- [M1 Before/After Replay](evidence/m1-before-after-replay.md)
- [M1 Debug Benchmark](evidence/m1-debug-benchmark.md)

Evidence status：G2/M1 local automated evidence 已完成，狀態為 `ready_for_human_validation`。H1、live voice provider 與 production shadow 尚未驗證；G0 仍是 `NOT_VERIFIED`。Current runtime 以 source 和 `repo-docs/` 為準。
