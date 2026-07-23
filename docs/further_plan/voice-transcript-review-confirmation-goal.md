# Voice Transcript Review and Confirmation Goal

狀態：first implementation slice completed locally；仍需 stakeholder review gaps
日期：2026-07-13 Pacific/Auckland
對應 spec：[Voice Transcript Review and Confirmation Spec](voice-transcript-review-confirmation-spec.md)
關聯文件：[Voice Transcript Calibration Goal](voice-transcript-calibration-goal.md)、[Voice Transcript Calibration Spec](voice-transcript-calibration-spec.md)、[Stakeholder Feature Conflict Guardrails](../stakeholder-feature-conflict-guardrails.md)、[Voice Product Behavior](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md)

## 文件定位

上一階段已完成 backend first slice：保留 raw transcript、做 conservative term-level calibration、保存 N-best / correction provenance。這一階段不是再加一層更 aggressive 的自動校準，而是定義：

1. 什麼 transcript uncertainty 可以自動接受。
2. 什麼 uncertainty 可以延後到 review queue。
3. 什麼 uncertainty 必須在面試當下向使用者確認。

核心問題是：不能全部問使用者，否則 voice interview 變成 transcript proofreading；也不能全部默改，否則 candidate 的答案會被系統美化，report/scoring 會失真。

## Goal

建立一套 transcript review and confirmation policy，讓 Kiwi 在 voice interview 中只打斷高風險 transcript uncertainty，將中風險項目延後到 review queue，並允許低風險 term-level correction 自動通過，同時保留 raw transcript、correction provenance 和 scoring boundary。

這一階段要讓 stakeholder 可以回答：

1. 系統什麼時候可以自動修正 STT 誤聽？
2. 系統什麼時候應該先繼續面試，稍後讓使用者 review？
3. 系統什麼時候必須停下來確認，否則不能公平評分？
4. 使用者在 review 裡新增的內容，是否會被錯誤當成 live spoken evidence？
5. 這套 UI 是否避免打斷 interview practice？

## Research Basis

公開 interview coaching 和 structured interview 資料顯示，常見面試回答通常圍繞 STAR 結構、behavioral examples、technical think-aloud、背景/動機/fit 問題。這些回答中真正影響評分的通常不是所有字，而是 action、result、ownership、metric、technical choice、role requirement coverage 和 expected signal。

參考來源：

- Indeed STAR method: https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique
- The Muse STAR method: https://www.themuse.com/advice/star-interview-method
- Coursera common interview questions: https://www.coursera.org/articles/common-interview-questions
- Google structured interview discussion: https://www.wired.com/2015/04/hire-like-google
- Technical interview think-aloud practice: https://arxiv.org/abs/2507.14418

產品解讀：transcript policy 不應該追求逐字完美；它應該保護會影響面試判斷的 evidence truth。

## Classification Principle

這一階段用三個分類標準，而不是只看 STT confidence。

| Standard | Question | Low risk | Medium risk | High risk |
| --- | --- | --- | --- | --- |
| Semantic change | 修正後意思有沒有變？ | spelling、case、format、term surface | 專有名詞不確定但主張大致不變 | 數字、否定、ownership、result、technical choice 改變 |
| Scoring impact | 會不會影響 score/report evidence？ | 非核心背景詞 | supporting evidence 或 evidence confidence | current question expected signal、JD must-have、match gap、Answer Alignment |
| Interruption need | 不現在問會不會傷害公平性？ | 不會 | 可以先繼續，稍後 review | 不確認就不能公平評分或選下一題 |

最終分類：

| Decision | Meaning | Interview behavior |
| --- | --- | --- |
| Auto-accept | 只修 transcription surface，不改 answer meaning | 不打斷，不顯示 live badge，保存 provenance |
| Deferred review | 可能影響 evidence confidence，但不必立即中斷 | 面試繼續；section break / interview end / pre-report review |
| Immediate confirmation | 不確認就不能公平評分 | 停在同一題；問短 confirmation；不計入 question count |

## Product Guardrails

1. Live interview 中只允許 high-risk uncertainty 打斷使用者。
2. Medium-risk review 預設不在使用者答題中顯示，避免干擾練習。
3. Auto-accept 不得只因 CV/JD 有該詞就改 transcript；必須有 provider evidence、static rule 或 bounded term-level evidence。
4. 一個 answer turn 中 auto corrections 過多時，要升級成 deferred review，因為整段 reliability 下降。
5. 使用者在 review 中補充的新句子，不可寫回 raw transcript；它只能是 `post_turn_clarification` 或 `post_interview_correction`。
6. Confirmation、review、clarification 都不算 interview question。
7. Report 必須區分 raw spoken evidence、calibrated spoken evidence、user-confirmed correction、post-turn clarification、CV/JD context。

## Non-Goals

- 不做 live full transcript editor。
- 不在答題中持續顯示 proofreading badge。
- 不要求使用者逐字確認 transcript。
- 不做 LLM free rewrite。
- 不讓 review correction 默默覆蓋 raw transcript。
- 不讓 CV/JD context 變成 candidate actually said。
- 不在這一階段新增 provider、dependency、full live-provider SLO gate 或 paid speech service。
- 本階段只新增 targeted real LLM judge eval 來驗證 transcript review policy decision，不代表 live Azure/ElevenLabs production run 已完成。

## Phase Goals

| Phase | Scope | Done when |
| --- | --- | --- |
| VTRC-G0 | Decision taxonomy | Auto-accept、deferred review、immediate confirmation 的分類標準可測 |
| VTRC-G1 | Interruption policy | 只有 high-risk uncertainty 會打斷 live interview |
| VTRC-G2 | Review UI contract | Medium-risk items 延後 review，且不破壞 interview practice |
| VTRC-G3 | Evidence boundary | Review correction、clarification、CV/JD context 不會混成 raw spoken evidence |
| VTRC-G4 | Scoring/report boundary | 未確認 high-risk uncertainty 不進 scoring；deferred review 降 evidence confidence |
| VTRC-G5 | Verification plan | 有 classification fixtures、UI state tests、voice flow regression、report boundary tests |

## Definition of Done

原本 planning gate 要求以下條件成立後才進入 implementation：

1. 三類 decision 的判斷標準明確且可測。
2. Immediate confirmation 的 trigger 不依賴主觀文字，而是綁到 number、negation、ownership、result、technical choice、expected signal、JD must-have、match gap、Answer Alignment impact。
3. Deferred review 不會在 live answering 中造成 distracting UI。
4. 使用者新增內容被標為 clarification/correction artifact，不覆蓋 raw transcript。
5. Scoring/report 能區分 raw、calibrated、confirmed、clarified、CV/JD context。
6. Open decisions 被列出，不阻擋 stakeholder review。

## Implementation Result 2026-07-13

已完成：

1. 新增 deterministic `transcriptReviewPolicyService`，將 transcript uncertainty 分成 `auto_accept`、`deferred_review`、`immediate_confirmation`、`reject_unusable`。
2. backend voice turn 會在 transcript calibration / confidence gate 後寫入 `transcriptReviewDecision`、`transcriptReviewItems` 和 evidence boundary metadata。
3. high-risk uncertainty 會阻擋 scoring / next-question path，並走現有 transcript understanding confirmation；confirmation/review metadata 不計入 interview question。
4. report dataset 不會把未確認 high-risk transcript 當作 accepted answer scoring evidence。
5. deferred review item 會成為 report transcript risk，frontend report section 會顯示 raw/proposed snippet、risk label 和「不要新增新答案內容」的 boundary copy。
6. 新增 targeted eval runner `npm run eval:voice-transcript-review-policy`，用 deterministic checks + real DeepSeek judge 檢查 policy decision。

驗證結果：

- backend focused tests：18/18 passed。
- backend `npm run test:voice`：22 files / 81 tests passed。
- backend `npm run test:report`：17 files / 86 tests passed。
- frontend `npm run test:components`：13 files / 34 tests passed。
- backend/frontend lint：passed。
- deterministic eval：6/6 policy cases passed。
- real LLM eval：6 cases，average score 0.97，LLM accept rate 1.0。

剩餘 gap：

1. 還沒有可持久化的 interactive review queue API，所以 report UI 目前只顯示 review evidence，沒有真正的 `Accept correction` / `Keep raw` / `Clarify what I said` 操作。
2. 現有 low-confidence confirmation path 仍沿用既有 clarification merge behavior 給 planner，但 metadata 已保存 raw/correction/clarification boundary；是否要完全禁止 merge 成 planner text 需要下一階段決策。
3. 尚未跑 live Azure/ElevenLabs microphone/provider E2E；本階段只用 mock-safe voice tests 和 real LLM policy judge，不宣稱 production speech SLO。
4. thresholds 仍是 code-level constants，需要更多 human calibration 後再決定是否設定為 admin-configurable。

## Open Decisions

1. Auto correction count threshold：初步建議單一 answer turn 最多 3 個 auto corrections，或 changed token ratio 不超過 15%；超過則升級 deferred review。
2. Review timing：初步建議 section break、interview end、report before-finalize 三個時點；不在使用者答題中提醒。
3. Medium-risk scoring：初步建議可用於下一題 planning，但 evidence confidence 降級；report 前若未 review，必須顯示 transcript risk。
4. Clarification wording：需要 UI copy 明確告知「只能修正系統聽錯，不要新增剛才沒說的內容」。
5. Persistence shape：可先接 existing turn metadata；若 review queue 需要跨頁保存，再評估新增 transcript review item persistence。

證據狀態：本文件已同步 first local implementation slice；它不宣稱 full interactive review queue persistence、production speech provider SLO 或完整 human calibration 已完成。
