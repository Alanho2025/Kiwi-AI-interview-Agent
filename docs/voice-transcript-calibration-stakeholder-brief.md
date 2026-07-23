# 語音轉文字校準：現況、差距與建議方向

這份文件給非工程 stakeholder 閱讀。目的不是討論某個 function 要怎麼寫，而是說清楚：

- 目前語音面試的語音轉文字（STT / ASR）怎麼工作。
- 為什麼口音、重音、專有名詞會讓面試結果被誤判。
- 外部研究與 open-source 做法支持哪些改動。
- 新的校準 scope 如何提升 transcript accuracy，同時避免把候選人答案「修得太好」。

核心結論：Kiwi 可以做語音轉文字校準，但校準只能修正「系統聽錯」，不能替使用者補內容、補結構、補成效或美化表達。

---

## 一句話版本

現在的 voice flow 已經有基礎保護：如果 STT 聽得不穩，系統不會直接把低置信度內容拿去評分；內容充足但低置信度的回答會先要求使用者確認。

下一步要補的是「更聰明地判斷這一次面試裡哪些字可能被聽錯」：例如 JD 裡的工具名、CV 裡的專案名、公司名、證照、domain acronym。主方案不是維護一個全職業固定詞庫，而是從每次 CV raw text、JD raw text、current question、interview plan 和已確認過的 transcript correction 產生一個小型、可審計、會隨題目變動的 contextual glossary。外部 ASR 系統常用 phrase list、hotword boosting、N-best alternatives、constrained correction 來做類似事情；共同點是：它們修 transcript，不修答案品質。

---

## 為什麼這件事重要

語音面試的下游結果依賴 transcript。當 transcript 錯了，後面的 evaluator、follow-up question、final report 都會被錯誤文字影響。

例子：

| 使用者實際想說 | STT 可能聽成 | 產品風險 |
| --- | --- | --- |
| `PostgreSQL` | `post gray SQL` | 評估器可能以為使用者沒有講到正確資料庫技術 |
| `prompt engineering` | `proper engineering` | 回答主題被誤解，follow-up 可能偏掉 |
| `RAG` | `rag` 或普通英文詞 | AI / retrieval 經驗可能被低估 |
| 有口音的 `JWT` | `J W tea` 或漏字 | 技術證據被破壞 |

這不是使用者能力問題，而是系統理解問題。尤其在面試產品裡，這會影響公平性：有口音、非母語、或講話重音不同的使用者，不應該因為 STT 比較容易聽錯而被扣分。

---

## 目前 Kiwi 已經怎麼做

目前 voice mode 的核心流程是：

```text
使用者說話
  -> 瀏覽器麥克風收音
  -> 前端把音訊降到 16kHz PCM
  -> 透過 authenticated WebSocket 串流到後端
  -> Azure Speech 做即時 STT
  -> 基礎 Phrase List 提醒 Azure 注意少數常見詞
  -> 產出 raw transcript
  -> 靜態 normalization 修正少數已知錯字
  -> confidence gate 判斷 transcript 能不能進入評分
  -> 可用的回答才會保存、評分、產生下一題
```

目前已經有四個重要安全設計。

### 1. 收音端先降低音訊問題

前端要求瀏覽器啟用：

- echo cancellation
- noise suppression
- auto gain control
- single channel
- 16kHz / 16-bit audio target

這能降低噪音、回音、音量不穩造成的 STT 錯誤，但它不能解決所有口音、專有名詞、或語義上下文問題。

### 2. Azure STT 前有基礎 Phrase List

後端會把常見 interview / technical phrases 提供給 Azure，例如：

- `React`
- `PostgreSQL`
- `MongoDB`
- `JWT`
- `RAG`
- `LLM`
- `University of Auckland`
- `Te Tiriti o Waitangi`
- `STAR method`

這叫做 first-pass biasing：在 ASR 解碼時提醒 speech provider「這些詞比較可能出現」。

限制是：目前 phrase list 是偏置，不是保證。更重要的是，固定詞庫不可能覆蓋所有 profession。Kiwi 的目標是支援所有 role，所以這份 global list 只能當 fallback，不能當主要校準來源。主要來源應該是該使用者當次上傳的 CV/JD、當前題目、interview plan、以及本 session 中使用者已確認過的正確詞。

### 3. STT 後有保守的靜態修正

系統目前會修正少數明確、安全、常見的 ASR 錯誤，例如：

| Raw transcript | Normalized transcript |
| --- | --- |
| `post gray sql` | `PostgreSQL` |
| `proper engineering` | `prompt engineering` |
| `rest a p i` | `REST API` |
| `j w t` | `JWT` |
| `r a g` | `RAG` |

這類修正是合理的，因為它只修字，不替使用者補答案。

### 4. Confidence gate 防止低品質 transcript 直接進評分

目前 speech confidence 的產品定義很清楚：

```text
speech confidence = 系統理解品質
不是 user answer quality
```

現有 gate 的大方向：

- 空白、太短、只有 filler、沒有 final STT segment：不保存、不評分，請使用者重說。
- 內容充足但低置信度：不直接評分、不丟掉，先請使用者確認系統是否聽對。
- 確認、重說、clarification、repair prompt 不算 interview question。

這是很重要的底線。新的校準不應該移除這個底線。

---

## 目前差距在哪

目前架構已經避免「低置信 transcript 直接評分」這個大風險，但對「聽錯專有名詞」仍然偏弱。

| 差距 | 現況 | 影響 |
| --- | --- | --- |
| 沒有使用完整 N-best alternatives | 後端只取 Azure `NBest[0]` 的 confidence，沒有保留其他候選 transcript | 正確詞如果在第 2 或第 3 候選裡，目前會被丟掉 |
| 詞彙來源不夠動態 | 有 global phrases，但缺少從 CV raw text、JD raw text、current question 生成的 session-scoped / question-scoped glossary | 固定詞庫無法覆蓋所有 role；專有名詞很多時，ASR 不知道哪些詞此刻更重要 |
| 靜態修正覆蓋有限 | 只能修 `transcriptReplacements.js` 已寫好的 pattern | 新公司名、冷門技術、候選人專案名容易漏 |
| 沒有 transcript provenance 的完整比較 | 有 raw/normalized/corrections metadata，但沒有 N-best、詞級 confidence、校準原因完整保存 | 難以審計「為什麼這句被改成這樣」 |
| LLM correction 尚未被安全地定義 | 現有 further plan 提到低於某 confidence 可觸發 LLM correction | 如果 trigger 太寬，可能增加 latency，也可能把回答修得比使用者實際講得更好 |

這些差距的共同點不是「評分邏輯不夠聰明」，而是「進入評分前的文字證據還可以更可靠」。

---

## 外部研究與 open-source 給我們的方向

外部做法大致支持五個原則。

### 原則 1：做 contextual vocabulary grounding，不做全職業固定詞庫

Azure Speech 官方支援 phrase list，用來提高特定詞或短語被辨識出來的機率。官方描述的典型例子是姓名、地名、homonyms、以及某個 industry 或 organization 特有的詞。它的定位是 runtime、just-in-time、lightweight，不需要訓練模型；同一份文件也說 phrase list 不應超過 500 phrases，較大的穩定詞彙需求應考慮 Custom Speech。

這支持 Kiwi 使用 phrase list，但不支持我們維護一個全 profession 的固定詞庫。對 Kiwi 更合理的解讀是：每次面試開始前，根據該使用者的 CV raw text、JD raw text、current question、interview plan 產生一個小型 contextual glossary；每一題只把最相關、低歧義、會影響 scoring 的詞拿去做 ASR biasing 或 N-best rerank。

固定 global list 只保留少數產品高頻 fallback 詞，例如 `CV`、`JD`、`STAR method`。它不能承擔「支援所有 role」這件事。

參考：Microsoft Azure Speech Phrase List

https://learn.microsoft.com/en-us/azure/ai-services/speech-service/improve-accuracy-phrase-list

### 原則 2：不要只相信 ASR 第一候選

Azure detailed results 可以回傳 `NBest`、confidence、lexical / normalized / display forms、word-level timing。官方也提醒第一個 result 不一定永遠是最值得信任的候選。

參考：Microsoft Azure Speech recognition results

https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-speech-recognition-results

### 原則 3：open-source ASR 也常用 hotword boosting

`pyctcdecode` 支援 hotword boosting 和 beam search details。這代表「讓 ASR 對特定詞更敏感」不是 Kiwi 特例，而是 speech system 常見能力。不過 `pyctcdecode` 是 CTC decoder，適合我們控制 ASR model logits 的情境；Kiwi 目前使用 Azure Speech 這種 black-box provider，所以它更像是技術參考，不是 live path 的直接選型。

參考：pyctcdecode

https://github.com/kensho-technologies/pyctcdecode

### 原則 4：ASR correction 應該被限制在候選範圍或明確證據內

N-best / lattice constrained ASR correction 的研究指出，自由生成式 correction 可能會產生語義相近、但聲音證據不支持的詞。因此更安全的做法是根據 N-best candidates、lattice、詞彙上下文做受限修正。

參考：Improving ASR Error Correction Using N-best Hypotheses

https://arxiv.org/abs/2303.00456

參考：ASR Error Correction using Large Language Models

https://arxiv.org/abs/2409.09554

### 原則 5：口音公平性是真實問題，不是 UX 小問題

accented speech recognition survey 指出口音會顯著增加 ASR 難度。Stanford 對主流 ASR 的研究報導也指出，不同族群的 word error rate 差距可能很大，並且這種差距會影響 automated online interviews 這類高風險場景。

參考：Accented Speech Recognition: Benchmarking, Pre-training, and Diverse Data

https://arxiv.org/abs/2104.10747

參考：Stanford report on ASR disparities

https://news.stanford.edu/stories/2020/03/automated-speech-recognition-less-accurate-blacks

---

## 新增技術與 trade-off

這一段回答 stakeholder 最容易問的問題：每個技術是什麼、官方或專案預設場景是什麼、還有哪些替代工具、為什麼 Kiwi 應該或不應該選。

### 1. Contextual glossary builder

這不是某個單一外部產品，而是 Kiwi 需要自己定義的 product layer。它的工作是把這一次面試上下文整理成一小包「這題可能會講到、而且 ASR 容易聽錯的詞」。

資料來源：

| 來源 | 提取什麼 | 為什麼合理 |
| --- | --- | --- |
| CV raw text | project names、company names、tools、frameworks、certifications、school、domain acronyms | 使用者最可能用自己的經驗回答 |
| JD raw text | role title、requirements、tools、domain terms、product names、regulatory terms | 面試問題會圍繞 JD intent |
| current question | 這題正在測的 skill、topic、requirement | 限縮當前 vocabulary，避免詞太多 |
| interview plan / match evidence | 本輪要驗證的 requirements 和 evidence | 與 scoring/follow-up 直接相關 |
| confirmed correction memory | 使用者剛確認過的正確詞 | 同一 session 後面應該提高該詞優先級 |

建議選它作主路徑，因為 Kiwi 要支援所有 role。固定詞庫會變成永遠維護不完的百科全書；contextual glossary 則把問題縮成「這位使用者、這份 JD、這一題」。

主要 trade-off：

| 優點 | 代價 / 風險 | 控制方式 |
| --- | --- | --- |
| role-agnostic，不依賴我們預先知道所有職業 | extraction 可能抓到普通詞或錯詞 | 加入低歧義 filter、長度限制、詞型限制、source evidence |
| 可用 CV/JD 立即適應專業領域 | 詞太多會稀釋 phrase list 效果 | 每題只取 top N，例如 30-80 個 |
| 可以解釋每個詞從哪裡來 | 需要保存 provenance | 每個 glossary item 保存 `source`、`reason`、`priority` |
| 不需要訓練模型 | 對冷門詞 pronunciation 仍可能不穩 | 不確定時走 N-best / confirmation，而不是硬改 |

建議 glossary item 長這樣：

```json
{
  "term": "Auckland Eye",
  "source": "cv_raw_text",
  "priority": "high",
  "reason": "proper noun from candidate work history",
  "scope": "session",
  "safeForPhraseList": true,
  "safeForAutoCorrection": false
}
```

### 2. Keyphrase / entity extraction

這是從 CV/JD raw text 裡找出重要詞的方式。它不是最終決策，只是產生 candidate terms。

可選工具：

| 工具 | 是什麼 | 預設場景 | Kiwi 判斷 |
| --- | --- | --- | --- |
| Azure AI Language key phrase extraction | Microsoft 的 cloud NLP 功能，用來從 unstructured text 找 main concepts | 官方例子是提交文字，回傳 main topics；但此功能已公告 2029-03-31 retired | 不建議作為新主依賴；可作研究參考 |
| spaCy NER / noun chunks / EntityRuler | 本地 NLP library，可辨識 entity、noun phrase，也可加 rule-based pattern | 處理 raw text、找 organization、location、product、數字等 entity；rule-based matcher 適合可控 pattern | 可作 deterministic extractor 的候選，尤其適合本地、可控、低成本 |
| YAKE | single-document unsupervised keyword extraction，不需要訓練、外部 corpus 或 dictionary | 從單份文件抓 keyword，跨 domain / language | 適合 CV/JD 這種單文件 candidate extraction，但需要過濾普通詞 |
| KeyBERT | 用 embedding 找跟 document 最相近的 keywords/keyphrases | 語義式 keyword extraction，適合抓主題詞 | 比 YAKE 重，可能引入模型依賴；可做 offline/async，不適合 live turn |
| LLM structured extraction | 用 LLM 依 schema 抽取 terms、source、priority、ambiguity | 複雜文本理解、可以同時判斷詞是否 scoring-impacting | 品質高但有成本與 hallucination 風險；必須要求 source quote / source span |

我的建議不是選一個工具全包，而是用 layered extraction：

1. deterministic extractor 先抓高精度模式：大小寫技術詞、acronym、版本號、proper noun、certification、company/product names。
2. optional keyword extractor 抓補充候選，但所有候選都要過 filter。
3. optional LLM extraction 只在 session setup 或 interview plan 生成時跑，不放進 live 3 秒路徑。

參考：Azure AI Language key phrase extraction

https://learn.microsoft.com/en-us/azure/ai-services/language-service/key-phrase-extraction/overview

參考：spaCy linguistic features / NER

https://spacy.io/usage/linguistic-features

參考：YAKE

https://github.com/INESCTEC/yake

參考：KeyBERT

https://github.com/MaartenGr/KeyBERT

### 3. Azure Phrase List

Phrase List 是 speech provider 層的 runtime hint。它不訓練模型，只在開始 recognition 前告訴 Azure：「這些詞更可能出現。」

官方預設場景：

- names
- geographical locations
- homonyms
- organization / industry-specific words or acronyms
- real-time transcription、Fast transcription API、Voice Live API

Kiwi 建議用法：

- 只放 contextual glossary 裡 high priority、低歧義、適合 ASR hint 的詞。
- 每題或每個 interview section 重新計算，而不是整場塞一包大詞庫。
- global fallback list 只放少數產品高頻詞。

不選它作唯一主方案的原因：

| 限制 | 對 Kiwi 的影響 |
| --- | --- |
| Phrase List 是 bias，不是校準真相 | 不能因為詞在 list 裡就自動把 transcript 改掉 |
| 官方建議不要超過 500 phrases | 全職業固定詞庫不可行 |
| weight 作用在整份 list | 不能對每個詞精細控制風險 |
| 詞太短或太普通會誤導 | `Go`、`R`、`C` 這類詞不能直接強 bias |

因此 Phrase List 是 first-pass helper，不是 final correction layer。

### 4. Azure detailed result / N-best alternatives

N-best 是 ASR provider 對同一段音訊提出的多個候選 transcript。Azure detailed results 可取得 candidate text、confidence、lexical/normalized/display forms、word-level timing；官方文件也提醒第一個候選不一定是 confidence 最高。

Kiwi 建議用它作主校準證據，因為它比 LLM 自由猜測更接近音訊本身。

適合情境：

- 第一候選有明顯誤聽。
- 第二或第三候選包含 CV/JD/current question 裡的重要專有詞。
- 候選 confidence 差距很小。
- 修正只影響 technical term / proper noun / acronym，不改善答案內容。

trade-off：

| 優點 | 代價 / 風險 |
| --- | --- |
| 直接來自 ASR decoding space，較有音訊根據 | 如果正確詞不在 N-best 裡，仍然救不了 |
| 可保存候選與選擇理由 | 需要多存 metadata |
| 比 LLM rewrite 更安全 | rerank rule 設太 aggressive 仍可能選錯 |

### 5. Azure Custom Speech

Custom Speech 是訓練或部署自訂 speech model。官方定位是：當 base model 在特定 domain vocabulary 或特定 audio conditions 上不夠準時，可用 text data、audio data、reference transcription 來訓練；也可用 structured text 做 custom pronunciations 和 display formatting。

它不適合當 Kiwi 的第一階段主路徑。

原因：

| Custom Speech 適合 | Kiwi 現階段問題 |
| --- | --- |
| 穩定 domain，例如客服、醫療、特定企業內部術語 | Kiwi 每個使用者 / 每份 JD 都可能不同 |
| 有足夠 audio + transcript data 可訓練 | 新使用者不可能先提供大量 domain audio |
| 想鎖定固定模型行為 | Kiwi 需要每次 session 動態適應 |

所以 Custom Speech 是長期 enterprise / domain package 選項，不是 general role interview 的 V1。

參考：Azure Custom Speech

https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-speech-overview

### 6. pyctcdecode / hotword boosting

`pyctcdecode` 是 open-source CTC beam search decoder，支援 hotword boosting、BPE vocabulary、multi-LM、real-time decoding、word frame annotation。它適合我們自己掌控 ASR model logits 的情境，例如用 Wav2Vec2 / NeMo / CTC model 自建 ASR。

Kiwi 目前使用 Azure Speech，所以不能直接把 `pyctcdecode` 插進 Azure 的 decoder。它對我們的價值是設計參考：hotword boosting 是合理技術，但在 Azure path 裡應透過 Azure Phrase List 和 N-best rerank 落地。

選擇判斷：

| 選項 | 判斷 |
| --- | --- |
| 直接導入 pyctcdecode | 暫不選；需要改 ASR stack，成本高 |
| 參考 hotword boosting 原則 | 採用；用 Azure Phrase List + contextual glossary 實現 |
| 未來自建 ASR 時使用 | 可評估；屬於較大架構變更 |

參考：pyctcdecode

https://github.com/kensho-technologies/pyctcdecode

### 7. Constrained LLM helper

LLM 可以協助判斷「這個詞是否可能被 ASR 聽錯」，但不能直接 rewrite 整段答案。比較安全的做法是要求 LLM 輸出結構化 patch，例如 `from`、`to`、`reason`、`sourceEvidence`、`shouldAskConfirmation`。

如果使用 OpenAI-compatible provider，Structured Outputs / JSON schema 類能力可以要求模型遵守 schema。這類官方功能的預設場景是讓 model responses adhere to a JSON Schema；但它只能約束輸出格式，不能保證模型判斷一定正確。

Kiwi 建議用法：

- 不在每個 transcript 上自動跑。
- 只在 N-best/glossary/context 都顯示高價值不確定性時觸發。
- 只能輸出 small patch，不輸出完整 rewritten answer。
- 沒有足夠 source evidence 時，回到 confirmation。

參考：OpenAI Structured Outputs

https://developers.openai.com/api/docs/guides/structured-outputs

### 8. Offline second-pass ASR

Live interview 有 3 秒 first-audio 目標，所以不能把重型 ASR 或長 LLM cleanup 放進 live path。面試後的 report cleanup 可以慢一些，但必須保存 raw transcript，不能靜默覆蓋 live accepted answer。

可選工具：

| 工具 | 官方 / 專案定位 | Kiwi 判斷 |
| --- | --- | --- |
| Azure Batch Transcription | 官方定位是大量音訊檔案的 async transcription，從 storage 送檔、非同步取結果 | 適合後台處理，不適合 live；排隊和延遲不可控 |
| WhisperX | fast ASR with word-level timestamps and diarization；有 VAD preprocessing、alignment | 適合 offline evidence candidate；需處理 GPU/部署/隱私/維運 |
| faster-whisper | CTranslate2-based Whisper implementation，常作 WhisperX backend | 適合自管 offline ASR；不是 live 3 秒主路徑 |

參考：Azure Batch Transcription

https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription

參考：WhisperX

https://github.com/m-bain/whisperX

參考：faster-whisper

https://github.com/SYSTRAN/faster-whisper

---

## 建議的新 scope：校準 transcript，不校準答案

新的架構應該長這樣：

```text
使用者說話
  -> 即時 STT
  -> 取得 raw transcript + N-best alternatives + confidence evidence
  -> 從 CV/JD/current question 建立 contextual glossary
  -> 只把高優先、低歧義、與本題相關的詞用於受限校準
  -> 產生 calibrated transcript candidate
  -> 保留 raw transcript、calibration reason、confidence evidence
  -> confidence gate 判斷是否可接受
  -> 低置信但內容充足時，仍然要求使用者確認
  -> 只有 accepted transcript 才能進評分與下一題
```

這裡的重點是順序：

1. 先看 speech provider 自己提供的 alternatives。
2. 再從 CV/JD/current question/confirmed corrections 產生 contextual glossary。
3. 只把 high-priority、低歧義、與本題相關的詞放進 Phrase List 或 N-best rerank。
4. 再看目前問題、JD、CV 是否讓某個專有詞更合理。
5. 只有在證據夠強時才修正。
6. 證據不夠時，不猜；進入 confirmation。

---

## Before / After

| 面向 | 現在 | 建議後 |
| --- | --- | --- |
| ASR 輸出 | 主要使用單一 final transcript | 保留 raw transcript + N-best alternatives |
| 專有名詞 | 靠基礎 Azure Phrase List + 靜態 regex | CV/JD/current question dynamic glossary + selective Phrase List + N-best rerank |
| Confidence | 已有 high / medium / low gate | 保留 gate，加入「哪個詞會影響 scoring」的判斷 |
| 低置信長回答 | 先 confirmation，不直接評分 | 保留 confirmation；只減少不必要 confirmation |
| LLM 角色 | 目前未正式進 live correction | 僅可作受限 correction helper，不可自由重寫 |
| Report transcript | 使用 accepted transcript 為主 | 可加入 offline second-pass candidate，但不能靜默覆蓋 live answer |
| 審計能力 | raw / normalized / corrections 部分保存 | 保存 raw、candidate、glossary source、selected reason、confidence、confirmation status |

---

## 什麼可以校準

可以校準的內容是「系統聽錯的字」。

| 可校準類型 | 例子 | 為什麼安全 |
| --- | --- | --- |
| 技術名詞 | `post gray SQL` -> `PostgreSQL` | 聲音相近，且是 CV/JD/current question contextual glossary 詞 |
| 縮寫與大小寫 | `j w t` -> `JWT` | 只是格式與技術詞辨識 |
| 常見 ASR 同音錯誤 | `proper engineering` -> `prompt engineering` | 已知錯誤 pattern，且上下文支持 |
| 公司 / 學校 / 產品名稱 | `you of a` -> `UoA` | CV/JD/context 可支持 |
| 明顯標點與斷句 | 長句加入基本 punctuation | 改 readability，不改內容 |

---

## 什麼不能校準

不能校準的內容是「讓答案變好」。

| 不可做 | 原因 |
| --- | --- |
| 幫使用者補 STAR / STARR 結構 | 這會提升 answer quality，不是修 transcript |
| 幫使用者補數字成果 | 例如把「improved performance」改成「improved performance by 30%」是新增事實 |
| 從 CV/JD 裡拿使用者沒說的經驗補進回答 | 這會讓 transcript 變成 generated answer |
| 把模糊回答改成清楚回答 | 模糊本身可能是評分依據 |
| 刪掉所有 filler words / hesitation | 不流暢、卡住、修正自己，也可能是 communication clarity 的一部分 |
| 在沒有聲音或 N-best 證據時猜專有詞 | 這會增加 hallucination 風險 |

Stakeholder 可以用一句話判斷：

```text
如果改動後，候選人看起來更會面試，那就不是校準。
如果改動後，只是系統更準確地記下候選人實際說過的詞，那才是校準。
```

---

## LLM 應該怎麼用

LLM 可以用，但不能當自由改寫器。

建議規則：

| LLM 使用方式 | 建議 |
| --- | --- |
| 直接把低 confidence transcript 全段 rewrite | 不建議 |
| 用 LLM 在 N-best candidates 中選最合理候選 | 可以，但要保存候選與理由 |
| 用 LLM 判斷某個 technical term 是否可能被 ASR 聽錯 | 可以，但只能輸出 small patch |
| 用 LLM 幫 report 做 readable transcript | 可以做成 separate offline candidate，不可靜默覆蓋 live accepted answer |
| 用 LLM 補面試答案內容 | 禁止 |

現有 further plan 裡提到「ASR confidence 低於 `0.85` 時觸發 LLM correction」。這個方向需要收窄：`0.85` 可以當作 review signal，不適合直接當作全量 rewrite trigger。更安全的 trigger 應該是：

- 這個詞會影響 scoring 或 follow-up。
- N-best 裡有更合理的相近候選。
- glossary / JD / CV / current question 支持該候選。
- confidence evidence 顯示系統理解不穩。
- latency budget 允許，或改走 confirmation / offline cleanup。

---

## Live interview 與 report cleanup 要分開

Voice interview 有一個硬體驗目標：

```text
user speech end -> next question first audio <= 3 seconds
```

所以 live loop 不應該放太重的 transcript 修正。

建議分成兩條路：

| 路徑 | 目的 | 原則 |
| --- | --- | --- |
| Live calibration | 讓下一題和即時評分不要被明顯 ASR 錯字帶偏 | 低延遲、受限、可審計、不能自由 rewrite |
| Offline report cleanup | 面試結束後，提供更乾淨的 evidence transcript | 可較慢，但要保留 raw transcript，且不可補使用者沒說的事 |

WhisperX / faster-whisper 這類 open-source 工具適合做 offline second pass，因為它們能處理 word timestamps、VAD、alignment 等任務。但它們不應該被視為「真相來源」直接覆蓋 live answer；它們應該是另一份 candidate evidence。

參考：WhisperX

https://github.com/m-bain/whisperX

參考：faster-whisper

https://github.com/SYSTRAN/faster-whisper

---

## 為什麼不能過度校準

過度校準有三個產品風險。

### 1. 評分不公平

如果系統把使用者的回答修得更完整、更有邏輯，最後評分的是 AI 改寫後的答案，不是使用者的面試表現。

### 2. Report 失去可信度

Report 需要能回到 evidence。若 transcript 被大量 rewrite，使用者或 reviewer 會無法知道哪些是候選人原話，哪些是 AI 補的。

### 3. Hallucination 風險

Whisper hallucination research 顯示，speech-to-text 系統可能產生使用者沒有說過的內容。LLM correction 如果沒有邊界，會把這個問題放大。

參考：Careless Whisper: Speech-to-Text Hallucination Harms

https://arxiv.org/abs/2402.08021

---

## 建議 rollout 順序

### Phase 1：把 evidence 留完整

目標：不急著改 transcript，先讓系統保留更多 ASR evidence 和 glossary provenance。

- 保存 N-best alternatives。
- 保存每個 candidate 的 confidence。
- 保存 raw / normalized / selected transcript。
- 保存 contextual glossary item 的來源與 priority。
- 保存 calibration reason。
- 保留現有 confirmation gate。

這一步主要增加可審計性，風險最低。

### Phase 2：做 contextual glossary builder

目標：不維護全職業固定詞庫，而是從 CV/JD/current question 建立 session-scoped / question-scoped glossary。

- 從 CV raw text 抽取 project、company、tool、certification、school、domain acronym。
- 從 JD raw text 抽取 role title、requirement、tool、domain term、product name、regulatory term。
- 從 current question / interview plan 抽取本題正在測的 topic。
- 對每個詞標註 `source`、`priority`、`safeForPhraseList`、`safeForAutoCorrection`。
- 過濾太短、太普通、太 ambiguous 的詞，例如 `Go`、`R`、`C`。

### Phase 3：做 deterministic N-best rerank

目標：在不引入 LLM rewrite 的情況下，先處理最明顯的專有詞錯誤。

- 如果 N-best 其他候選包含重要 contextual glossary term，且 confidence 差距很小，可以選該候選。
- 如果該詞只適合提示、不適合自動修正，只放 Phrase List 或進 confirmation。
- 若證據不足，不自動修，走 confirmation。

這一步是最符合外部研究的安全主路徑。

### Phase 4：加入 constrained LLM helper

目標：只處理 deterministic 方法無法覆蓋、但對 scoring 有影響的詞。

LLM 輸入應該包含：

- raw transcript
- N-best alternatives
- current interview question
- contextual glossary with source evidence
- allowed correction types
- forbidden changes

LLM 輸出不應該是全段改寫，而應該是：

```json
{
  "shouldChange": true,
  "changes": [
    {
      "from": "post gray SQL",
      "to": "PostgreSQL",
      "reason": "technical term from glossary and N-best support",
      "confidence": "high"
    }
  ]
}
```

### Phase 5：offline report candidate

目標：面試結束後，讓 report 的 evidence 更容易讀，但保留 raw transcript。

- 可以做 second-pass ASR。
- 可以做 punctuation / formatting cleanup。
- 可以把 obvious ASR corrections 標出。
- 不可刪除會影響 communication clarity 的 hesitation evidence。
- 不可覆蓋 live accepted answer，除非產品明確設計成 reviewer/user confirmation 流程。

---

## 成功標準

這個功能成功，不是因為 transcript 看起來更漂亮，而是因為錯誤變少且更可審計。

建議 metrics：

| Metric | 代表什麼 |
| --- | --- |
| Technical-term correction precision | 被修的技術詞有多少是真的修對 |
| False correction rate | 有多少校準其實改錯或過度猜測 |
| Confirmation reduction rate | 不必要 confirmation 是否變少 |
| Confirmation safety rate | 低置信長回答是否仍被正確攔截 |
| Downstream answer scoring stability | 同一段音訊在校準前後是否避免誤判，但沒有虛增分數 |
| Latency impact | live loop 是否仍接近 3 秒 first-audio 目標 |
| Provenance coverage | 每個被改的 transcript 是否都有 raw/candidate/glossary source/reason |

最重要的 guardrail：

```text
任何校準都必須能回答：
1. 原本 ASR 聽成什麼？
2. 系統改成什麼？
3. 為什麼有足夠證據支持這個改動？
4. 這個改動是否只修 transcript，而沒有改善答案內容？
5. 支持這個改動的 glossary item 來自 CV、JD、current question，還是使用者已確認的 correction？
```

---

## 對 stakeholder 的建議決策

建議支持這個方向，但 scope 要寫清楚。

可以批准的產品方向：

- 改善 technical term / acronym / proper noun 的 STT 準確度。
- 從 CV/JD/current question 動態產生 contextual glossary，而不是維護全職業固定詞庫。
- 使用 N-best alternatives 和 contextual glossary 做受限校準。
- 保留 raw transcript 和校準理由。
- 低置信但內容充足時，維持使用者確認。
- offline report cleanup 只作 evidence candidate，不靜默改寫 live answer。

不應批准的方向：

- 用 LLM 自動把回答潤飾成更完整。
- 用 CV/JD 補使用者沒說的內容。
- 只用 confidence threshold 全量觸發 rewrite。
- 為了 report 好看而刪掉所有 hesitation / filler。
- 不保存 raw transcript、glossary source 或 correction reason。

---

## 對現有計畫的修正建議

`docs/further_plan/voice-transcript-calibration-plan.md` 的大方向是對的：它已經抓到 Phrase List、N-best、LLM correction、offline cleanup 這幾個方向。

但需要調整三點：

1. **LLM correction trigger 要收窄**

   不要把 `confidence < 0.85` 當作自動 rewrite 條件。應改成「scoring-impacting uncertainty + N-best/glossary/context evidence + latency allowed」。

2. **offline cleanup 不能把 filler 全部刪掉**

   `uh`、`um`、停頓、重講，有時是 communication clarity 的 evidence。可以做 readable view，但要保留 raw evidence。

3. **contextual glossary 和 N-best provenance 要先於 LLM**

   外部研究更支持 constrained correction。第一優先應該是從 CV/JD/current question 產生 contextual glossary，再用 N-best rerank，不是自由 LLM rewrite。

---

## Source locators

本文件的 repo 現況依據：

- Voice product contract: `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`
- Current technical plan: `docs/further_plan/voice-transcript-calibration-plan.md`
- Business/product direction: `docs/Further_requirement.md`
- Chinese repo guide voice module: `repo-docs/modules/feature-voice-interview.md`
- Azure realtime STT session: `backend/src/services/voice/realtimeSpeechSessionService.js`
- Confidence gate: `backend/src/services/voice/speechConfidenceGate.js`
- Confidence thresholds: `backend/src/config/speechConfidenceConfig.js`
- Phrase list: `backend/src/config/speechPhraseList.js`
- Static transcript replacements: `backend/src/config/transcriptReplacements.js`
- Turn coordinator: `backend/src/services/voice/duplexTurnCoordinator.js`
- Realtime voice answer saving/evaluation: `backend/src/services/voice/realtimeVoiceTurnService.js`
- Report answer filtering: `backend/src/services/report/reportTurnDatasetService.js`

證據狀態：除特別標註外，本文件基於目前 repo 文件、目前 source behavior、以及外部 ASR research / open-source references 的已確認方向。這份文件不代表已完成實作。
