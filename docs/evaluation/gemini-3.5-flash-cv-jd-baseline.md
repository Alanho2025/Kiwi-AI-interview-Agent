# Gemini 3.5 Flash CV-JD Match Baseline 評測報告

本報告包含候選人 **Alan Ho** 的履歷，針對 5 份從 Seek NZ 獲取的招募職位（JD），使用 **Gemini 3.5 Flash** 模型，依照 Kiwi AI Interview Agent 的 non-tech 產品與計分規則，所跑出的基線（Baseline）解析與匹配評測結果。

---

## 候選人履歷基準 (Alan Ho - CV Profile)
*   **學歷背景**：奧克蘭大學資訊技術碩士 (MIT, GPA: 7.75/9, 2025 - Present)；中原大學電機工程碩士 (GPA: 8.6/9, 2014 - 2016)。
*   **商業經驗**：富士康資深電機工程師 (2021 - 2024)、助理電機工程師 (2018 - 2021)，主導 Apple NPI 專案的測試數據分析、失效調查與流程改善。
*   **軟體開發與 AI 技能**：
    *   **開發語言/框架**：React, Node.js, Express, JavaScript, TypeScript, Python, SQL, MATLAB, C/C++。
    *   **數據與庫**：PostgreSQL, MongoDB, 數據清洗、驗證、報表、試算表分析。
    *   **AI 項目經驗**：KIWI Mock Interview AI Agent (本專案，全端)、Full-Stack Food AI Agent (Forkcast, 帶領 6 人團隊開發)。

---

## JD 1: Senior Software Engineer (Agentic) - Caruso
*   **Seek URL**: `https://nz.seek.com/job/93131845`
*   **招聘公司**: Caruso (AI-native 私募基金行政平台)
*   **行業與領域**: 金融科技 (FinTech) / 軟體研發

### 1. JD 結構化解析基線 (JD Parse Rubric Baseline)
*   **職位名稱**: Senior Software Engineer (Agentic)
*   **級別**: Senior (資深)
*   **必備要求 (Must-have)**:
    *   紐西蘭合法工作權利 (Right to work in NZ)
    *   Go, TypeScript, JavaScript, Python 或類似語言的商業開發經驗
    *   對 AI 輔助與 Agentic 開發有濃厚興趣/經驗
    *   強大的產品思維、好奇心與良好判斷力
    *   具備處理模糊性並將想法轉化為實務解決方案的能力
*   **技術棧需求 (Skills)**: Go, TypeScript, Next.js, React, GraphQL, gRPC, Protobuf, AWS, MySQL, DynamoDB, S3, Terraform, Docker.

### 2. CV-JD 匹配計分估算
*   **整體匹配得分**: **65/100**
*   **匹配結論**: **Needs Manual Review (需要人工複核/邊緣匹配)**
*   **維度得分**:
    *   **Macro Fit (宏觀契合度)**: 70/100 (有豐富的資深工程師背景與 Apple 專案主導經驗，但商業經歷屬於電機工程，缺乏多年商業軟體工程師職涯)。
    *   **Micro Fit (微觀契合度)**: 65/100 (具備 React, TypeScript, Python, SQL，但缺乏 Go, AWS, GraphQL, gRPC, Terraform 等核心技術)。
    *   **Requirements (要求覆蓋度)**: 60/100 (滿足 NZ 工作權與強烈 AI Agent 開發興趣，但 Go 商業開發經驗有缺口)。
*   **匹配詳情**:
    *   **優勢 (Matched Well)**: 候選人開發了 Kiwi Mock Interview AI Agent 與 Food AI Agent，與 JD 中強調的「Agentic開發、AI 核心工作流」有極高契合度與熱情；具備資深團隊協作與跨國客戶溝通能力。
    *   **缺失與風險 (Gaps & Risks)**: 缺乏商業軟體工程師經歷；完全無 Go 語言經驗；無 AWS / Terraform 雲端基礎架構的實務經驗。

---

## JD 2: Junior-Intermediate Frontend Developer - Humankind (Aviation SaaS)
*   **Seek URL**: `https://nz.seek.com/job/93211367`
*   **招聘公司**: Humankind (代表航空 SaaS 客戶)
*   **行業與領域**: 航空科技 / 軟體研發

### 1. JD 結構化解析基線 (JD Parse Rubric Baseline)
*   **職位名稱**: Junior-Intermediate Frontend Developer
*   **級別**: Junior-Intermediate (初中階 / 優秀畢業生)
*   **必備要求 (Must-have)**:
    *   1-3 年前端或網頁應用開發經驗（接受優秀畢業生）
    *   紮實的 HTML, CSS, JavaScript 基礎
    *   對前端 UI/UX 及產品品質有真實興趣與細節專注度
    *   紐西蘭合法工作權，奧克蘭本地辦公
*   **加分/偏好要求 (Nice-to-have)**: React/Angular/Vue 框架、Python/Django 經驗、API 整合與 UX 設計。

### 2. CV-JD 匹配計分估算
*   **整體匹配得分**: **93/100**
*   **匹配結論**: **Strong Fit (極佳契合)**
*   **維度得分**:
    *   **Macro Fit (宏觀契合度)**: 90/100 (非常符合初中階/畢業生定位；在富士康有極強的細節專注力與數據分析經驗，能很好平移至 UI/UX 細節改善)。
    *   **Micro Fit (微觀契合度)**: 95/100 (React、JS 基礎穩固，具備 Python 經驗與 API 整合能力)。
    *   **Requirements (要求覆蓋度)**: 95/100 (完全符合奧克蘭本地、NZ工作權與前端框架要求)。
*   **匹配詳情**:
    *   **優勢 (Matched Well)**: 擁有兩個完整的 React/Node.js 全端專案經驗，對 UI/UX 有實際改善證明（如 Kiwi Agent 前端）；細節專注度極高（富士康 NPI 故障調查與 DOE 經歷可佐證）。
    *   **缺失與風險 (Gaps & Risks)**: 航空或受監管系統背景較為薄弱，但對 Junior 級別影響極小。

---

## JD 3: Software Engineer - Talent Army (Fully Remote)
*   **Seek URL**: `https://nz.seek.com/job/93218441`
*   **招聘公司**: Talent Army (代理遠端 SaaS 工作流平台客戶)
*   **行業與領域**: SaaS / 軟體研發

### 1. JD 結構化解析基線 (JD Parse Rubric Baseline)
*   **職位名稱**: Software Engineer
*   **級別**: Mid-level (2-5 年經驗)
*   **必備要求 (Must-have)**:
    *   2-5 年強大的 React 與 TypeScript 商業開發經驗 (Must-have)
    *   具備 SaaS 或軟體產品開發背景（偏好新創或中小企業）
    *   能夠高效獨立遠端工作
    *   對後端 TypeScript 開發有真實好奇心
    *   紐西蘭本地合法工作權
*   **加分要求 (Nice-to-have)**: Kubernetes, PHP/Laravel, 自動化測試, CI/CD, AI 輔助開發工具。

### 2. CV-JD 匹配計分估算
*   **整體匹配得分**: **62/100**
*   **匹配結論**: **Needs Manual Review (需要人工複核)**
*   **維度得分**:
    *   **Macro Fit (宏觀契合度)**: 60/100 (缺乏 2-5 年商業軟體產品或 SaaS 公司的開發經歷，過往商業工作集中於硬體測試工程)。
    *   **Micro Fit (微觀契合度)**: 70/100 (React, TypeScript, Node.js 技術相符；具備 CI/CD 與 AI 輔助工具的使用經驗)。
    *   **Requirements (要求覆蓋度)**: 55/100 (硬性商業軟體年資要求不符)。
*   **匹配詳情**:
    *   **優勢 (Matched Well)**: 掌握 React 與 TypeScript，對後端 TypeScript (Node.js/Express) 開發持開放且有實作經驗；具備 CI/CD (GitHub Actions) 及獨立排除技術障礙的能力。
    *   **缺失與風險 (Gaps & Risks)**: 缺乏 React/TS 的「商業」年資（均為學校與個人專案）；無 Kubernetes 或 PHP/Laravel 經驗。

---

## JD 4: 2026 Serato Graduate Programme - Software Development
*   **Seek URL**: `https://nz.seek.com/job/93135927`
*   **招聘公司**: Serato (全球領先的 DJ 與音樂音訊軟體公司)
*   **行業與領域**: 音訊軟體 / 音樂科技

### 1. JD 結構化解析基線 (JD Parse Rubric Baseline)
*   **職位名稱**: 2026 Serato Graduate Programme - Software Development
*   **級別**: Graduate (畢業生)
*   **必備要求 (Must-have)**:
    *   相關專業（如 Computer Science 或 Engineering）且 GPA 優異 (7+/9)
    *   對技術與音樂有熱情，團隊協作與溝通能力強
    *   熟悉 Agentic Engineering (智能體工程) 實踐
    *   紐西蘭本地合法工作權，能定期前往奧克蘭總部
*   **加分要求 (Nice-to-have)**: C++, Python, Agile, Test-Driven Development (TDD)。

### 2. CV-JD 匹配計分估算
*   **整體匹配得分**: **94/100**
*   **匹配結論**: **Strong Fit (完美契合 - 核心候選人)**
*   **維度得分**:
    *   **Macro Fit (宏觀契合度)**: 95/100 (學歷背景完美吻合，奧大 MIT 碩士，GPA 7.75/9 遠超要求門檻，且有帶領團隊的 Agile 與 GitHub 協作經驗)。
    *   **Micro Fit (微觀契合度)**: 90/100 (具備 Python, Agile, TDD, 與極為罕見的 Agentic Engineering 實作經驗；缺乏 C++)。
    *   **Requirements (要求覆蓋度)**: 95/100 (完全符合工作權、奧克蘭辦公、學歷與 GPA 要求)。
*   **匹配詳情**:
    *   **優勢 (Matched Well)**:
        *   **GPA 達 7.75/9**，完全踩中 GPA 7+ 的硬性篩選門檻。
        *   **Agentic Engineering 實踐經驗完美匹配**：候選人建立的 Kiwi Mock Interview AI Agent 是典型的 Agentic Engineering 實踐，包含 RAG、Guardrails、評測跑批等，能為 Serato 智能體工程方向帶來直接價值。
        *   具有敏捷開發 (Agile) 和 Git 版本控制的實踐記錄。
    *   **缺失與風險 (Gaps & Risks)**: 缺乏 C++ 開發經驗。

---

## JD 5: AI Product Engineer (Typescript/Angular/Java) - HI Technology & Innovation
*   **Seek URL**: `https://nz.seek.com/job/93129983`
*   **招聘公司**: HI Technology & Innovation (為大型營建科技客戶外包)
*   **行業與領域**: 營建科技 (Construction Tech) / 遠端開發

### 1. JD 結構化解析基線 (JD Parse Rubric Baseline)
*   **職位名稱**: AI Product Engineer
*   **級別**: Mid-Senior (具備獨立端到端交付與利益關係人溝通能力)
*   **必備要求 (Must-have)**:
    *   強大的 **Java** 後端開發實力 (Must-have)
    *   **TypeScript** 與 **Angular** 前端開發經驗 (Must-have)
    *   將 AI 整合進產品功能中，熟悉 Prompt、Eval 和 Guardrails 的優化
    *   具備高度的利益關係人（客戶）面對面沟通與產品思維
    *   紐西蘭本地合法工作權，能適應與美國西海岸時間的交疊 (NZT 下午為主)
*   **加分要求 (Nice-to-have)**: Google Firebase、PostgreSQL、Google Cloud Storage。

### 2. CV-JD 匹配計分估算
*   **整體匹配得分**: **53/100**
*   **匹配結論**: **Weak Fit / Gap (弱契合 / 技術棧不符)**
*   **維度得分**:
    *   **Macro Fit (宏觀契合度)**: 65/100 (雖然客戶溝通和失效分析經驗豐富，但缺少商業軟體工程師經歷)。
    *   **Micro Fit (微觀契合度)**: 50/100 (前、後端核心技術棧 Java 與 Angular 皆不具備，這是嚴重的硬傷)。
    *   **Requirements (要求覆蓋度)**: 45/100 (未滿足關鍵的 Java 和 Angular 硬性技能指標)。
*   **匹配詳情**:
    *   **優勢 (Matched Well)**: 在 AI 應用整合、Prompt 優化、評測設計（Kiwi Agent 的 Rubrics、Report QA）上非常熟練，且具備優秀的非技術溝通和產品思維。
    *   **缺失與風險 (Gaps & Risks)**:
        *   **無 Java 語言經驗** (JD 核心要求)。
        *   **無 Angular 前端框架經驗** (履歷均為 React)。
        *   需配合美西時間工作。

---

## 評測結論概要 (Summary Matrix)

| 職位編號 (Seek ID) | 職位名稱 (Role Title) | 招聘公司 (Company) | Gemini 匹配預估分數 | 匹配預估結論 | 最核心優勢 | 最核心缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| **93131845** | Senior Software Engineer (Agentic) | Caruso | 65 | Needs Manual Review | 強烈 AI Agent 開發熱情與實作 | 缺乏商業 Go 語言與軟體開發經歷 |
| **93211367** | Junior-Intermediate Frontend Developer | Humankind | 93 | Strong Fit | React全端背景與超強細節關注 | 無航空 SaaS 行業背景 |
| **93218441** | Software Engineer | Talent Army | 62 | Needs Manual Review | React/TS與遠端工作潛力 | 缺乏 React/TS「商業」年資 |
| **93135927** | 2026 Graduate Programme - Software Dev | Serato | 94 | Strong Fit | GPA 7.75/9 & 完美契合 Agentic 實踐 | 缺乏 C++ 語言經驗 |
| **93129983** | AI Product Engineer | HI Tech & Innovation | 53 | Weak Fit / Gap | AI 評測/Prompt優化與產品思維 | **完全無 Java 與 Angular 技術背景** |
