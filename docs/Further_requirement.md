我會把你的核心問題拆成三層：
1. JD comprehension gap
現在很多 JD analysis 只會抽出：
技能、職責、年資、關鍵字、match score。
但它沒有很直觀地回答：
公司為什麼需要這個 role？這個 role 要解決什麼 business/workflow problem？理想 candidate 應該證明什麼能力？
所以 job seeker 看到的只是 requirements list，不是 hiring logic。
2. Evidence translation gap
Job seeker 可能其實有相關經驗，但不知道哪個 project、哪段 work experience、哪個 example 最能證明自己適合這份 role。
問題不是「沒有經驗」，而是：
不知道怎麼把經驗翻譯成 role-relevant evidence。
這超關鍵。因為同一個 project 可以講 technical ownership，也可以講 teamwork，也可以講 problem-solving。面試官問不同問題，你不能每次都端同一道菜，雖然我們都知道你那道菜可能真的蠻好吃。
3. Interview delivery gap
就算知道要講什麼，真正面試時也可能講得太散、太 technical、沒有回答到問題、example 不對題，或者聽起來不像自然對話。
所以練習報告不能只說：
“你的回答不錯。”
它應該清楚告訴使用者：
你有沒有用對 example？有沒有回答到面試官的問題？有沒有把 evidence 講清楚？有沒有講得自然？

應該做四件事：
Decode role intent
幫使用者看出這家公司要這個 role 的原因，以及面試官可能在測什麼。
Map candidate evidence
從 CV / project / experience 裡找出最適合證明這個 role fit 的 examples。
Practise role-specific answers
用真實 JD 和 candidate evidence 生成面試問題與追問，不是隨機題庫。
Report answer alignment
報告要明確告訴使用者：你這題有沒有用對 example？有沒有回答問題？哪裡講散了？怎麼改成更自然？

Business Requirement

JD Intake + Employer Intent
使用者可以貼 JD URL 或 raw text。
系統不只抽 skills，而要產出「The employer is hiring someone to help them...」。
每個 JD requirement 都要翻譯成「what they really mean」，例如 communication = 能否聽懂 messy business workflow 並轉成 AI automation。

Evidence-Based CV-JD Match
Match 要從「你有沒有 Python/SQL/AI」升級成「你能不能用具體 project/work evidence 說服 employer」。
每個 requirement 要分類：Strong evidence、Weak evidence、Missing evidence、Transferable evidence、Risk、Action。
Action 要能轉成 CV bullet、cover letter angle、STARR interview story、learning plan。

Application Strategy
Match 結果要回答：該不該投、如何定位自己、CV 強調哪三個 project、cover letter 主軸、面試準備哪四個故事、哪些 gap 不要硬裝。
對轉專業或轉方向的人，要明確處理「為什麼轉」和「哪些能力可轉移」。

Intent-Driven Interview
問題不只分 technical/behavioural，要按 employer intent 分層。
AI role 要問：怎麼發現 workflow pain、什麼時候用 AI、怎麼評估 AI output、怎麼處理 privacy/human review、怎麼把 PoC 推向可交付能力。
如果候選人有 career transition signal，要問轉換動機與 transferable evidence。

Interviewer-Intent Report
Report 不只說 STAR 好不好，而要說：這題面試官真正想確認什麼、答案是否降低 hiring risk、聽完是否更敢 hire。
例：non-tech communication 題不能只稱讚 15% 到 5% 結果，還要指出 stakeholder framing、communication method、NZ clinic staff transfer 是否講清楚。

Progress Loop
每次 mock 後要產生 before/after comparison。
建 competency progress map：role fit、structure、evidence、clarification、technical depth、communication、evaluation、adaptability。
允許使用者輸入真實面試回憶，系統判斷哪些 mock skill 轉移到了 real interview，形成 practice → real interview → reflection → next practice loop。
加 stuck moment detector，標記抽象概念卡住、validation 繞圈、答案斷掉、缺 result/reflection。

Voice Reliability
擴充 domain glossary：CV/JD/PMS/EMR/OCR/Vitest/Playwright/DOE/retest rate/Auckland Eye 等。
保留 contentful low-confidence transcript confirmation 的安全原則，但把 UX 目標改成「只對 scoring-impacting 詞做高價值確認」。
每輪後做 conservative transcript repair，只修常見 ASR 誤聽，不改意思，讓 report 和 follow-up 更穩。

