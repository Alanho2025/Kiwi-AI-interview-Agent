1. 你現在 code 的狀態：已經有主幹，但還缺 “why this role / why this evidence”
目前 code 已經有五個很強的基礎。
第一，CV/JD grounded workflow 已經成立。核心流程是 upload CV、review parsed CV、paste JD、review structured JD、match、plan、interview、report。

第二，question pipeline 已經不是亂問題。現在 question pool 會用 CV seeds、JD filter、match gaps、interview settings 組成 prepared pool。README 也明確說 prepared question pool 來自 CV seeds、JD filters、match gaps 和 settings。

第三，match gap 已經有高優先級。你的 questionPoolComposerService.js 裡 source priority 明確把 match_gap 設成 6、match_validation 設成 5，高於 cv_seed 的 3。這代表 code 已經在嘗試讓 gap validation 題優先於普通 CV 題。
而且 gap question 會從 analysisResult.gaps 生成，expected signals 包含 gap validation、adjacent experience、ownership，並且 priority、coverage、risk weight 都高。

第四，prepared question pool 有 readiness、reserve questions 和 novelty filtering。questionPoolPreparationService.js 會先 assess readiness，如果 degraded，就產生 bounded reserve questions，然後做 novelty filtering，再 persist accepted reserve questions。

第五，report 已經有 QA repair，不只是生成文字。executeReportAction 會先生成 report，再跑 QA，再進 runReportQaRepairLoop，最多兩次修復。
repair loop 也不是亂修，它會跳過 deterministic mismatch flags，避免 LLM 用漂亮文字把真 bug 蓋掉，然後重新 grounding candidate feedback claims，再 rerun QA。

你的缺口在這裡：現在系統知道 JD 要什麼，也知道 CV 有什麼，但還沒有足夠直觀地推導出 “這家公司為什麼要這個 role，以及這段 candidate evidence 為什麼能證明 fit”。

現在像是：

JD requirements -> CV match -> question pool -> report
你要升級成：
JD requirements
-> role intent / hiring logic
-> evidence map
-> interview proof strategy
-> role-specific practice
-> answer alignment report
這就是下一版架構。
2. 目標架構：加一層 Role-Fit Intelligence Layer
你要新增四個核心 feature module，正好對應你列的四件事。
Existing Kiwi pipeline

CV parse/review
JD parse/review
CV-JD match
Question pool
Adaptive interview
Report QA

New Role-Fit Intelligence Layer

1. Role Intent Decoder
2. Candidate Evidence Mapper
3. Role-Specific Practice Planner
4. Answer Alignment Evaluator
這四個 module 不需要把現有系統炸掉。它們應該插在現有 match、question pool、report 之間。
Feature 1 — Decode Role Intent
你要解決什麼
現在 JD analysis 常見問題是：它只抽技能、職責、年資、關鍵字。這些是「表層 requirement」。但 candidate 真正需要知道的是：
這家公司為什麼需要這個 role？
這個 role 解決什麼 business / workflow problem？
面試官可能想驗證什麼風險？
理想 candidate 需要證明什麼能力？
這其實接近 structured interview 裡的 job analysis 思路：問題要和 job-relevant content 對齊，而不是隨便問漂亮問題。structured interview research 也指出，面試問題與評分應該和工作分析、工作相關能力連起來，這能提升面試的可靠性與有效性。
新增 backend module
建議新增：
backend/src/services/jobDescription/roleIntentDecoderService.js
backend/src/services/jobDescription/roleIntentCriticService.js
backend/src/services/jobDescription/roleIntentSchema.js
backend/src/db/models/roleIntentProfileModel.js
RoleIntentProfile schema
你可以定義成這樣：
{
  jdFingerprint,
  companyName,
  roleTitle,
  roleDomain,

  rolePurpose: {
    shortStatement: "...",
    confidence: "high | medium | low",
    evidenceSource: "explicit_jd | inferred_from_jd | company_context"
  },

  businessProblemHypotheses: [
    {
      problem: "The team needs someone to automate manual workflows...",
      evidenceFromJD: ["automate reporting", "improve workflow"],
      confidence: "medium",
      uncertainty: "JD does not mention team size"
    }
  ],

  workflowPainPoints: [
    {
      painPoint: "manual process / slow turnaround / data quality / integration gap",
      likelyImpact: "time saving / accuracy / scale / customer experience",
      evidenceFromJD: [...]
    }
  ],

  idealCandidateSignals: [
    {
      signal: "can translate ambiguous business needs into working software",
      whyItMatters: "...",
      proofNeeded: ["project ownership", "stakeholder communication", "iteration"]
    }
  ],

  interviewProbeMap: [
    {
      interviewerMayTest: "Can the candidate work with unclear requirements?",
      likelyQuestions: [...],
      strongEvidenceLooksLike: [...]
    }
  ],

  missingInfoQuestions: [
    "What existing tools or systems does the team use?",
    "Is the role more integration-heavy or product-building-heavy?"
  ]
}
Prompt strategy
不要只叫 LLM “analyze JD”。要分三步：
Step 1: Extract explicit role signals from JD.
Step 2: Infer likely business/workflow problem, but label inference clearly.
Step 3: Critic checks whether each inference is supported by JD evidence.
這跟你現有 JD guarded parse 很合拍。你已經有 JD safeguard 和 human review gate。code alignment 裡也指出 JD parse safeguards 是 implemented，而且 JD path 是 pasted JD + structured parsing + review。
Frontend UI
在 JD review 後新增一張卡：
Why this role probably exists

1. Business problem
2. Workflow pain
3. What the interviewer may test
4. What strong evidence should prove
5. What is inferred vs directly stated
最重要的是要加 confidence label：
Directly stated in JD
Reasonable inference
Need confirmation
這能避免系統裝懂。NIST AI RMF 強調 AI 產品要把 trustworthiness considerations 放進設計、開發、使用和評估中；你的 role intent decoder 就要把 uncertainty 顯示出來，而不是假裝它是 HR 肚子裡的蛔蟲。
Feature 2 — Map Candidate Evidence
你要解決什麼
這是你產品的核心差異點。
大部分工具會說：

你有 React，JD 要 React，所以 match。
但真正有價值的是：
這份 JD 其實在找一個能把 ambiguous workflow 拆成可交付 software 的人。你的 Kiwi Agent 專案可以證明這點，但你不能只講用了 React/Node。你應該講你如何從 CV/JD parsing、question pipeline、report QA 裡建立可靠 workflow。
這叫 evidence translation。
新增 backend module
backend/src/services/evidence/candidateEvidenceGraphService.js
backend/src/services/evidence/roleEvidenceMapperService.js
backend/src/services/evidence/evidenceAngleClassifierService.js
backend/src/db/models/candidateEvidenceItemModel.js
backend/src/db/models/roleEvidenceMapModel.js
Evidence graph schema
每段 CV/project/work experience 都要變成 evidence item。
{
  evidenceId,
  source: "cv_project | cv_work_experience | user_added_example | transcript",
  title: "Kiwi AI Interview Agent",
  rawSnippet: "...",
  normalizedSummary: "...",

  proofAngles: [
    "technical_ownership",
    "workflow_thinking",
    "ai_integration",
    "debugging",
    "user_feedback_iteration",
    "communication"
  ],

  strengthSignals: {
    specificity: 4,
    outcomeEvidence: 3,
    personalOwnership: 5,
    roleRelevance: 4,
    credibility: 4
  },

  reusableFor: [
    {
      jdRequirementId,
      roleIntentSignalId,
      fitType: "direct | adjacent | weak | gap",
      explanation: "Shows ability to design multi-step AI workflow..."
    }
  ],

  answerUseGuidance: {
    bestForQuestions: [
      "Tell me about a complex technical project",
      "How do you use AI responsibly?",
      "How do you handle ambiguity?"
    ],
    avoidForQuestions: [
      "Tell me about customer conflict" 
    ],
    angleWarnings: [
      "Do not over-focus on implementation details if the question asks stakeholder communication."
    ]
  }
}
Mapping algorithm
你不應該只用 vector similarity。Resume-job matching research 正在往 semantic matching、hard negatives、explainability 走；例如 ConFit v2 用 LLM-generated hypothetical resumes 和 hard-negative mining 改善 resume-job matching，而 explainable job matching 研究也強調 semantic relatedness 和 explainability，而不是只看關鍵字。
你的 mapping score 應該是 hybrid：

Evidence fit score =
0.25 semantic relevance
0.20 JD requirement match
0.20 role intent match
0.15 specificity
0.10 personal ownership
0.10 outcome / metric strength
然後每個 requirement 給 top 3 examples：
Requirement: Build AI-assisted workflow tools

Best evidence:
1. Kiwi AI Interview Agent — direct evidence
2. Food Recommendation Agent — adjacent evidence
3. Foxconn automation script — transferable operational automation evidence
你一定要做 “same example, different angle” 管理
你前面說的「同一道菜」很關鍵。
同一個 project 可以用，但不能用同一個角度一直端出來。你要做：

exampleUsageLedger: {
  evidenceId: "kiwi-agent",
  usedAngles: [
    {
      questionId,
      angle: "technical_ownership",
      quality: "strong"
    }
  ],
  overuseRisk: "medium",
  nextRecommendedAngle: "stakeholder_workflow_translation"
}
報告可以直接提示：
You used Kiwi Agent twice.
That is okay because the angles were different:
- Q2: technical ownership
- Q5: AI safety and report QA

But avoid using it again for teamwork unless you clearly explain team interaction.
這會比普通 feedback 高一個級別。普通產品只說「example good」。你會說「這個 example 適合哪種問題，不適合哪種問題」。這才是教練，不是鼓掌機。
Feature 3 — Practise Role-Specific Answers
你要解決什麼
現在你已有 adaptive controller、prepared pool、question deduplication。問題是：prepared pool 還是偏「問題候選池」，不是「面試證據策略」。
你要新增一個：

Interview Proof Strategy
它決定這場 mock interview 必須覆蓋哪些 role intent、哪些 evidence、哪些 gap。
新增 module
backend/src/services/interview/roleSpecificPracticePlannerService.js
backend/src/services/interview/interviewCoverageContractService.js
backend/src/services/interview/evidenceUsageLedgerService.js
Coverage contract
每次 interview plan 產生時，同時產生一份 contract：
{
  sessionId,
  targetRoleIntentIds: [...],
  mustCover: [
    {
      type: "role_intent",
      id: "workflow_automation_problem",
      minQuestions: 1,
      requiredEvidenceOptions: ["kiwi-agent", "foxconn-automation"]
    },
    {
      type: "gap_validation",
      id: "cloud_deployment",
      minQuestions: 1,
      allowAdjacentEvidence: true
    },
    {
      type: "communication",
      id: "non_technical_translation",
      minQuestions: 1
    }
  ],
  avoidOveruse: {
    maxSameEvidenceRoot: 2,
    maxSameAngle: 1
  }
}
Modify current question ranking
你現在 code 已經有 source priority。下一步不是單純提高 match_gap 分數，而是把 roleIntentCoverage 加進 ranking。
現在可以加：

rankScore =
sourcePriority
+ roleIntentCoverageBoost
+ evidenceMapStrength
+ unmetCoverageBoost
+ gapRiskBoost
- duplicatePenalty
- evidenceOverusePenalty
你目前的 composer 已經會 build requirement items 和 gap items。requirement validation question 會問 “one example that shows your evidence for topic”。
你要把它升級成：
This question is testing whether you can prove [role intent].
Recommended evidence: [Project A or Work Experience B].
Do not answer only with tools. Show ownership + result.
Practice UI
在正式 interview 前增加一頁：
Your Proof Strategy for This Role

The company likely wants to know:
1. Can you solve X workflow problem?
2. Can you own Y technical implementation?
3. Can you communicate with Z stakeholders?

Best examples to prepare:
- Kiwi Agent: technical ownership / AI workflow / report QA
- Foxconn automation: operational automation / root cause / measurable impact
- Food Agent: team project / full-stack delivery / RAG

Risk:
- Cloud deployment evidence is weak
- Testing evidence needs a clearer example
這頁會超有價值。因為 job seeker 的焦慮不是「問我什麼」。是「我到底該拿哪個例子回答」。
LLM-based interview feedback systems已經在做 personalized practice interviews 和 structured feedback，例如 Zara 這類 LLM candidate feedback system；但你可以更進一步，把 practice 前的 evidence strategy 做出來。

Feature 4 — Report Answer Alignment
你要解決什麼
現在 report 已經 evidence-grounded，但你要讓它回答這幾個超關鍵問題：
這題有沒有回答到問題？
有沒有用對 example？
evidence 有沒有講清楚？
有沒有太 technical？
有沒有自然？
如果重講一次，怎麼講？
新增 module
backend/src/services/report/answerAlignmentEvaluatorService.js
backend/src/services/report/evidenceUsageDetectorService.js
backend/src/services/report/answerRewriteCoachService.js
backend/src/services/report/roleIntentCoverageReportService.js
frontend/src/components/report/AnswerAlignmentCard.jsx
frontend/src/components/report/EvidenceUsageMap.jsx
frontend/src/components/report/RoleIntentCoverageSection.jsx
Alignment evaluator contract
每個 turn 都要產生一個 alignment object：
{
  turnId,
  questionId,
  questionIntent: "validate_requirement | risk_probe | behavioural_star",
  testedRoleIntent: [...],
  expectedSignals: [...],
  candidateAnswerSummary: "...",

  detectedEvidenceUsed: [
    {
      evidenceId: "kiwi-agent",
      confidence: "high",
      angleUsed: "technical_ownership"
    }
  ],

  alignmentScores: {
    answeredQuestion: 4,
    evidenceChoiceFit: 5,
    evidenceClarity: 3,
    roleIntentFit: 4,
    specificity: 3,
    naturalness: 3,
    concision: 2
  },

  diagnosis: {
    mainIssue: "Good example, but too much implementation detail before explaining business value.",
    missedSignal: "result_or_impact",
    overuseRisk: "low"
  },

  betterAnswerPlan: {
    useSameExample: true,
    changeAngleTo: "workflow impact",
    structure: "CAR",
    spokenRewrite: "..."
  }
}
評分標準
你可以用 6 個分數，簡單但很有殺傷力：
1. Question Alignment
有沒有直接回答面試官問的問題？

2. Evidence Fit
用的 example 是不是這題最適合的？

3. Evidence Clarity
有沒有講清楚自己的 action、decision、result？

4. Role Intent Fit
有沒有證明這家公司真正要看的能力？

5. Delivery Naturalness
是不是像自然對話，而不是背稿或 technical dump？

6. Improvement Action
下一次要換 example、換 angle，還是補 result？
STAR/CAR 可以做輔助，不要變成死板 template。STAR technique 的價值在於幫候選人用 real examples 組織 answer，尤其適合 behavioural/situational questions；但你要讓它變成自然口語，不是每次都說 “my situation was”。
Report UI
每題 report 不要只顯示 score。要顯示這種：
Q: Tell me about a time you solved an ambiguous technical problem.

Your answer:
Used example: Kiwi AI Interview Agent
Evidence choice: Strong
Why: This example proves workflow design + AI integration + ownership.

Main issue:
You explained the architecture before explaining the problem. The interviewer may not understand why it mattered.

Better version:
“I built Kiwi Agent because generic interview tools ask broad questions...”
這會直接打中你的第三個 gap。
3. Feature 優化 roadmap：按 PR 拆，不要一口吞
Phase 0 — Freeze baseline
先做一件很無聊但很重要的事：鎖定現在版本，建立 baseline。
你現在有 testing/eval structure，code alignment 也列出 backend robustness、frontend tests、Playwright E2E 和 AI eval runners。
建立 baseline metrics：

JD intent clarity score
Evidence mapping usefulness score
Question relevance score
Duplicate question rate
Answer alignment report usefulness
Cost per session
Latency
User confidence before/after
不要一邊改一邊覺得變好了。AI 產品最會製造「感覺進步」。很會演，跟面試候選人一樣。
Phase 1 — Role Intent Decoder
改這些地方：
backend/src/services/jobDescription/
frontend/src/components/analyze/
backend/src/controllers/jobDescriptionController.js
新增 endpoint 或擴充原本 JD parse response：
POST /api/job-description/paraphrase
returns:
structuredJDRubric
roleIntentProfile
safeguard
Frontend JD review 後顯示：
Role Purpose
Business Problem
Workflow Pain
Ideal Candidate Signals
Likely Interview Probes
Evidence Needed
Phase 2 — Candidate Evidence Mapper
改這些地方：
backend/src/services/cv/
backend/src/services/evidence/
backend/src/services/match/
frontend/src/components/analyze/MatchResult
把 CV parsed profile 轉成 evidence graph。
然後 match result 不只顯示：

Strengths / Gaps
而是顯示：
Requirement -> Best evidence -> Why it works -> How to say it
例如：
JD signal:
Build AI-assisted workflow tools

Best evidence:
Kiwi AI Interview Agent

Why it works:
It proves you can connect CV/JD parsing, question planning, voice/text interview flow, and report QA into one workflow.

How to say it:
Focus on workflow design and reliability, not just React/Node.
Phase 3 — Role-Specific Practice Planner
改這些地方：
backend/src/services/questions/questionPoolComposerService.js
backend/src/services/questions/questionPoolPreparationService.js
backend/src/services/questions/interviewTurnOrchestratorService.js
backend/src/services/agents/interviewerAgent.js
保留你現有 adaptive design。不要改成固定題庫。
但要新增 coverage contract：
每場 interview 必須覆蓋：
- Top 3 role intent
- Top 3 candidate strengths
- Top 2 gaps
- At least 1 communication/storytelling question
你的 code-document alignment 已經提醒：prepared pool 是 adaptive candidate material，不是 fixed script；這點要保留。
Phase 4 — Answer Alignment Report
改這些地方：
backend/src/services/report/reportTurnDatasetService.js
backend/src/services/report/turnRubricService.js
backend/src/services/report/reportFeedbackBuilder.js
backend/src/services/report/reportScoreService.js
frontend/src/components/report/
目前 report 已經有 accepted-answer pairing、question-specific rubric、deterministic scores、turn breakdown、evidence sources 和 transcript risks。
你要把這些資料再往前推一步：不是只評「好不好」，而是評「對不對題、例子對不對、證據清不清楚」。
新增 report section：

Answer Alignment
Evidence Usage Map
Role Intent Coverage
Example Reuse Warning
Better Spoken Answer
Phase 5 — UI 做成 job seeker 能看懂
你現在很多能力在 backend，很強，但使用者不知道就等於沒有。下一版 UI 要圍繞三張卡：
1. Why this role exists
2. Your best evidence for this role
3. How your answer aligned with the question
這三張卡就是你的產品定位。
不要再把 UI 做成「系統流程展示」。要做成「job seeker 決策輔助」。使用者不關心 questionPoolReadiness，他關心：

我現在能不能上場？
我該講哪個例子？
我哪裡講偏了？
4. Evaluation plan：你要證明它真的比市面產品多做一步
你的 academic / venture story 不能只說「我感覺更好」。你需要設計 evaluation。
Baseline comparisons
至少比較三組：
A. Generic ChatGPT prompt
B. Existing Kiwi version
C. New Kiwi Role-Fit version
也可以加：
D. 市面 mock interview product observation
但 D 要小心。你自己的試用可以叫 “competitor observation”，不要說成大規模結論。
Human evaluation rubric
找 10–20 個 job seekers，給同一份 CV + JD，讓他們完成：
1. JD understanding task
2. Example selection task
3. Mock interview task
4. Report usefulness rating
每個 user 量化：
Role intent clarity: 1–5
Best evidence selected correctly: yes/no
Answer alignment score: 1–5
Confidence before/after: 1–5
Would pay: yes/no / price range
System metrics
Top-1 evidence mapping precision
Top-3 evidence mapping usefulness
Question relevance score
Gap coverage rate
Duplicate question rate
Report QA pass rate
Report repair rate
Cost per session
Median time to report
RAG 和 grounded report 不能只說「用了 retrieval 所以可靠」。RAG 本身仍然可能 hallucinate 或使用不充分 evidence，所以你要保留 QA、claim grounding、uncertainty label 和 human review。RAG hallucination evaluation 研究也提醒，即使有 context，LLM 仍可能產生 unsupported information 或 contradiction。
5. 參考文獻怎麼放進 report
你的 literature review 可以分四塊。
A. AI interview coaching
用來說明 AI mock interview 和 LLM feedback 是一個真方向。Zara paper 可以當直接相關案例，因為它做 personalized practice interviews、conversational assessments、structured feedback 和 RAG candidate support。
B. Structured interview / behavioral evidence
用來支持你為什麼要把 JD 轉成 role intent、interview probes 和 evidence criteria。structured interview literature 強調 job-relevant content、question consistency、answer-level rating 和 anchored scoring。
C. Resume-JD semantic matching
用來說明傳統 match score 不夠。ConFit v2 和 explainable job matching 都指向 semantic matching、hard negatives、knowledge graph / explainability 這條路。
D. Trustworthy AI / grounded feedback
用來支持你為什麼需要 human review、evidence labels、QA repair、claim grounding、diagnostics。NIST AI RMF 明確把 AI 風險管理、trustworthiness、設計/開發/使用/評估連在一起。
你自己的 AI safety framework 也已經整理出 human-in-the-loop、explainable AI、guardrails、references 和 documentation 五個控制點。
6. Venture plan 怎麼寫
Velocity $100k 的 judging criteria 很清楚：Problem Statement、Solution、Market Opportunity and Customer Validation 各 20 分，Business Model、Financial Considerations、Founding Team 各 10 分，Executive Summary 和 Overall Quality 各 5 分。
Rules 裡也定義 $100k Challenge 第一階段要交 Venture Plan 和 Business Model Canvas，第二階段才是對 judges presentation。
你的 venture plan 應該這樣寫。

1. Executive Summary
一句話：
Kiwi is a role-fit interview coaching agent that decodes why a company is hiring, maps a candidate’s real evidence to that hiring logic, runs JD-specific practice interviews, and reports whether each answer used the right example and answered the interviewer’s intent.
這句比 “AI mock interview platform” 強太多。因為後者滿街都是，前者像有腦。
2. Problem Statement
不要寫太大。你真正的 problem 是：
Job seekers do not only struggle with interview practice.
They struggle to understand the hiring logic behind a JD,
translate their own experience into role-relevant evidence,
and deliver that evidence naturally in an interview.
拆成三個 pain：
JD comprehension gap
Evidence translation gap
Interview delivery gap
你自己的故事可以當 founder insight：你做了 survey，但真實面試、CDES 準備、產品試用和失敗經驗反而揭示更強烈的 need。這不是翻車，是 customer discovery 進化，算是把坑踩成資料。
3. Solution
寫四件事：
1. Decode role intent
2. Map candidate evidence
3. Practise role-specific answers
4. Report answer alignment
然後對應到你已經做出的 prototype：
Implemented:
- CV upload and review
- JD structured parsing and review
- CV-JD match
- prepared question pool
- text/voice interview
- adaptive follow-up
- evidence-grounded report
- report QA and bounded repair

Next version:
- role intent decoder
- candidate evidence graph
- proof strategy planner
- answer alignment report
這樣 judges 會看到：你不是拿 idea 空談，你有 working system。
4. Target Customer
先不要打所有 job seekers。太散。
第一個 beachhead：

International students and early-career graduates applying for internships or junior roles in New Zealand.
理由：
They have projects and experience, but often struggle to translate them into local interview evidence.
They need role-specific preparation, not generic confidence tips.
They are used to paying for learning tools, tutoring, CV review, or career support.
第二市場：
University career services
Bootcamps
Employability programmes
Immigration/career coaching agencies
5. Customer Validation
你目前可以放：
- 30-person survey as early weak signal
- Real self-use case: one failed interview exposed the evidence translation gap
- Product trials with existing tools: generic feedback did not fully solve JD intent/evidence alignment
- CDES / mock interview feedback as qualitative validation
但你要誠實：survey 不是最強 evidence。真正下一步是：
Run 15–20 structured user tests:
- each user uploads CV + target JD
- completes one practice
- rates clarity of role intent
- rates usefulness of evidence mapping
- completes a second answer
- compare answer alignment improvement
Velocity 會喜歡這個，因為 criteria 明確看 customer discovery、key learnings、iteration。
6. Business Model
先給三層。
B2C Freemium
- Free: 1 JD intent decode + limited report
- Paid: NZ$15–25 per role-prep pack or NZ$29/month

B2B2C University / Career Service
- Seat-based licence
- Cohort dashboard
- Anonymous improvement analytics
- Career advisor review mode

Career coach / bootcamp tool
- Coach uses Kiwi to prepare evidence maps and practice reports faster
- Charge per cohort or per coach seat
不要一開始就主攻 enterprise HR。那會碰到 hiring fairness、selection liability、privacy、bias，一腳踩進泥潭。你現在應該定位成 candidate-side coaching tool，不是 employer-side screening tool。
7. Financial Considerations
不要亂報成本。你 code 已經有 commercial stress test 和 usage tracking where instrumented；code alignment 也說 DeepSeek/Azure cost estimation exists where instrumented，但 ElevenLabs pricing 還是 zero estimated cost until pricing added。
你的 venture plan 用公式：

Gross margin per session =
price per session
- LLM cost
- STT cost
- TTS cost
- storage cost
- payment/platform cost
然後 report 裡放：
Measured cost from system logs:
- CV parse cost
- JD parse cost
- match cost
- interview turn cost
- report generation cost
- QA repair cost
這比估一個漂亮數字更可信。
8. Differentiation
不要說「我們有 AI voice interview」。這個不夠。
你的 differentiation 是：

Most tools practise interview questions.
Kiwi builds a role-fit evidence strategy first.

Most tools give generic feedback.
Kiwi checks whether the answer used the right evidence for the question.

Most tools treat JD as requirements.
Kiwi decodes hiring logic and interview intent.

Most tools score fluency.
Kiwi scores alignment: question intent, evidence fit, role relevance, clarity, and natural delivery.
這段可以直接放 pitch。
9. Defensibility
你的 defensibility 不是模型本身。是：
1. Evidence translation workflow
2. Question + answer alignment dataset
3. Role intent schema
4. Report QA + repair pipeline
5. Longitudinal candidate improvement data
6. University / career-service domain learning
越多人用，你越知道：
which evidence works for which role,
which answers fail,
which JD signals predict interview questions,
which coaching advice improves second attempts.
這才是資料飛輪。
10. Risk
要誠實列：
Privacy risk: CVs, JDs, transcripts are sensitive.
Hallucination risk: role intent may be inferred incorrectly.
Overconfidence risk: users may trust feedback too much.
Voice risk: ASR errors can distort feedback.
Market risk: job seekers may like free tools unless value is clearly differentiated.
Control：
Human review gates
Evidence labels
Confidence levels
No unsupported claims
Report QA
Transcript-risk warning
Deletion/export policy
Candidate-side coaching only
No hiring decision automation
這和你的 safety framework 對齊：human-in-the-loop、explainable output、guardrails、references、documentation。
7. 你接下來最應該做的 10 個 PR
按優先級來。
Add RoleIntentProfile schema
JD parse 後產生 role purpose、business problem、ideal candidate signals、interview probes。
Add Role Intent Review UI
讓 user 確認哪些是 directly stated，哪些是 inference。
Build CandidateEvidenceGraph
從 CV projects/work experience 建 evidence item。
Build RoleEvidenceMap
Requirement / role intent → top evidence examples → why it fits → how to say it。
Add Evidence Strategy page before interview
顯示 “for this role, prepare these examples”。
Extend question pool metadata
每個 question 加 testedRoleIntentIds、recommendedEvidenceIds、evidenceAngle。
Add evidence usage ledger
追蹤同一 example 是否過度使用，以及 angle 是否重複。
Add AnswerAlignmentEvaluator
每題評 question alignment、evidence fit、clarity、role intent fit、naturalness。
Add Answer Alignment Report UI
每題顯示：用對例子了嗎？回答到問題了嗎？怎麼口語改寫？
Build evaluation dataset
20 個 CV/JD pairs + manually labelled role intent/evidence mapping/alignment rubric。
最後一句話
你現在不要再把 Kiwi 定位成 “AI interview practice”。那個市場太擠，而且很容易被看成 wrapper。
你真正的定位應該是：

Kiwi helps job seekers translate a job description into hiring logic, translate their own experience into role-relevant evidence, and practise until their answers clearly prove fit.
這句就是你的產品北極星。接下來所有 code、report、pitch、venture plan 都圍繞它走。
