# E2E Refine Implementation Goal

狀態：final goal mode；已實作並以本地 hybrid E2E gate 驗證
日期：2026-07-12
對照來源：[E2E 測試差距分析](e2e-testing-gaps-analysis.md)、[語音轉寫校準計畫](voice-transcript-calibration-plan.md)、[候選人成長追蹤計畫](candidate-progress-tracking-plan.md)
對應 spec：[E2E Refine Implementation Spec](e2e-refine-implementation-spec.md)

## 文件定位

這份 goal 不是要重寫所有 E2E，也不是把 mock 全部拿掉。它的目標是把目前偏「前端流程與 mock visual」的 E2E，補成 stakeholder 能信任的 hybrid E2E release gate：保留快速 mock visual tests，同時新增少量真後端、真資料狀態、真 WebSocket 和可量測 artifact 的高風險路徑。

## 實作結果摘要

本 goal 已作為 final goal 推進完成。實作後新增四條可重跑 E2E refine scripts，並新增 backend aggregate release gate：

- Review lock bypass：`frontend/e2e/review-lock-bypass.playwright.mjs`。未 verified Role-Fit input 直接打 `/api/analyze/match` 會被現有 review contract 擋成 `409 Role-fit review conflict`；繞過 match 直接拿 `manual_review` payload 打 `/api/analyze/interview-plan` 會被新增的 `matchPlanGateService` 擋成 `400`，不會產生 usable plan/session。
- Low-confidence voice UI：`frontend/e2e/voice-low-confidence-ui.playwright.mjs`。真 frontend + 真 backend WebSocket + test STT/TTS provider；contentful low-confidence transcript 會顯示 `Please confirm what KiwiCoach heard`，題號不前進，且不產生 `turn_done`。
- Retention/deletion lifecycle：`frontend/e2e/retention-deletion-lifecycle.playwright.mjs`。test DB synthetic session/CV soft delete 後，API/report/export/match reuse 都被拒絕；browser route 的 access-denial 結果允許 `Session not found.` 或 redirect `/analysis`，因為兩者都代表使用者無法再讀取 deleted session。
- Weak network + barge-in voice：`frontend/e2e/voice-network-barge-in.playwright.mjs`。CDP bounded slow network 下跑真 backend duplex voice；實作時發現 backend duplex socket queue 會把 `barge_in` 排在 TTS streaming 後面，已修成 interrupt control message 可繞過一般序列隊列，E2E 現在觀察到 `barge_in_ack.interrupted === true`。
- Aggregate gate：`backend/eval/helpers/e2eRefineReleaseGateEvaluator.js` + `backend/eval/runners/runE2eRefineReleaseGateEval.js`，輸出 `backend/eval/reports/e2e-refine-release-gate.latest.{json,md}`。最新狀態是 `ready_with_known_issues`；release blockers 為 none；known issue 為 `voice_next_question_3s_slo_exceeded`。

## 現況摘要

目前已完成的 E2E / eval 能力：

- `frontend/e2e/specs/full-interview-human-flow.spec.js`：完整前端 happy/degraded flow，但大量 API mock。
- `frontend/e2e/specs/question-pipeline.spec.js`：browser-level question pipeline flow，但仍是 mock API。
- `frontend/e2e/specs/role-fit-browser-visual.spec.js`：Role-Fit report visual gate，會產出 desktop/mobile screenshots。
- `frontend/e2e/voice-realtime-latency.playwright.mjs`：mock WebSocket / mock voice browser smoke。
- `frontend/e2e/voice-real-backend.playwright.mjs`：真 backend + test STT/TTS provider 的 duplex voice browser flow，latest artifact 通過，但 `nextQuestionFirstAudioMs` 約 4415ms，3 秒 SLO 是 known issue。
- `frontend/e2e/recording-recovery.playwright.mjs`：browser IndexedDB recording upload recovery，但 backend API 是 mock。
- `backend/eval/reports/role-fit-release-gate.latest.json`：目前 release status 是 `ready_with_known_issues`；calibration、adversarial、cutover/retention source contract、browser visual、voice flow pass；voice 3 秒 SLO 超標是唯一 known issue。
- Backend 已有多個 robustness groups：low-confidence transcript confirmation、turn counting、guarded match review、retention policy / cleanup services 等；retention robustness 已決定納入 backend `test:all`，但仍不是 browser/API lifecycle E2E。

## further_plan 對照結論

| further_plan gap | 現在已補到哪裡 | 仍需要修改 |
| --- | --- | --- |
| API mocks 掩蓋 RAG / AI / scoring regression | Backend `eval:retrieval`、`eval:role-fit-v2-adversarial`、`eval:calibration` 和 Role-Fit release gate 已補 local deterministic evidence；browser visual 仍主要驗渲染 | 新增 hybrid E2E：用真 backend API / test DB seed 跑 review lock、match/plan/report access 的關鍵路徑；browser E2E 不直接承擔 real LLM quality |
| Retention / deletion 缺 E2E | Backend 有 retention robustness tests，並納入 `test:all`；Role-Fit release gate 只宣稱 local source/model/registry contract，`productionTelemetryAvailable=false` | 新增 test DB + tmp file storage 的 retention/deletion lifecycle E2E；保留 `test:retention` 作 focused gate |
| Low-confidence STT repair UI 未驗證 | Backend voice tests 已驗證 confidence gate、confirmation、不計題數；frontend unit tests 有 voice hook coverage | 新增 browser E2E：test STT confidence 低但 transcript contentful，UI 顯示 confirmation，題號不前進；確認後才保存 accepted answer |
| 弱網 / barge-in 缺實網驗證 | real-backend voice E2E 已跑 through backend socket；barge-in 有 backend/frontend unit tests | 新增 CDP network emulation + barge-in E2E；3 秒 SLO 仍可 known issue，但 flow 不可 crash、不可卡死、不可把 interrupted/system turn 算題 |
| Locking bypass 未驗證 | Frontend happy path 會點 Mark CV/JD reviewed；backend service tests 擋 legacy review marker | 新增 hybrid E2E：繞過前端直接 POST `/api/analyze/match` / `/api/analyze/interview-plan`，未 verified Role-Fit / CV review 必須被拒絕或回傳 safe manual-review response |

`candidate-progress-tracking-plan.md` 是新產品面板計畫，沒有現成 E2E refine 需求；本 goal 不實作 progress dashboard。若後續真的做成長追蹤功能，應另開 progress dashboard goal/spec 和對應 E2E。

`voice-transcript-calibration-plan.md` 中的 N-Best rerank、LLM 即時糾錯、offline deep transcript cleanup 是產品功能，不納入本輪 E2E refine 實作。本輪只補 E2E baseline：低信心 transcript UI、artifact、turn counting、future calibration 可回歸的測試入口。

## 目標

建立一組可重跑、可產出 artifact、能清楚分辨 mock / hybrid / real-backend scope 的 E2E refine gate，讓 release reviewer 可以回答：

1. 如果使用者繞過前端，review lock 是否仍有效？
2. 如果 STT 低信心但內容充足，candidate 看到的是澄清/確認，而不是被扣分或跳題？
3. 如果 session / CV / recording 被刪除或過期，資料與讀取權限是否在 test DB 中一致收斂？
4. 如果 voice 遇到弱網或 barge-in，系統是否保持可恢復狀態並產出 latency / interruption artifact？
5. 哪些 E2E 是 visual mock，哪些是真後端，哪些仍需要 live provider / production telemetry？

## 非目標

- 不把所有 Playwright tests 改成真 backend；visual / layout / regression tests 仍應保留 mock。
- 不新增 Azure / ElevenLabs / real microphone live provider gate；本輪使用 test STT/TTS providers。
- 不宣稱 GDPR / CCPA / production deletion compliance；只驗證 test DB / tmp storage lifecycle。
- 不引入新的 E2E framework 或新的 dependency，除非另行批准。
- 不實作 candidate progress dashboard。
- 不實作 N-Best rerank、LLM transcript correction 或 offline ASR cleanup。
- 不把 voice 3 秒 next-question SLO 變成本輪 blocker；它仍是 known issue，但 flow 必須跑。

## Phase Plan

| Phase | Scope | Done when |
| --- | --- | --- |
| E2E-R0 | E2E truth-level inventory + artifact contract | 現有 E2E 被分成 `mock_visual`、`hybrid_backend`、`real_backend_voice`、`live_provider_required`；artifact schema 定義完成 |
| E2E-R1 | Review lock bypass hybrid E2E | 未 reviewed / 未 verified Role-Fit 的 direct API match/plan request 被擋；verified path 可繼續 |
| E2E-R2 | Low-confidence voice repair browser E2E | contentful low confidence transcript 顯示 confirmation；題號不變；確認後才進 accepted answer 和下一題 |
| E2E-R3 | Retention / deletion lifecycle hybrid E2E | test DB seed 的 session/CV/recording artifacts 被 soft delete 或 cleanup 後，API/UI 不能再讀敏感資料 |
| E2E-R4 | Weak network + barge-in voice E2E | CDP 弱網下 voice flow 有 artifact；barge-in ack / audio stop / no question count pollution 被驗證 |
| E2E-R5 | Aggregated E2E refine release gate | 新 artifact 被 aggregator 聚合；missing non-SLO artifact blocks；voice 3 秒超標仍列 known issue |

以上 phase 均已完成 first slice。E2E-R2 的「確認後才進 accepted answer」保留在 backend robustness / transcript-confirmation tests 內驗證；本輪 browser E2E 鎖定更高風險的第一步：低信心內容不得直接被接受或跳題。E2E-R3 不跑 production cleanup saga，只跑 test DB soft delete + access denial；cleanup saga 仍由 backend retention robustness scripts 覆蓋。

## Definition of Done

1. 新增或更新的 E2E scripts 都能在本地 test env 以 synthetic data 執行。
2. 每個 E2E script 都輸出 `output/playwright/*.latest.json`，包含 schemaVersion、passed、scope、assertions、knownIssues、browserErrors。
3. Release gate 能區分：
   - blocker：review lock bypass、retention/deletion 失敗、low-confidence UI 錯誤、barge-in 卡死、artifact missing。
   - known issue：voice next-question first audio 超過 3000ms。
   - external：live Azure/ElevenLabs、production telemetry、real provider semantic judge。
4. `frontend/package.json` 和 `backend/package.json` 有清楚 scripts；不需要記住 ad hoc command。
5. Docs 更新：
   - `docs/further_plan/e2e-refine-implementation-goal.md`
   - `docs/further_plan/e2e-refine-implementation-spec.md`
   - `repo-docs/modules/testing-and-evaluation.md`
   - `repo-docs/references/source-evidence.md`
   - `repo-docs/change-log.md`
6. Verification 至少包含：
   - focused backend robustness tests for changed service area
   - new frontend E2E scripts
   - frontend lint
   - backend lint
   - `git diff --check`
   - spec lint

## Open Decisions

1. Retention/deletion E2E：已決定 first slice 驗 soft delete + access denial；完整 retention cleanup saga 維持在 backend robustness / cleanup scripts，不宣稱 production compliance。
2. Review lock bypass：已固化為產品結果「不產生 usable match / plan」。目前實作 contract 是 unverified match `409`；manual-review plan bypass `400`；verified path `200`。
3. 弱網 E2E：bounded CDP slow network 已納入 `npm run test:e2e:role-fit-refine` aggregate；packet loss / live provider 仍是 optional diagnostic。
4. Retention robustness group 已加入 backend `npm run test:all`；仍保留 `npm run test:retention` 作 focused command。

## Review Checklist

- 已保留「voice 要跑，但 3 秒 SLO 是 known issue」：aggregate gate 會列 `voice_next_question_3s_slo_exceeded`，但不列 release blocker。
- 已確認 E2E 不直接驗 real LLM quality：real semantic / provider quality 仍由 backend eval、manual calibration、real-provider eval gate 承擔；本 E2E gate 驗產品 contract 和資料/狀態流。
- 已確認 retention first slice 不宣稱 production compliance。
- 已確認 candidate progress dashboard 和 transcript calibration product work 另開 goal。
