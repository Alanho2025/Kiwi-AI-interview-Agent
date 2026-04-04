## 1) PostgreSQL 適合放什麼

適合放這種：

- user account
- login provider
- interview session
- uploaded file metadata
- parsed structured fields
- question records
- response records
- report summary
- score / status / timestamps

這些資料有共同特徵：

- 欄位相對穩定
- 需要 foreign key
- 需要 filter / sort / join
- 後面 dashboard 很可能會查

---

## 2) MongoDB 適合放什麼

適合放這種：

- 原始 parsing 結果
- LLM 產生的 question plan
- transcript chunks
- follow-up reasoning
- full feedback details
- prompt / response logs
- session memory
- debug logs
- dynamic JSON 結構

這些資料有共同特徵：

- 格式可能常改
- nested object 多
- 同一類資料長得不一定完全一樣
- 不想每次改 schema 都要 migration

---

## 3) PDF / file storage 適合放什麼

適合放：

- 原始 CV PDF / DOCX
- 原始 JD PDF / DOCX
- 產出的 feedback report PDF
- optional transcript export PDF

注意：

**PDF 本體不要塞進 PostgreSQL 或 MongoDB 裡面。**

DB 只存：

- file_id
- file_url / object_key
- file_type
- size
- checksum
- uploaded_at

這樣就夠了。

---

# 二、推薦的整體 entity 分層

---

# A. PostgreSQL entities

## 1. users

存登入後的使用者主資料

```
users
- id (uuid, pk)
- email (unique)
- full_name
- auth_provider-- google / local
- google_sub-- Google user id, nullable
- created_at
- updated_at
```

### 關係

- 1 user : many interview_sessions
- 1 user : many uploaded_files

---

## 2. interview_sessions

每一次 mock interview 一筆 session

```
interview_sessions
- id (uuid, pk)
- user_id (fk-> users.id)
- status-- draft / ready / in_progress / completed / failed
- mode-- voice / text_future
- started_at
- ended_at
- duration_seconds
- overall_score-- nullable
- summary_text-- short summary only
- created_at
- updated_at
```

### 關係

- 1 session : 1 CV file
- 1 session : 1 JD file
- 1 session : many questions
- 1 session : many responses
- 1 session : 1 report_summary
- 1 session : 1 mongo document group

---

## 3. uploaded_files

只存檔案 metadata，不存檔案本體

```
uploaded_files
- id (uuid, pk)
- user_id (fk-> users.id)
- session_id (fk-> interview_sessions.id)
- file_role-- cv / jd / report_pdf / transcript_pdf
- original_filename
- mime_type
- storage_provider-- local / s3 / gcs
- storage_key
- file_url
- file_size_bytes
- checksum
- uploaded_at
```

### 關係

- many files belong to one session
- one session 通常至少有一個 cv 和一個 jd

---

## 4. parsed_profiles

存「已標準化」後、方便查詢的結果

這裡只放核心結構化欄位，不放很深的 JSON

```
parsed_profiles
- id (uuid, pk)
- session_id (fk-> interview_sessions.id,unique)
- candidate_name
- experience_years
- highest_education
- current_title
- location
- cv_summary
- jd_summary
- match_score
- created_at
- updated_at
```

---

## 5. parsed_skills

因為 skills 是多值，建議拆表

```
parsed_skills
- id (uuid, pk)
- session_id (fk-> interview_sessions.id)
- source_type-- cv / jd
- skill_name
- skill_category-- technical / soft / tool / domain
- importance_level-- required / preferred / detected
```

這樣你之後很好查：

- 某 session 的 JD required skills
- 某 user 最常被缺少的 skill
- CV skill 與 JD skill overlap

---

## 6. interview_questions

每一題一筆

```
interview_questions
- id (uuid, pk)
- session_id (fk-> interview_sessions.id)
- question_order
- question_type-- self_intro / follow_up / technical / behavioural
- source_type-- template / generated / fallback
- question_text
- based_on_cv-- boolean
- based_on_jd-- boolean
- asked_at
```

---

## 7. interview_responses

每一題對應回答

```
interview_responses
- id (uuid, pk)
- session_id (fk-> interview_sessions.id)
- question_id (fk-> interview_questions.id)
- transcript_text
- audio_duration_seconds
- response_started_at
- response_ended_at
- word_count
- created_at
```

---

## 8. report_summaries

報告的「可查詢核心摘要」

```
report_summaries
- id (uuid, pk)
- session_id (fk-> interview_sessions.id,unique)
- overall_score
- communication_score
- technical_score
- confidence_score
- strengths_summary
- gaps_summary
- suggestions_summary
- created_at
```

---

# B. MongoDB collections

MongoDB 這邊不是拿來取代 PostgreSQL。

是拿來放 **AI 工作過程中那些又長又彈的資料**。

---

## 1. session_analysis

存整個 CV/JD parsing 與 matching 的詳細 JSON

```
{
  "_id":"session_analysis_001",
  "session_id":"uuid",
  "cv_raw_text":"...",
  "jd_raw_text":"...",
  "cv_entities": {
    "skills": ["Python","SQL","React"],
    "projects": [
      {
        "name":"Music recommendation system",
        "tech_stack": ["Python","AWS","PostgreSQL"]
      }
    ],
    "experience": [...]
  },
  "jd_entities": {
    "required_skills": ["Python","Communication"],
    "preferred_skills": ["AWS","Node.js"],
    "responsibilities": [...]
  },
  "matching": {
    "matched_skills": [...],
    "missing_skills": [...],
    "fit_reasoning":"..."
  },
  "created_at":"..."
}
```

### 為什麼放 MongoDB

因為這種資料：

- nested 很深
- 欄位可能一直改
- prompt engineering 一變，結構也可能變

---

## 2. interview_plans

存 AI 預先規劃出的題目池和策略

```
{
  "_id":"interview_plan_001",
  "session_id":"uuid",
  "time_limit_seconds":300,
  "strategy": {
    "opening":1,
    "follow_up":3,
    "technical":2
  },
  "question_pool": [
    {
      "type":"self_intro",
      "text": "Please introduce yourself...",
      "reason":"default opener"
    },
    {
      "type":"technical",
      "text":"Can you explain your Python project?",
      "reason":"matched JD skill"
    }
  ],
  "fallback_rules": {
    "short_answer":"ask_probe",
    "time_low": "end_early"
  }
}
```

---

## 3. session_transcripts

存逐段 transcript chunk，適合長對話

```
{
  "_id":"transcript_001",
  "session_id":"uuid",
  "turns": [
    {
      "speaker":"ai",
      "question_id":"uuid",
      "text":"Please introduce yourself.",
      "timestamp":"..."
    },
    {
      "speaker":"user",
      "question_id":"uuid",
      "text":"My name is Alan...",
      "timestamp":"..."
    }
  ],
  "full_transcript":"...",
  "updated_at":"..."
}
```

---

## 4. session_feedback_details

存完整 feedback，不只摘要

```
{
  "_id":"feedback_001",
  "session_id":"uuid",
  "scores": {
    "overall":72,
    "communication":75,
    "technical":68,
    "clarity":74
  },
  "strengths": [
    {
      "title":"Clear self-introduction",
      "evidence":"The user gave a concise role summary."
    }
  ],
  "gaps": [
    {
      "title":"Technical depth",
      "evidence":"The answer lacked architecture details."
    }
  ],
  "improvement_suggestions": [
    {
      "area":"STAR example",
      "suggestion":"Use one measurable example."
    }
  ],
  "model_metadata": {
    "model":"xxx",
    "prompt_version":"v1"
  }
}
```

---

## 5. ai_logs 或 session_debug_logs

這個很實用，debug 神器

```
{
  "_id":"log_001",
  "session_id":"uuid",
  "stage":"question_generation",
  "input_payload": {...},
  "output_payload": {...},
  "status":"success",
  "created_at":"..."
}
```

正式版可以關掉或縮減，但開發期真的很好用。

不然 AI 問題亂掉時，你只會一臉問號。

---

# C. PDF / file storage layer

這層建議存在：

- local `/uploads/...`
- 或 AWS S3
- 或 Google Cloud Storage

## 檔案類型

### 原始輸入檔

- CV PDF / DOCX
- JD PDF / DOCX / TXT

### 系統產出檔

- feedback_report.pdf
- optional transcript_export.pdf

## file storage 只需要對應 uploaded_files 表

也就是說：

- PDF 本體在 object storage
- metadata 在 PostgreSQL
- 解析結果在 MongoDB / PostgreSQL

---

# 三、推薦的 entity relationship

---

## PostgreSQL ER 關係

```
users
 └──< interview_sessions
       ├──< uploaded_files
       ├──1 parsed_profiles
       ├──< parsed_skills
       ├──< interview_questions
       │     └──< interview_responses
       └──1 report_summaries
```

---

## MongoDB logical relation

```
interview_sessions.session_id
 ├── session_analysis
 ├── interview_plans
 ├── session_transcripts
 ├── session_feedback_details
 └── ai_logs
```

也就是說：

**PostgreSQL 當主索引與業務核心**

**MongoDB 當 AI 工作記憶與長 JSON 倉庫**

---

# 四、你這個專案最推薦的拆法

如果你要我直接幫你做可開發版本，我會推薦：

## PostgreSQL 放

- users
- interview_sessions
- uploaded_files
- parsed_profiles
- parsed_skills
- interview_questions
- interview_responses
- report_summaries

## MongoDB 放

- session_analysis
- interview_plans
- session_transcripts
- session_feedback_details
- ai_logs

## PDF/file storage 放

- cv source file
- jd source file
- generated report pdf
- transcript export pdf