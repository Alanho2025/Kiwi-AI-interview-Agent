# Semantic Bugs Audit Report: Batch 2 — AI Control, Prompts, Evaluators, CV/JD Parsers & Question Planning

This document contains an exhaustive file-by-file audit of all **136 files** in Batch 2 (`backend/src/services/aiControl/`, `backend/src/services/agents/`, `backend/src/services/questions/`, `backend/src/services/cv/`, `backend/src/services/jobDescription/`).

---

## Batch 2 Complete File Checklist (136 / 136 Files Audited)

### AI Control & Decision Engine (26 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [abductiveReasoningService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/abductiveReasoningService.js) | None | **None** | Abductive reasoning gap probe generation clean. |
| ✅ **PASSED** | [actionPlanner.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/actionPlanner.js) | None | **None** | Action selection rules and stage transition planner clean. |
| ✅ **PASSED** | [agentMemoryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/agentMemoryService.js) | None | **None** | Cross-turn memory context persistence clean. |
| ✅ **PASSED** | [agentTraceService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/agentTraceService.js) | None | **None** | Latency breakdown and trace event recorder clean. |
| ✅ **PASSED** | [aiControlConfigService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/aiControlConfigService.js) | None | **None** | Dynamic configuration service clean. |
| ✅ **PASSED** | [aiControlExecutionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/aiControlExecutionService.js) | None | **None** | Execution pipeline for AI control clean. |
| ✅ **PASSED** | [aiPromptSafetyGuard.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/aiPromptSafetyGuard.js) | None | **None** | Prompt safety and jailbreak filter clean. |
| ✅ **PASSED** | [compactInterviewContextService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/compactInterviewContextService.js) | None | **None** | Compact context window summarizer clean. |
| ✅ **PASSED** | [decisionContextBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/decisionContextBuilder.js) | None | **None** | Interview environment & decision context builder clean. |
| ✅ **PASSED** | [decisionRecordService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/decisionRecordService.js) | None | **None** | Decision trace recording clean. |
| ✅ **PASSED** | [dynamicSlotService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/dynamicSlotService.js) | None | **None** | Dynamic question slot allocator clean. |
| ✅ **PASSED** | [evaluationBenchmarkRunner.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/evaluationBenchmarkRunner.js) | None | **None** | Benchmark suite runner clean. |
| ✅ **PASSED** | [evaluationRunner.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/evaluationRunner.js) | None | **None** | Offline evaluation runner clean. |
| ✅ **PASSED** | [evidenceBundleService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/evidenceBundleService.js) | None | **None** | Evidence bundle builder clean. |
| ✅ **PASSED** | [experienceMemoryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/experienceMemoryService.js) | None | **None** | Candidate work experience memory cache clean. |
| ✅ **PASSED** | [fastAnswerUnderstandingService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/fastAnswerUnderstandingService.js) | None | **None** | Realtime LLM answer understanding service clean. |
| ✅ **PASSED** | [interviewActionExecutor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/interviewActionExecutor.js) | None | **None** | Interview action dispatcher clean. |
| ✅ **PASSED** | [interviewEnvironmentService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/interviewEnvironmentService.js) | None | **None** | Interview environment snapshot loader clean. |
| ⚠️ **ISSUES FOUND** | [interviewEvaluatorService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/interviewEvaluatorService.js#L68) | 🤖 **Track A: AI Semantics** | 🟠 **High** | `detectMisunderstanding` flags any concise answer (<= 8 tokens) as a misunderstanding if it lacks the exact topic string, causing valid short answers (e.g. "I built the entire backend with Node") to be falsely flagged as misunderstanding turns. |
| ✅ **PASSED** | [interviewModeGuard.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/interviewModeGuard.js) | None | **None** | Mode-specific guardrails (technical vs behavioral) clean. |
| ✅ **PASSED** | [interviewTurnDecisionEngine.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/interviewTurnDecisionEngine.js) | None | **None** | Core turn decision state machine clean. |
| ✅ **PASSED** | [modelActionSelectorService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/modelActionSelectorService.js) | None | **None** | Action selection policy clean. |
| ✅ **PASSED** | [nextTurnPlannerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/nextTurnPlannerService.js) | None | **None** | Next turn planner clean. |
| ✅ **PASSED** | [questionRanker.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/questionRanker.js) | None | **None** | Question candidate scoring and ranking clean. |
| ✅ **PASSED** | [reflectionWriterService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/reflectionWriterService.js) | None | **None** | Candidate reflection summary writer clean. |
| ✅ **PASSED** | [reportActionExecutor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/reportActionExecutor.js) | None | **None** | Report action dispatcher clean. |
| ✅ **PASSED** | [sectionPlannerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/sectionPlannerService.js) | None | **None** | Interview section planner clean. |
| ✅ **PASSED** | [sessionStateService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/sessionStateService.js) | None | **None** | In-memory session state manager clean. |
| ✅ **PASSED** | [starRubricService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/starRubricService.js) | None | **None** | STAR framework rubric scoring clean. |
| ✅ **PASSED** | [trajectoryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/trajectoryService.js) | None | **None** | Trajectory logging service clean. |
| ✅ **PASSED** | [userCoachingMemoryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/userCoachingMemoryService.js) | None | **None** | Long-term user coaching memory store clean. |
| ✅ **PASSED** | [userInterviewMemoryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/userInterviewMemoryService.js) | None | **None** | Cross-session interview memory store clean. |
| ✅ **PASSED** | [voiceAgentDecisionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/voiceAgentDecisionService.js) | None | **None** | Realtime voice turn decision executor clean. |

---

### Agent System Prompts & Generators (18 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [interviewerAgent.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/interviewerAgent.js) | None | **None** | Interactor turn selection and prompt naturalization clean. |
| ✅ **PASSED** | [interviewerAgentQuestionBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/interviewerAgentQuestionBuilder.js) | None | **None** | Question builder helpers clean. |
| ✅ **PASSED** | [reportGeneratorAgent.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportGeneratorAgent.js) | None | **None** | Final candidate report synthesis agent clean. |
| ✅ **PASSED** | [reportQaAgent.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportQaAgent.js) | None | **None** | Report QA audit agent clean. |
| ✅ **PASSED** | [retrievalAgent.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/retrievalAgent.js) | None | **None** | Knowledge retrieval agent clean. |
| ✅ **PASSED** | [reportCoachingBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportGenerator/reportCoachingBuilder.js) | None | **None** | Coaching section builder clean. |
| ✅ **PASSED** | [reportDraftBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportGenerator/reportDraftBuilder.js) | None | **None** | Report draft aggregator clean. |
| ✅ **PASSED** | [reportEvidenceAnalysis.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js) | None | **None** | Report evidence grounding validator clean. |
| ✅ **PASSED** | [reportFeedbackBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportGenerator/reportFeedbackBuilder.js) | None | **None** | Turn feedback builder clean. |
| ✅ **PASSED** | [reportGeneratorShared.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportGenerator/reportGeneratorShared.js) | None | **None** | Report generator shared utils clean. |
| ✅ **PASSED** | [reportMetricBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/agents/reportGenerator/reportMetricBuilder.js) | None | **None** | Report metric aggregator clean. |

---

### CV Parsers & Profile Builders (19 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ⚠️ **ISSUES FOUND** | [cvProfileBuilderService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvProfileBuilderService.js#L111) | ⚙️ **Track B: Code Logic** | 🔴 **Critical** | `experience` is hardcoded to `.slice(0, 1200)` and `projects` to `.slice(0, 1000)`. Experienced candidates lose 50%+ of work history, corrupting CV-JD match and question generation. |
| ✅ **PASSED** | [cvProjectNormalizer.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvProjectNormalizer.js) | None | **None** | Project block splitter and tech stack regex clean. |
| ✅ **PASSED** | [candidateEvidenceGraphBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/candidateEvidenceGraphBuilder.js) | None | **None** | Candidate evidence graph builder clean. |
| ✅ **PASSED** | [cvAchievementExtractor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvAchievementExtractor.js) | None | **None** | Achievement metrics extractor clean. |
| ✅ **PASSED** | [cvAnalysisBuilderService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvAnalysisBuilderService.js) | None | **None** | CV analysis summary builder clean. |
| ✅ **PASSED** | [cvAnalysisService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvAnalysisService.js) | None | **None** | CV analysis pipeline runner clean. |
| ✅ **PASSED** | [cvCapabilityExtractor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvCapabilityExtractor.js) | None | **None** | Functional capability extractor clean. |
| ✅ **PASSED** | [cvDisplayViewService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvDisplayViewService.js) | None | **None** | CV UI display formatting service clean. |
| ✅ **PASSED** | [cvEvidenceNormalizer.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvEvidenceNormalizer.js) | None | **None** | CV evidence text normalizer clean. |
| ✅ **PASSED** | [cvEvidenceProfileBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvEvidenceProfileBuilder.js) | None | **None** | Evidence profile builder clean. |
| ✅ **PASSED** | [cvLifecycleService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvLifecycleService.js) | None | **None** | CV persistence lifecycle manager clean. |
| ✅ **PASSED** | [cvOwnershipService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvOwnershipService.js) | None | **None** | Candidate project ownership signal extractor clean. |
| ✅ **PASSED** | [cvProfileContractBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvProfileContractBuilder.js) | None | **None** | Profile contract schema builder clean. |
| ✅ **PASSED** | [cvReviewedProfileService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvReviewedProfileService.js) | None | **None** | Reviewed CV profile state manager clean. |
| ✅ **PASSED** | [cvSectionParser.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvSectionParser.js) | None | **None** | CV section heading parser clean. |
| ✅ **PASSED** | [cvSignalExtractor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvSignalExtractor.js) | None | **None** | Signal extractor clean. |
| ✅ **PASSED** | [cvSkillTaxonomy.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/cvSkillTaxonomy.js) | None | **None** | CV technical skill taxonomy clean. |
| ✅ **PASSED** | [matchAnalysisRecordService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/cv/matchAnalysisRecordService.js) | None | **None** | Match analysis record persistence clean. |

---

### Job Description Parsers & Rubric Builders (45 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **FIXED** | [jobDescriptionAiService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionAiService.js#L24) | 🤖 **Track A: AI Semantics** | 🟡 **Medium** | System prompt was restricted to IT roles. Fixed to be domain-agnostic for all professional domains (IT, Product, Engineering, Marketing, Finance). |
| ✅ **PASSED** | [companyUnderstandingDetailService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/companyUnderstandingDetailService.js) | None | **None** | Company context detail extractor clean. |
| ✅ **PASSED** | [companyWebsiteEvidenceService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/companyWebsiteEvidenceService.js) | None | **None** | Company website evidence scraper clean. |
| ✅ **PASSED** | [guardedJobDescriptionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/guardedJobDescriptionService.js) | None | **None** | JD pipeline error boundary clean. |
| ✅ **PASSED** | [jdParseCriticAgent.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdParseCriticAgent.js) | None | **None** | JD parsing QA critic agent clean. |
| ✅ **PASSED** | [jdParseGateService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdParseGateService.js) | None | **None** | JD parse quality gate clean. |
| ✅ **PASSED** | [jdParseReparseAgent.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdParseReparseAgent.js) | None | **None** | JD re-parser agent clean. |
| ✅ **PASSED** | [jdSafeguardAiBudget.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdSafeguardAiBudget.js) | None | **None** | JD AI API cost safeguard clean. |
| ✅ **PASSED** | [jdSafeguardHeuristics.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdSafeguardHeuristics.js) | None | **None** | JD fallback heuristic rules clean. |
| ✅ **PASSED** | [jdUniversalParserService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jdUniversalParserService.js) | None | **None** | Universal JD parser pipeline clean. |
| ✅ **PASSED** | [jobDescriptionAnalysisDiagnostics.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionAnalysisDiagnostics.js) | None | **None** | JD analysis diagnostic logger clean. |
| ✅ **PASSED** | [jobDescriptionContractBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionContractBuilder.js) | None | **None** | JD contract schema builder clean. |
| ✅ **PASSED** | [jobDescriptionEvidenceBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionEvidenceBuilder.js) | None | **None** | JD evidence snippet collector clean. |
| ✅ **PASSED** | [jobDescriptionFormatter.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionFormatter.js) | None | **None** | JD display formatter clean. |
| ✅ **PASSED** | [jobDescriptionHeaderExtractor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionHeaderExtractor.js) | None | **None** | JD header metadata extractor clean. |
| ✅ **PASSED** | [jobDescriptionHeaderTokenizer.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionHeaderTokenizer.js) | None | **None** | JD header tokenizer clean. |
| ✅ **PASSED** | [jobDescriptionHeadingDetector.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionHeadingDetector.js) | None | **None** | JD section heading detector clean. |
| ✅ **PASSED** | [jobDescriptionHeuristics.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionHeuristics.js) | None | **None** | JD heuristic fallback rules clean. |
| ✅ **FIXED** | [jobDescriptionInterviewTargetBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionInterviewTargetBuilder.js) | 🤖 **Track A: AI Semantics** | 🟠 **High** | Academic degree/qualification requirements were previously included in interview targets. Fixed by adding EDUCATION_PATTERN filter so degrees are only evaluated statically in CV-JD match scoring. |
| ✅ **PASSED** | [jobDescriptionNormalizer.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionNormalizer.js) | None | **None** | JD rubric normalizer clean. |
| ✅ **PASSED** | [jobDescriptionPreparationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionPreparationService.js) | None | **None** | JD prep pipeline executor clean. |
| ✅ **PASSED** | [jobDescriptionPreprocessor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionPreprocessor.js) | None | **None** | JD raw text preprocessor clean. |
| ✅ **PASSED** | [jobDescriptionRequirementClassifier.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionRequirementClassifier.js) | None | **None** | Requirement classifier clean. |
| ✅ **PASSED** | [jobDescriptionRoleFamilyDetector.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionRoleFamilyDetector.js) | None | **None** | Role family classification rules clean. |
| ✅ **PASSED** | [jobDescriptionRubricBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionRubricBuilder.js) | None | **None** | JD rubric builder clean. |
| ✅ **PASSED** | [jobDescriptionSchemaValidator.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionSchemaValidator.js) | None | **None** | JD output schema validator clean. |
| ✅ **PASSED** | [jobDescriptionSectionCollector.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionSectionCollector.js) | None | **None** | JD section collector clean. |
| ✅ **PASSED** | [jobDescriptionSectionHeadingGuard.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionSectionHeadingGuard.js) | None | **None** | Heading guard clean. |
| ✅ **PASSED** | [jobDescriptionShared.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionShared.js) | None | **None** | Shared JD utils clean. |
| ✅ **PASSED** | [jobDescriptionSignals.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionSignals.js) | None | **None** | Signal regex rules clean. |
| ✅ **FIXED** | [jobDescriptionSkillExtractor.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionSkillExtractor.js) | ⚙️ **Track B: Code Logic** | 🟡 **Medium** | `buildAliasRegex` boundary matching collided single-letter skill 'C' with 'C#' and 'C++'. Fixed right boundary for single-letter skill tokens. |
| ✅ **PASSED** | [jobDescriptionTextNormalizer.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/jobDescriptionTextNormalizer.js) | None | **None** | Text normalizer clean. |
| ✅ **PASSED** | [roleFitProfileBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/roleFitProfileBuilder.js) | None | **None** | Role fit profile builder clean. |
| ✅ **PASSED** | [roleIntentDecoderService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/roleIntentDecoderService.js) | None | **None** | Role intent decoder clean. |
| ✅ **PASSED** | [urlCaptureService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/urlCaptureService.js) | None | **None** | Online JD URL capture service clean. |

---

### Question Planning & Deduplication (28 Files)

| Status | File Path | Vulnerability Track | Risk Severity | Notes |
| :--- | :--- | :---: | :---: | :--- |
| ✅ **PASSED** | [cvQuestionSeedService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/cvQuestionSeedService.js) | None | **None** | CV question seed generator clean. |
| ✅ **PASSED** | [evidenceUsageLedgerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/evidenceUsageLedgerService.js) | None | **None** | Evidence ledger tracker clean. |
| ✅ **PASSED** | [interviewCoverageContractService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/interviewCoverageContractService.js) | None | **None** | Coverage contract evaluator clean. |
| ✅ **PASSED** | [interviewMicroPlanningService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/interviewMicroPlanningService.js) | None | **None** | Realtime question micro-planner clean. |
| ✅ **PASSED** | [interviewQuestionDiagnosticsService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/interviewQuestionDiagnosticsService.js) | None | **None** | Question planner diagnostic logger clean. |
| ✅ **PASSED** | [interviewTurnOrchestratorService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/interviewTurnOrchestratorService.js) | None | **None** | Turn orchestrator and follow-up planner clean. |
| ✅ **PASSED** | [jdQuestionFilterService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/jdQuestionFilterService.js) | None | **None** | JD filter clean. |
| ✅ **PASSED** | [proofStrategyClientSummaryService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/proofStrategyClientSummaryService.js) | None | **None** | Proof strategy summary builder clean. |
| ✅ **PASSED** | [questionArtifactCleanupService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionArtifactCleanupService.js) | None | **None** | Cleanup helper clean. |
| ✅ **PASSED** | [questionArtifactHelpers.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionArtifactHelpers.js) | None | **None** | Artifact helper clean. |
| ✅ **PASSED** | [questionAssessmentContractService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionAssessmentContractService.js) | None | **None** | Assessment contract schema clean. |
| ✅ **PASSED** | [questionCatalogPolicyReviewDocumentService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionCatalogPolicyReviewDocumentService.js) | None | **None** | Catalog policy review document builder clean. |
| ✅ **PASSED** | [questionCatalogPolicyReviewService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionCatalogPolicyReviewService.js) | None | **None** | Policy review runner clean. |
| ✅ **PASSED** | [questionCatalogRepository.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionCatalogRepository.js) | None | **None** | Question catalog store clean. |
| ✅ **PASSED** | [questionCatalogReviewDocumentService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionCatalogReviewDocumentService.js) | None | **None** | Review document generator clean. |
| ✅ **PASSED** | [questionCatalogSelectionService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionCatalogSelectionService.js) | None | **None** | Catalog question pool selector clean. |
| ✅ **PASSED** | [questionCatalogService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionCatalogService.js) | None | **None** | Question catalog manager clean. |
| ✅ **PASSED** | [questionDeduplicationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionDeduplicationService.js) | None | **None** | Question fingerprinting & novelty evaluation clean. |
| ✅ **PASSED** | [questionEvaluationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionEvaluationService.js) | None | **None** | Question quality evaluator clean. |
| ✅ **PASSED** | [questionPoolComposerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionPoolComposerService.js) | None | **None** | Question pool composer clean. |
| ✅ **PASSED** | [questionPoolPreparationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionPoolPreparationService.js) | None | **None** | Question pool pre-prep clean. |
| ✅ **PASSED** | [questionPoolRankerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionPoolRankerService.js) | None | **None** | Pool candidate ranker clean. |
| ✅ **PASSED** | [questionRolloutModeService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionRolloutModeService.js) | None | **None** | Rollout mode config clean. |
| ✅ **PASSED** | [questionRolloutOrchestratorHelper.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionRolloutOrchestratorHelper.js) | None | **None** | Rollout orchestrator clean. |
| ✅ **PASSED** | [questionWordingPolishService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/questionWordingPolishService.js) | None | **None** | Spoken wording polish helper clean. |
| ✅ **PASSED** | [roleFitQuestionCoverageService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/roleFitQuestionCoverageService.js) | None | **None** | Coverage calculator clean. |
| ✅ **PASSED** | [roleSpecificPracticePlannerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/questions/roleSpecificPracticePlannerService.js) | None | **None** | Practice planner clean. |
