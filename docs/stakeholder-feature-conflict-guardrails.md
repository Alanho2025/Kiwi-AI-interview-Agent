# Stakeholder Feature Conflict Guardrails

這份文件記錄 Kiwi AI Interview Agent 的主要 stakeholder 在意什麼，以及後續設計新 feature 時需要避免哪些產品衝突。

它不是 implementation spec，也不代表下面每一項都已經完整實作。它的用途是作為 feature planning、PR review、產品取捨和 regression 檢查的共同基準。

---

## 一句話原則

Kiwi 的核心價值不是把使用者包裝成更好的候選人，而是幫使用者理解 role intent、找出真實 evidence、練習如何自然地表達，並在 transcript、scoring、report 都保持可審計與公平。

後續 feature 只要會改變「使用者說了什麼」、「系統怎麼理解」、「面試官會怎麼判斷」、「報告怎麼給建議」，都必須檢查這份 guardrails。

---

## Stakeholder Map

### 1. Job seeker / candidate

使用者最在意的是：

- 自己不會因為口音、重音、非母語表達、或 STT 聽錯而被錯誤扣分。
- 系統能幫他理解 JD 背後真正想找的人，而不是只回傳一串 keywords。
- 建議要能落到自己的 CV、project、work experience，而不是 generic interview advice。
- 練習過程要像真實面試，但不能因為系統誤聽而失去控制感。
- 報告要指出哪裡回答到問題、哪裡 evidence 不夠、哪裡講散，而不是只給模糊稱讚。
- 隱私和資料使用要保守，尤其是 CV、JD、錄音、transcript、面試報告。

容易衝突的 feature：

- 把 transcript correction 做得太 aggressive，讓使用者看起來講得比實際更好。
- 把 low-confidence transcript 直接當成差回答。
- 為了流暢度跳過確認，導致錯 transcript 進入 scoring/report。
- 把 CV 裡的事實自動塞進 interview answer，讓 report 誤以為使用者真的講到了。

### 2. Interview realism / hiring-risk stakeholder

這裡的 stakeholder 不是一個實際登入系統的 hiring manager，而是 Kiwi 產品要模擬的面試判斷邏輯。

它在意的是：

- 問題是否真的對準 JD 背後的 role intent。
- follow-up 是否追問 role risk，而不是隨機延伸。
- scoring 是否看 candidate evidence 能不能降低 hiring risk。
- 報告是否能回答「聽完這個答案，面試官是否更敢 hire」。
- 系統不能把一般技巧訓練包裝成真實 role-fit 評估。

容易衝突的 feature：

- 只根據 generic question bank 問題，不使用 JD intent 和 CV evidence。
- 只檢查 STAR structure，不檢查 answer 是否對準面試官真正想確認的能力。
- 生成太友善的 feedback，弱化 missing evidence、transferable evidence、risk。
- 把 coaching 建議寫得像 candidate 已經具備或已經說明了某個能力。

### 3. Product / business owner

產品方在意的是：

- Kiwi 的差異化要站在 role intent、candidate evidence、voice reliability、report alignment 上。
- Text interview mode 要維持成最穩的 demo path，不能被高依賴 voice feature 綁死。
- Voice mode 要像 live interviewer，但必須承認它依賴 browser microphone、WebSocket、speech provider 和 session state。
- 新 feature 要有清楚的 rollback path、測試策略和可觀察指標。
- AI 成本、latency、provider dependency 不能失控。

容易衝突的 feature：

- 把 live voice hot path 綁上新的 heavy LLM call。
- 讓 demo 成敗依賴真實 speech credentials、麥克風權限或外部 provider 狀態。
- 為了短期效果加入不可解釋的 scoring prompt，後續難以 debug。
- 對 privacy、accuracy、compliance 做出產品尚未 enforce 的承諾。

### 4. Reviewer / coach / evaluator

這類 stakeholder 在意的是評估是否可信。

它在意的是：

- 每個 report finding 都要能回到 transcript、question、CV evidence、JD requirement 或 match analysis。
- 系統要分清楚 source evidence、model inference、user-confirmed correction。
- 評分要反映使用者在這次面試中實際說出的內容。
- feedback 要指出下一步怎麼改，而不是只提供抽象鼓勵。
- 低置信度或修正過的 transcript 要能被審計。

容易衝突的 feature：

- Report 引用 CV/JD 內容時，看起來像使用者在面試中說過。
- Transcript repair 沒有保存 raw transcript、normalized transcript、correction reason。
- Scoring prompt 直接相信修正後文字，沒有區分它是 ASR repair 還是使用者原話。
- 將「應該怎麼答」混進「剛剛答得如何」。

### 5. Engineering / operations

工程與營運在意的是產品能不能穩定維護。

它在意的是：

- Voice interview 必須是 state machine，不是散落 flags。
- `user speech end -> next question first audio <= 3 seconds` 是核心 latency target。
- STT uncertainty、confirmation、repair、answer scoring、question selection 要有清楚邊界。
- 核心行為盡量 deterministic，可測、可重播、可觀察。
- 新功能不能把 route handler、prompt、frontend state 全部耦合在一起。
- Feature 要能先用 mock-safe tests 驗證，再決定是否跑真實 AI eval。

容易衝突的 feature：

- 在 speech finalization 後才開始做 CV/JD extraction、LLM correction、重型 rerank。
- 把 repair prompt、confirmation、clarification 算成 interview question。
- 在 active recording turn 中切換 STT provider。
- 沒有 trace latency milestones 就直接改 UX 或 provider。
- 把 persistence、business logic、LLM prompt orchestration 混在 controller。

### 6. Privacy / compliance / risk reviewer

這類 stakeholder 在意的是使用者資料和產品宣稱是否保守。

它在意的是：

- CV、JD、recordings、transcripts、reports 都可能包含 sensitive data。
- Raw CV/JD text 不應該因為 feature 方便就暴露到不必要的 client path 或 prompt path。
- Data retention、deletion、encryption、compliance 只能說已經實作並驗證的部分。
- 使用者確認過的 correction 也可能是個人資料，要跟 transcript 一樣保守處理。

容易衝突的 feature：

- 把 raw CV/JD 全量送進 live voice correction prompt，只為了修幾個詞。
- 在前端暴露不需要給使用者看的 raw extracted CV text。
- 在 docs/UI copy 裡承諾 compliance readiness，但 backend 尚未 enforce。
- 把錄音或 transcript 當成永久可用訓練資料。

---

## Cross-Feature Guardrails

### Guardrail 1: 修 transcript，不修答案品質

Voice transcript calibration 只能修正系統聽錯的字。它不能：

- 補使用者沒有說的 accomplishment。
- 改善 answer structure。
- 替使用者加入 result、metric、reflection。
- 把含糊回答改成清楚論點。

可以做的例子：

| Raw STT | Safe correction | Reason |
| --- | --- | --- |
| `post gray SQL` | `PostgreSQL` | 明確 ASR 誤聽，且 CV/JD/question context 支持 |
| `proper engineering` | `prompt engineering` | 常見 technical phrase 誤聽 |
| `J W tea` | `JWT` | acronym normalization |

不可以做的例子：

| Transcript | Unsafe change | 為什麼不可以 |
| --- | --- | --- |
| `I worked on the database` | `I designed PostgreSQL schemas and optimized indexes` | 加了使用者沒說的 technical evidence |
| `we improved it` | `we reduced retest rate from 15% to 5%` | 加了 metric |
| `I talked to users` | `I translated messy clinical workflows into AI automation requirements` | 改善了 answer framing |

### Guardrail 2: 使用 CV/JD 作詞彙來源，但不能把 CV/JD 當作答案來源

CV/JD 可以幫助 ASR 知道哪些詞可能出現，例如 company name、project name、tool、certification、domain acronym。

但 CV/JD 不能被用來自動補全使用者答案。Scoring 和 report 必須區分：

- `spoken_evidence`: 使用者在面試中真的說到的內容。
- `cv_jd_context`: 用來理解角色與詞彙的背景資料。
- `model_inference`: 模型根據上下文做出的判斷。
- `user_confirmed_correction`: 使用者確認過的 transcript 修正。

### Guardrail 3: 詞彙來源必須 dynamic、session-scoped、可審計

Kiwi 支援所有 role，所以不應該維護一個全職業固定詞庫作為主要方案。

更合理的來源順序是：

1. Current question and target skill.
2. Interview plan and match evidence.
3. JD raw text / structured JD / rubric.
4. CV profile / extracted CV sections / selected CV raw text.
5. User-confirmed corrections from the same session.
6. Small global fallback list for product-common terms only.

每個 glossary item 應該至少保留：

- `term`
- `source`
- `scope`
- `priority`
- `reason`
- `safe_for_phrase_hint`
- `safe_for_auto_correction`

### Guardrail 4: Latency 風險看 timing，不只看技術名稱

使用 CV/JD 建立 glossary 本身不一定傷害 latency。真正危險的是把重型工作放在錯的時間點。

允許的 timing：

- CV/JD upload 或 review 後預先整理 candidate terms。
- Interview plan 建立時產生 session glossary。
- 每題開始前或 STT session warmup 時選出小型 phrase list。
- 使用者確認 correction 後更新 session-level term memory。

避免的 timing：

- `speech_end_received` 後才全量掃 CV/JD。
- `stt_final_ready` 後才呼叫 heavy LLM 做 open-ended correction。
- 等到要產生下一題前才做 large rerank 或 embedding search。

### Guardrail 5: Low-confidence transcript 是 system understanding issue

低置信度 STT 不等於使用者回答差。

Contentful low-confidence transcript 應該進入 understanding confirmation，而不是：

- 直接評分。
- 直接丟掉。
- 自動判定 candidate 沒有回答問題。
- 自動跳到下一題。

### Guardrail 6: Repair / confirmation 不算 interview question

只有真實 interview question 才能增加 question count。

不應計數：

- repeat request
- transcript confirmation
- transcript clarification
- repair prompt
- system status message
- barge-in acknowledgement

### Guardrail 7: Evidence grounding 比 fluent output 更重要

新 feature 如果讓 output 更好讀，但降低可審計性，通常不是好 trade-off。

優先級應該是：

1. Raw evidence preserved.
2. Correction or inference reason recorded.
3. User-facing output readable.
4. Model-generated polish.

---

## Feature Review Checklist

每個會影響 interview、voice、scoring、report、CV/JD matching 的 feature，都應該回答下面問題。

### Product fit

- 這個 feature 是在解決 JD comprehension gap、evidence translation gap、interview delivery gap，還是其他問題？
- 它幫使用者更真實地表達 evidence，還是替使用者創造 evidence？
- 它是否保持 text interview mode 作為低依賴 demo path？

### Evidence and source boundaries

- 它使用哪些資料來源：CV raw text、CV profile、JD raw text、structured JD、transcript、recording、report、match analysis？
- 哪些內容是使用者真的說過？
- 哪些內容只是 CV/JD context？
- 哪些內容是 model inference？
- 如果 model 修正了 transcript，是否保存 raw version、修正後 version、修正原因？

### Voice latency

- 它是否進入 `user speech end -> next question first audio` 的 3 秒 hot path？
- 如果會，它移除了哪個既有耗時，或如何證明不會超時？
- 是否新增 latency milestones 或 trace metadata？
- 是否可以改成 setup-time、warmup-time、async、或 cached computation？

### Fairness and user trust

- 它是否可能讓有口音、非母語、或專有名詞較多的使用者被錯誤扣分？
- 它是否把 STT confidence 當成 answer quality？
- 使用者是否有機會確認 scoring-impacting transcript uncertainty？
- 它是否清楚區分「系統沒聽清楚」和「答案內容不足」？

### Privacy and data minimization

- 是否真的需要 raw CV/JD，還是 parsed profile / selected terms 就夠？
- Raw text 是否暴露到新的 frontend state、logs、prompts、analytics？
- 是否有保存 sensitive transcript correction memory？如果有，保存多久、誰可讀？
- UI/docs 是否避免未驗證的 compliance 或 deletion promise？

### Testability and rollback

- 這個 feature 可以用 mock-safe tests 驗證嗎？
- 有沒有 regression cases：accented term、technical acronym、low-confidence contentful answer、confirmation turn、latency trace？
- 如果 provider、LLM、extractor 失敗，是否能回到原本安全流程？
- 是否需要 feature flag 或 staged rollout？

---

## Red Lines

以下行為應視為產品衝突，除非先修改產品原則並重新評估風險：

- 用 transcript correction 補 candidate 沒說的內容。
- 把 CV/JD facts 當成 interview spoken answer。
- 把 low-confidence transcript 直接評成差回答。
- 把 repair、confirmation、clarification 算成 interview question。
- 在 voice hot path 加入不可控 heavy LLM call，且沒有 latency trace。
- 不保存 raw transcript 就覆蓋成 corrected transcript。
- 讓 report 看不出哪些是 spoken evidence、哪些是 CV/JD context。
- 對 privacy、deletion、encryption、compliance 做出未被 backend enforce 的承諾。
- 為了支援所有 roles 而維護大型固定 profession glossary。
- 在 active STT turn 中任意切換 provider。

---

## North-Star Metrics

後續 feature 可以用這些指標判斷是否方向正確。

| Metric | Why it matters |
| --- | --- |
| Role-intent alignment | 問題與 report 是否真的對準 JD 背後想驗證的能力 |
| Evidence grounding coverage | Report finding 有多少能回到 transcript / CV / JD / match evidence |
| False correction rate | Transcript calibration 是否把沒說過的內容改進答案 |
| Scoring-impacting uncertainty confirmation rate | 系統是否只在重要不確定處打斷使用者 |
| Voice hot-path latency | 是否維持 `speech end -> first audio <= 3 seconds` |
| Low-confidence safety | Contentful low-confidence 是否被確認，而不是直接評分或丟棄 |
| Report trust | 使用者能否看懂為什麼被評成這樣，以及下一步怎麼改 |
| Privacy minimization | 新 feature 是否避免不必要使用 raw CV/JD/transcript |

---

## Source Anchors

後續討論或 implementation 可以從這些文件和 source areas 開始：

- `docs/Further_requirement.md`: product intent、role intent、evidence translation、voice reliability。
- `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`: voice state machine、STT confidence、turn counting、latency target。
- `docs/voice-transcript-calibration-stakeholder-brief.md`: transcript calibration scope、技術選型與 trade-off。
- `repo-docs/modules/feature-voice-interview.md`: reader-facing voice workflow guide。
- `backend/src/services/voice/speechPhraseHintService.js`: current dynamic phrase hints from session analysis, CV profile, JD rubric, and interview plan.
- `backend/src/services/voice/duplexVoiceAgentService.js`: phrase hints are built when starting/restarting STT sessions.
- `backend/src/db/models/documentContentModel.js`: CV extracted raw text and profile storage.
- `backend/src/services/session/sessionPersistenceService.js`: JD/session analysis persistence.
- `backend/src/services/session/sessionViewBuilder.js`: restored analysis setup exposes raw JD for session setup.
