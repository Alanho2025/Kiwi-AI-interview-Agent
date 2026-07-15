# Kiwi Product Harness Goal

- 狀態：G2-M4 local shadow/observe foundation 已執行；G5/M4 enforcement 與 G6/M5 live/latency gate 未完成
- Product Owner approval：2026-07-15
- 第一個 implementation milestone：`interview_next_turn` shadow harness
- Execution mode：`shadow -> observe -> warn -> enforce`
- Canonical status page：本文件
- Current final verdict：`LOCAL_HARNESS_FOUNDATION_COMPLETE_G0_NOT_VERIFIED`

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
| G0 | `in_progress` | G1-G6 local foundation、runtime slices、tests/evals 和 final scorecard 已執行；required human/live/production/product-decision gates仍開放。 | [Final scorecard](evidence/final-scorecard.md) | `LOCAL_HARNESS_FOUNDATION_COMPLETE_G0_NOT_VERIFIED` |
| G1 / M0 | `verified` | Boundary、spine、四 case pressure test、readiness audit、decision register；spec lint 通過。 | Current docs under `docs/further_plan/`、`docs/references/` | `VERIFIED_DOCS_ONLY` |
| G2 / M1 | `ready_for_human_validation` | 修復後 automated browser H1 已完成 harness OFF/ON 各兩個 voice turns、正式結束與 report 載入；ON 產生兩筆 completed/valid durable runs，四筆實際 memory writes 均 completed 且不可影響 scoring。真人麥克風、live provider 與 production shadow 尚未完成。 | [H1 transport evidence](evidence/m1-h1-voice-regression.md)、[H1 persistence/trace evidence](evidence/m1-h1-persistence-trace.md)、[Shadow run sample](evidence/m1-shadow-run-sample.json)、[before/after replay](evidence/m1-before-after-replay.md)、[debug benchmark](evidence/m1-debug-benchmark.md)、[machine-readable replay](evidence/m1-replay-result.json) | `AUTOMATED_H1_PASS_HUMAN_LIVE_PENDING` |
| G3 / M2 | `ready_for_human_validation` | Versioned observed gates/failures 已接到 interview run；8/8 replay pass；local config 不允許自行升 warn/enforce。 | [M2 evidence](evidence/m2-observed-contracts.md) | `LOCAL_OBSERVE_CONTRACTS_PASS` |
| G4 / M3 | `ready_for_human_validation` | User-scoped projection、applicability/freshness/conflict policy、planner/evaluator isolation與 5-case outcome eval 已完成；planning flag default off。 | [M3 evidence](evidence/m3-memory-outcomes.md) | `LOCAL_MEMORY_OUTCOME_GATE_PASS_DEFAULT_OFF` |
| G5 / M4 | `in_progress` | `generate_report`/`qa_report` 有 refs-only run 和 observed publication gate；17 critical flags false negative 0；enforcement off。Existing inline repair 尚不是 explicit child run。 | [M4 evidence](evidence/m4-report-publication.md) | `LOCAL_REPORT_OBSERVE_PASS_ENFORCEMENT_NOT_READY` |
| G6 / M5 | `in_progress` | Voice robustness 8/8、browser 2/2 turns、2 unique interview runs、report block observed；first audio 3390/2089 ms，1/2 SLO pass。 | [M5 evidence](evidence/m5-voice-regression.md) | `LOCAL_FUNCTIONAL_PASS_LATENCY_AND_LIVE_GATES_OPEN` |

G2-M5 evidence 和 [final scorecard](evidence/final-scorecard.md) 已產生。Local pass 不等於 production promotion；未通過的 gate 必須保留在本頁和 artifact。

## G2/M1 Evidence Verdict

| Gate | Evidence | Verdict |
| --- | --- | --- |
| Legacy output parity / rollback | Frozen deterministic fixtures 比較 harness OFF/ON；flag OFF 不進 harness path。 | PASS |
| Contract / correlation / privacy | 七個 shared contract view、same-run voice confirmation、memory source run correlation、最新 duplicate lesson provenance、refs/hash/version-only payload；backend trace 不含 owner/context/transcript/prompt。 | PASS |
| Failure / duplicate / fail-open | Invalid model action fallback、duplicate canonical run、shadow persistence failure均有 deterministic scenario。 | PASS |
| Backend regression | Backend `npm run test:all` 全部 15 groups / 628 tests passed；voice 84/84、contracts 57/57、agent 88/88、recording 17/17；backend lint passed。 | PASS |
| Frontend regression | Frontend `npm run quality:all`：56 files、309 tests、lint、production build passed。 | PASS |
| Replay | `npm run eval:harness-m1`：11/11 scenarios passed，包含 immediate redacted trace 與 repeated-memory latest provenance。 | PASS |
| Debug improvement | 5 個 fixed failure tasks 的 deterministic lookup proxy：correctness 100%，本次 median 4.5872 ms -> 0.0007 ms，降低 99.99%；精確值以 generated benchmark 為準。 | PROXY_PASS |
| Automated browser H1 | Harness OFF/ON 各完成兩個 voice turns、正式結束與 report 載入；ON 的兩筆 durable runs 皆 completed/valid，四筆實際 memory writes 皆 completed，candidate response 無 internal trace。此 run 使用 test STT/TTS 與 mock AI。 | PASS_SYNTHETIC_PROVIDER |
| Human microphone H1 | 修復後真人麥克風與實際 browser permission/session 操作。 | NOT_RUN |
| Live voice / production shadow | Real provider latency、production storage/access/retention telemetry。 | NOT_RUN |

`PROXY_PASS` 不是人類 developer 的 wall-clock benchmark。Automated browser H1 也不是真人麥克風或 live provider evidence。G2 維持 `ready_for_human_validation`；可繼續開發 M2/M3 的 local shadow/observe contract 與 replay，但在真人 H1、明確 approval 與各 milestone promotion gate 完成前，不得升為 `verified`、warn/enforce 或 production rollout。

### Human Gate H1

1. 在 `ENABLE_HARNESS_SHADOW=true` 的 local app 建立新 session，完成至少兩個 voice turns，再進 report；socket 必須在 `session_ready` 後才開始 VAD。
2. 每個 task 完成後先在 backend 看到 `Harness workflow trace` / `task_completed` / `queued`；背景 correlation 完成後再看到 `durable_persisted` / `persisted`。這兩筆 trace 都不得包含 owner ID、answer、question、prompt 或 context payload。
3. 在同一登入 session 開啟 `/api/interview/harness-runs?sessionId=<SESSION_ID>`；成功 turn 應最終出現 completed run，而 transport rejection 應出現 failed run，不得再無限卡在 `agent_thinking`。API 是 durable view，背景 queue 尚未完成時可短暫為空。
4. 若出現 `turn_rejected`，確認 UI 回到同一題的 repair state；該次 turn 不保存、不評分、不計題，failed run 包含 `voice_turn_rejected` 與 block gate。
5. 確認 recording upload 沒有因恢復後重用遠端 sequence 而產生 checksum conflict。
6. 只使用 backend trace + durable timeline 回答：這一 turn 選了什麼 action、是否 fallback、state 如何改變、memory write 是否完成、failure owner 是誰；所有實際列出的 memory writes 應為 `completed`，若本次產生三類 write 則三者都不得因重複 lesson 變成 orphan。
7. 確認 candidate-facing response 沒有 internal gate、failure、memory trace；將 diagnosis time、正確性、異常與是否接受 M1 記錄回本頁。

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
| Debug task completion time | Deterministic proxy 本次量測 4.5872 ms；human wall-clock baseline 待 H1 | Proxy 本次降低 99.99%；H1 median 仍須至少降低 50% | G2 |
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
- [M2-M5 milestone contract](milestones-m2-m5.md)
- [Final scorecard](evidence/final-scorecard.md)
- [Harness execution rules](AGENTS.md)
- [Product Harness Boundary Map](../further_plan/product-harness-boundary-map.md)
- [Product Harness Contract Spine](../further_plan/product-harness-contract-spine.md)
- [Contract Pressure Tests](../further_plan/product-harness-contract-pressure-tests.md)
- [Decision Questionnaire](../further_plan/product-harness-decision-questionnaire.md)
- [Pre-Harness Readiness Audit](../references/pre-harness-readiness-audit.md)
- [M1 Before/After Replay](evidence/m1-before-after-replay.md)
- [M1 Debug Benchmark](evidence/m1-debug-benchmark.md)
- [M1 H1 Persistence and Backend Trace](evidence/m1-h1-persistence-trace.md)

Evidence status：G2/M1、G3/M2、G4/M3 的 local shadow/observe evidence 已完成；G5/M4 observe adapter 通過但 explicit repair lineage/enforcement 未完成；G6/M5 local functional flow 通過但 3 秒 SLO、真人麥克風、live provider 與 production observe 未通過。G0 維持 `NOT_VERIFIED`。Current runtime 以 source 和 `repo-docs/` 為準。
