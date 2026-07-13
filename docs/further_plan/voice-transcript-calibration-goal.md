# Voice Transcript Calibration Goal

狀態：goal mode；first deterministic implementation slice completed locally
日期：2026-07-13 Pacific/Auckland
對應 spec：[Voice Transcript Calibration Spec](voice-transcript-calibration-spec.md)
關聯文件：[Stakeholder Feature Conflict Guardrails](../stakeholder-feature-conflict-guardrails.md)、[Voice Calibration Stakeholder Brief](../voice-transcript-calibration-stakeholder-brief.md)、[Voice Product Behavior](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md)

## 文件定位

這份 goal 把語音轉文字校準收斂成可審查的產品目標。它現在已被設定成 goal mode，並完成第一個 deterministic backend slice。

後續任何擴充仍必須先完成 guardrail gate，再拆 technical slices。原因是這個 feature 會碰到 candidate fairness、transcript truth、report evidence、voice latency 和 CV/JD privacy；如果先做技術，很容易把「修系統聽錯」做成「美化使用者答案」。

## Goal Mode Implementation Status

本輪 goal mode 只完成保守的後端 first slice：

- `speechPhraseHintService` 從 existing CV/JD/profile/plan 產生 source-aware contextual glossary，仍保留最多 120 個 provider phrase hints。
- `transcriptCalibrationService` 新增 dependency-free calibration：保留 raw transcript，只在 provider N-best 近似置信且文字差異 bounded 時做 term-level rerank。
- Azure realtime STT、ElevenLabs realtime STT fallback、test realtime STT 都會產生同一份 `transcriptCalibration` / `nbest` metadata。
- Duplex voice transcript aggregation 和 accepted turn metadata 會保存 calibration provenance，讓 report/scoring 後續能區分 spoken answer、static normalization、N-best rerank 和 CV/JD vocabulary context。
- Backend tests 鎖住 CV/JD 不可補成 spoken evidence、provider 沒有 N-best 時安全 fallback、static normalization 不覆蓋 raw transcript。

本輪刻意沒有做：

- 沒有 LLM transcript rewrite。
- 沒有新增 provider、dependency、embedding、paid eval 或 real-AI call。
- 沒有把 raw CV/JD 暴露到 client、log、prompt 或 analytics。
- 沒有新增 frontend transcript review UI。
- 沒有讓 offline cleanup 靜默覆蓋 live accepted transcript 或 scoring evidence。

目前驗證結果：

- `NODE_ENV=test AI_TEST_MODE=mock npx vitest tests/robustness/voice/voiceTranscriptCalibrationService.test.js tests/robustness/voice/realtimeVoiceTurnMocked.test.js --run`：2 files / 9 tests passed。
- `npm run test:voice`：21 files / 71 tests passed。
- `NODE_ENV=test AI_TEST_MODE=mock npx vitest tests/unit/transcriptNormalizer.test.js --run`：1 file / 17 tests passed。
- `npm run lint`：backend lint passed。

## Guardrail-First 原則

所有 voice transcript calibration plan 必須先寫並核對 guardrails，再進入 SDD implementation。

最小 guardrail gate：

1. 確認 calibration 只修 transcript，不修答案品質。
2. 確認 CV/JD 只能當詞彙 context，不能當 spoken answer source。
3. 確認 contentful low-confidence transcript 不直接評分、不直接丟棄。
4. 確認 repair、confirmation、clarification 不計入 interview question count。
5. 確認任何重型 extraction、LLM correction、embedding/rerank 不進入 `speech_end -> next audio` 3 秒 hot path。
6. 確認 raw transcript、corrected transcript、correction reason、source evidence 都可審計。
7. 確認 raw CV/JD 不因方便被暴露到不必要的 client path、logs、prompts 或 analytics。

如果任一項無法成立，feature 必須退回 goal/spec 討論，不進 code。

## 背景問題

Voice interview 的下游評分、follow-up question 和 report 都依賴 transcript。當 STT 因為口音、重音、專有名詞、acronym、公司名、工具名而聽錯時，系統可能錯判 candidate 沒有講到關鍵 evidence。

這不是 candidate answer quality 問題，而是 system understanding quality 問題。產品必須避免讓非母語、不同口音或專業詞較多的使用者被不公平扣分。

## 目前已有基礎

目前專案已經具備後續 calibration 可使用的資料與保護機制：

- CV upload 會抽出並保存 `rawText`、`normalizedText`、`cvProfile`、`displayProfile`。
- JD flow 會保存 `rawJD`、structured JD、JD rubric、parsed JD profile。
- Session analysis 會保存 parsed CV/JD profile、matching details、interview plan 和 question hints。
- Voice STT session start/restart 時會用 `speechPhraseHintService` 從 session analysis、CV profile、JD rubric 和 interview plan 產生最多 120 個 phrase hints。
- Speech confidence gate 已定義：low confidence 是 system understanding issue，不是 answer quality。
- Product latency target 是 `user speech end -> next question first audio <= 3 seconds`。

因此新 goal 不是從零開始做詞庫，而是把既有 dynamic phrase hints 升級成更可控、可審計、可驗證的 contextual calibration system。

## 目標

建立一套 guardrail-first 的 voice transcript calibration capability，讓 Kiwi 能在不美化 candidate answer 的前提下，提高專有名詞、role-specific terms、CV/JD terms、technical acronyms 的轉寫可靠度。

這套能力要讓 stakeholder 可以回答：

1. 使用者是否因為口音或 STT 誤聽被錯誤扣分？
2. 系統是否只修正「聽錯的詞」，而不是替使用者補 evidence？
3. CV/JD 是否只用作 contextual vocabulary，而不是自動補答案？
4. 每個 correction 是否能說明為什麼改、根據什麼改、何時需要使用者確認？
5. 新功能是否仍守住 3 秒 voice latency target？
6. Report 是否能區分 spoken evidence、CV/JD context、model inference、user-confirmed correction？

## 非目標

- 不建立大型全職業固定 glossary。
- 不把 CV/JD facts 自動塞進 candidate spoken answer。
- 不用 LLM 對整段 transcript 做自由改寫或潤飾。
- 不把 `confidence < 0.85` 當作全量 LLM rewrite trigger。
- 不在 speech end 後全量掃 CV/JD、跑 heavy extraction、或做 unrestricted semantic correction。
- 不把 offline deep cleanup 的結果靜默覆蓋 live accepted transcript 或 scoring evidence。
- 不宣稱 speaker isolation、compliance readiness、production deletion guarantee，除非 backend 已完整 enforce 並驗證。
- 不新增外部 dependency、provider、model 或 real-AI cost gate，除非另行取得 approval。

## Stakeholder Success Criteria

| Stakeholder | Success means |
| --- | --- |
| Candidate | 有口音或專有名詞時，不會因 STT 誤聽被直接扣分；重要不確定處會被確認 |
| Product owner | Voice reliability 變成可解釋能力，不犧牲 demo stability 或 text interview path |
| Reviewer / coach | Report 可以追溯 spoken evidence，不會把 CV/JD context 誤寫成 candidate actually said |
| Engineering | Calibration 是 bounded、deterministic-first、可測、可觀察、可 rollback |
| Privacy / risk | Raw CV/JD/transcript 最小化使用；correction provenance 不洩漏敏感資料 |

## Phase Goal

| Phase | Scope | Done when |
| --- | --- | --- |
| VTC-G0 | Guardrail gate and source boundary | Goal/spec 明確寫出不可違反的 transcript、CV/JD、latency、privacy guardrails |
| VTC-G1 | Contextual glossary contract | 定義 session/question scoped glossary item、source、priority、safe use flags |
| VTC-G2 | Existing data source alignment | 對齊 CV raw/profile、JD raw/rubric、interview plan、active question、confirmed corrections 的使用方式 |
| VTC-G3 | Conservative live calibration | 定義 phrase hint、N-best rerank、static normalization、confidence confirmation 的 safe order |
| VTC-G4 | Provenance and report boundary | 定義 raw/corrected transcript、correction metadata、spoken evidence 與 report citation boundaries |
| VTC-G5 | Verification and release gate | 定義 regression tests、latency traces、adversarial cases、manual review gates |

## Definition of Done for This Goal

這份 goal 的 first implementation slice 只有在以下條件都成立時，才可視為完成：

1. Guardrails 明確列在 goal 和 spec 的最前面。
2. Spec 將 CV/JD usage 分成 vocabulary context 與 answer evidence，且禁止混用。
3. First slice 不新增 heavy hot-path work、dependency、provider 或 LLM rewrite。
4. Conservative correction、N-best rerank、static normalization 都有可測 metadata。
5. Low-confidence contentful transcript 仍由既有 confirmation gate 管理。
6. Raw transcript 不被 corrected transcript 覆蓋。
7. Backend voice robustness、focused calibration tests、backend lint 通過。
8. Open decisions 被列出，且不影響 reviewer 判斷 current scope。

## Open Decisions Before Implementation

1. Glossary 要即時計算還是 session setup 時預先持久化？初步建議：setup/warmup-time precompute，live path 只做 selection。
2. 使用者是否需要在 UI 看見所有 corrected terms，還是只看 scoring-impacting uncertainty？初步建議：只對 scoring-impacting uncertainty 打斷。
3. Offline cleanup 可否影響 final report scoring？初步建議：不能靜默覆蓋 live accepted transcript；只能作 secondary evidence，且要標記 provenance。
4. Azure detailed `NBest` 的保存粒度要到句級還是 word-level？初步建議：先句級 + changed term metadata，word-level 作後續 phase。
5. 是否需要新增 model/dependency 做 keyphrase extraction？初步建議：first slice 不新增 dependency，先 deterministic extraction + existing parsed profiles。

## Review Checklist

- 這個 goal 是否仍把 text interview mode 保留為低依賴 demo path？
- 這個 goal 是否避免把固定全職業詞庫當主方案？
- 這個 goal 是否避免用 LLM 自由重寫 transcript？
- 這個 goal 是否明確保護 3 秒 voice latency hot path？
- 這個 goal 是否讓 correction 可審計、可回放、可拒絕？
- 這個 goal 是否避免把 CV/JD context 當成 candidate spoken evidence？

證據狀態：本文件已同步 first deterministic backend slice。它不宣稱 frontend review UI、live Azure/ElevenLabs production latency、offline cleanup、real-AI eval 或 production telemetry 已完成。
