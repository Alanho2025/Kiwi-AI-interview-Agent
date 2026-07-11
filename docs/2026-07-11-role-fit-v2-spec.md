# Role-Fit Closed Loop v2 Spec

狀態：final implementation spec；V2-0 至 V2-6 first slices 已落地，external release gates 仍待完成  
日期：2026-07-11 NZST  
執行模式：Builder / Author  
對應目標：[Role-Fit Closed Loop v2 Goal](2026-07-11-role-fit-v2-goal.md)
實作追蹤：[Role-Fit Closed Loop v2 Implementation Trace](2026-07-11-role-fit-v2-implementation-trace.md)
實作敘事：[Role-Fit Closed Loop v2 Implementation Narrative](2026-07-11-role-fit-v2-implementation-narrative.md)

## Overview

### Goal

Build Role-Fit Closed Loop v2 on top of the current Role-Fit foundation. The feature upgrades Kiwi from requirement-centered preparation to hiring-logic coaching:

```text
company evidence
  -> reviewed hiring logic
  -> candidate evidence strategy
  -> proof strategy
  -> metadata-aware interview
  -> answer alignment report
```

### Risk class

High. The feature processes CV evidence, job context, company claims, interview transcript and inferred hiring risks. Incorrect output may lead a candidate to misrepresent their background or the employer. Deterministic validation, source/review confidence separation, user review, privacy ownership and QA blocking are required.

### Source material

- `docs/role_fit_recommend_by_chatGPT.md`
- `docs/role-fit-implementation-trace.md`
- `docs/role-fit-goal.md`
- `docs/role-fit-spec.md`
- `docs/role-fit-removal-manifest.md`
- `repo-docs/modules/user-facing-cv-jd-behavior.md`
- `repo-docs/modules/feature-match-and-question-prep.md`
- `repo-docs/modules/feature-report-and-qa.md`
- `backend/src/services/jobDescription/roleFitProfileBuilder.js`
- `frontend/src/components/analyze/JobContextCard.jsx`
- `backend/src/services/report/answerAlignmentService.js`

### Implementation authority

The user approved treating this V2 as the final goal on 2026-07-11 NZST. Code changes still follow repository approval boundaries: dependency install, real-provider eval, destructive cleanup and git push require separate approval.

## Requirements

### Functional requirements

| ID | Requirement | Acceptance behavior |
| --- | --- | --- |
| RFV2-001 | Split source confidence from review confidence for company facts, role intent and evidence mappings. | User edits can set review status/confidence, but original source confidence and uncertainty remain inspectable. |
| RFV2-002 | Build website-grounded company understanding when a valid company URL is supplied. | Company claims derived from website content include source snippets; URL-only claims remain `supplied_url_only` and cannot become factual company evidence. |
| RFV2-003 | Add SSRF and content safety around website fetch. | Private IPs, localhost, unsafe redirects, unsupported content types, excessive size and long timeouts are blocked with diagnostics. |
| RFV2-004 | Upgrade role intent from JD requirement extraction to hiring-logic decoding. | Output includes role purpose, business problem hypotheses, workflow pain points, ideal candidate signals, interview probes and hiring risks. |
| RFV2-005 | Keep RoleIntentDecoder bounded by source evidence and human review. | Unsupported hypotheses are `needs_confirmation` or blocking, never auto-confirmed; low-confidence or conflicted hiring logic emits compact diagnostics and degraded reasons. |
| RFV2-006 | Promote Candidate Evidence Graph v2 as the evidence strategy source. | Evidence items include proof angles, strength signals, fit limits, how-to-say-it and avoid-using guidance. |
| RFV2-007 | Extend Role Evidence Map with hiring-logic links. | Each role intent links to direct/adjacent/weak/gap evidence with source traces and angle warnings. |
| RFV2-008 | Add compact diagnostics to parse, match, plan, session and report payloads. | `roleFitDiagnostics` exposes status, counts, degraded reasons and source limitations without raw private evidence. |
| RFV2-009 | Add Proof Strategy preparation UX. | Before interview, user sees why the role likely exists, what may be tested, best evidence and risks/gaps in English. |
| RFV2-010 | Preserve live interview no-hint behavior. | Active text/voice UI never shows recommended evidence, proof point IDs, internal rank candidates or answer templates. |
| RFV2-011 | Harden question ranking with Role-Fit metadata. | Rank trace separates base score from role intent coverage, evidence strength, unmet coverage, gap risk and overuse penalty. |
| RFV2-012 | Upgrade Answer Alignment report dimensions. | Per accepted answer, report evaluates question alignment, evidence fit, evidence clarity, role intent fit, naturalness and concision. |
| RFV2-013 | Expand deterministic report QA. | QA blocks ungrounded company claims, missing evidence IDs, unsupported alignment claims, wrong evidence use and must-cover omissions. |
| RFV2-014 | Expand eval and calibration. | At least 12 adversarial cases and human calibration records are required before production-quality claims. |
| RFV2-015 | Refactor preparation orchestration boundaries. | `jobDescriptionController` stays thin; role-fit source sanitizing, website evidence, company understanding, role intent decoding and review validation live in focused services. |

### Non-functional requirements

| Area | Requirement |
| --- | --- |
| Voice latency | No website fetch, heavy role intent decode, unbounded retrieval or extra blocking LLM lane in turn-time voice path. |
| Reliability | Every degraded state has a stable diagnostic code and user-safe message. |
| Privacy | Raw CV, transcript, manual company context and fetched company snippets stay private and owner-scoped. |
| Compatibility | Current v1 sessions/reports remain readable. New v2 artifacts must be additive or versioned. |
| Cost control | Real provider evals and paid fetch/search providers require approval. Mock-safe tests remain default. |
| UX language | Candidate-facing UI and reports use English. Technical docs may use Chinese. |
| Maintainability | Follow controller/service/repository/component boundaries in `docs/clean-code-rules.md`. |

## Contracts

### Shared enums

```yaml
source_confidence: [high, medium, low, unsupported]
review_confidence: [unreviewed, user_confirmed, user_modified, needs_revision]
company_source_type: [company_website, user_context, jd_context, supplied_url_only, inference]
claim_status: [grounded, needs_confirmation, unsupported, degraded]
evidence_fit_type: [direct, adjacent, weak, gap]
diagnostic_severity: [info, warning, blocking]
alignment_label: [strong, partial, weak, off_target, unavailable]
```

Rules:

- `review_confidence=user_confirmed` does not change `source_confidence`.
- `supplied_url_only` cannot support a factual company claim.
- `inference` can support a hypothesis only when marked with uncertainty and review state.
- `direct`, `adjacent` and `weak` require traceable candidate evidence.
- `gap` is the only valid fit type when no source trace exists.

### Data models

```yaml
SourceReviewEvidence:
  sourceType: company_source_type|candidate_cv|accepted_transcript
  sourceId: string|null
  sourceLabel: string
  excerpt: string|null
  url: string|null
  section: string|null
  sourceConfidence: source_confidence
  reviewConfidence: review_confidence
  uncertainty: string|null

CompanyWebsiteEvidence:
  schemaVersion: company_website_evidence_v1
  userId: string
  normalizedUrl: string
  fetchStatus: fetched|blocked|failed|not_attempted
  safetyBlocks:
    - code: private_ip|localhost|redirect_limit|content_type|max_bytes|timeout
      message: string
  pages:
    - url: string
      title: string|null
      snippets: [string]
      fetchedAt: ISODate
  retentionUntil: ISODate
  deletedAt: ISODate|null
  containsSensitiveData: true
  accessScope: private

CompanyUnderstandingProfileV2:
  schemaVersion: company_understanding_v2
  companyName: string|null
  summary: string
  businessModel: [SourceReviewEvidence]
  customersOrUsers: [SourceReviewEvidence]
  productsOrServices: [SourceReviewEvidence]
  operatingContext: [SourceReviewEvidence]
  hiringContextHypotheses:
    - id: string
      statement: string
      evidenceRefs: [SourceReviewEvidence]
      claimStatus: claim_status
      uncertainty: string|null
  reviewStatus: draft|needs_review|user_confirmed|needs_revision

RoleIntentDecoderOutputV2:
  schemaVersion: role_intent_decoder_v2
  rolePurpose:
    shortStatement: string
    evidenceRefs: [SourceReviewEvidence]
    claimStatus: claim_status
  businessProblemHypotheses:
    - id: string
      statement: string
      evidenceRefs: [SourceReviewEvidence]
      sourceConfidence: source_confidence
      reviewConfidence: review_confidence
      hiringRiskIfWeak: string
  workflowPainPoints: [RoleHypothesisV2]
  idealCandidateSignals: [IdealCandidateSignalV2]
  interviewProbeMap:
    - probeId: string
      testedIntentIds: [string]
      expectedSignals: [string]
      riskReduced: string
  uncertainties: [string]
  diagnostics: [RoleFitDiagnostic]

CandidateEvidenceGraphV2:
  schemaVersion: candidate_evidence_graph_v2
  evidenceItems:
    - evidenceId: string
      source: cv_project|cv_work_experience|cv_achievement|user_added_example|accepted_transcript
      title: string
      sourceTrace: SourceReviewEvidence
      proofAngles: [string]
      strengthSignals:
        specificity: 0..100
        outcomeEvidence: 0..100
        personalOwnership: 0..100
        credibility: 0..100
      howToSayIt: [string]
      avoidUsingFor: [string]
      fitLimits: [string]

RoleFitDiagnostic:
  code: string
  severity: diagnostic_severity
  message: string
  sourceIds: [string]
  degradedReason: string|null

RoleFitDiagnostics:
  schemaVersion: role_fit_diagnostics_v1
  companyContextStatus: missing|url_supplied|grounded|manual|degraded|failed
  companyUnderstandingStatus: draft|needs_review|user_confirmed|degraded|failed
  roleIntentStatus: draft|needs_review|user_confirmed|degraded|failed
  unsupportedInferenceCount: integer
  evidenceMapCoverage: number|null
  proofStrategyStatus: not_started|ready|degraded|failed
  answerAlignmentStatus: not_started|ready|limited|unavailable
  degradedReasons: [string]
  sourceLimitations: [string]
```

### API contracts

Prefer in-place extension of current endpoints unless implementation discovery proves a separate route is safer.

```yaml
POST /api/job-description/paraphrase:
  input:
    rawJD: string
    companyWebsiteUrl: string|null
    userCompanyContext: string|null
  output_extension:
    companyWebsiteEvidence: CompanyWebsiteEvidence|null
    companyUnderstandingProfile: CompanyUnderstandingProfileV2
    roleIntentProfile: RoleIntentDecoderOutputV2
    roleFitDiagnostics: RoleFitDiagnostics
  errors:
    422:
      - missing_company_context
      - blocked_company_website
      - unsupported_company_claim

PUT /api/job-description/role-fit/reviews/:profileId:
  input:
    expectedVersion: integer
    companyUnderstandingPatch: object
    roleIntentPatch: object
    confirmCompanyUnderstanding: boolean
    confirmRoleIntent: boolean
  rules:
    - server recomputes sourceConfidence
    - user patch may set reviewConfidence/reviewStatus only on allowlisted fields
    - blocking diagnostics prevent confirmation

GET /api/role-fit/preparation/:matchAnalysisId:
  output:
    proofStrategyView: object
    roleFitDiagnostics: RoleFitDiagnostics
  redaction:
    - no raw CV snippets unless the page already owns private prep context
    - no hidden ranking candidates

GET /api/sessions/:sessionId:
  output_extension:
    analysisSetup.roleFitDiagnostics: RoleFitDiagnostics
  active_session_redaction:
    - no recommendedEvidenceIds
    - no proofPointId
    - no internal rank candidates
    - no prompt or raw reasoning

GET /api/reports/:sessionId:
  output_extension:
    report.roleFit.answerAlignmentsV2: [AnswerAlignmentV2]
    report.roleFit.roleFitDiagnostics: RoleFitDiagnostics
```

No endpoint may trust client-supplied `sourceConfidence`, `fitType`, `score`, `reviewStatus`, `QA pass/fail` or `userId`.

## Behavior

### Preparation flow

```text
raw JD + website/manual context
  -> source sanitizer
  -> guarded website evidence fetch/extract
  -> JD rubric
  -> company understanding v2
  -> role intent decoder v2
  -> critic + user review
  -> candidate evidence graph v2
  -> role evidence map v2
  -> proof strategy view
  -> interview plan
```

Required gating:

1. CV review is current.
2. JD rubric is current.
3. Company context exists and is either grounded, manual-reviewed, or explicitly degraded.
4. Company understanding and role intent are reviewed.
5. High-priority unsupported inferences are resolved, downgraded or blocked.
6. Evidence map is ready or degraded with explicit fallback.

### Website evidence behavior

| Condition | Required behavior |
| --- | --- |
| Valid URL, fetch succeeds | Extract bounded snippets and attach source references. |
| Valid URL, fetch blocked by safety | Keep URL as `supplied_url_only`, emit blocking/degraded diagnostic, ask for manual context. |
| Valid URL, fetch fails | Keep URL as `supplied_url_only`, emit degraded diagnostic, allow manual context fallback. |
| Manual context exists | Use as `user_context`; source confidence cannot exceed `medium` unless independently corroborated. |
| Website and manual context conflict | Surface uncertainty and require review; do not silently pick one. |

### Role intent behavior

RoleIntentDecoder v2 must not only restate JD requirements. It must produce hiring logic hypotheses:

```text
role purpose
business/workflow problem
ideal candidate signal
hiring risk if weak
interview probe
source evidence and uncertainty
```

If there is no source support for business/workflow purpose, the decoder should return a `needs_confirmation` hypothesis, not a confident statement.

### Interview behavior

- Proof metadata is computed before interview start.
- Runtime ranking may use metadata server-side.
- Active live payload excludes evidence hints and internal proof labels.
- Voice state machine, STT confirmation, question counting and latency markers remain authoritative.
- Low-confidence contentful transcript does not advance coverage or create alignment until accepted.

### Report behavior

AnswerAlignmentV2 is generated only for accepted question-answer pairs with valid proof metadata.

Required dimensions:

| Dimension | Weight |
| --- | ---: |
| Question Alignment | 0..20 |
| Evidence Fit | 0..20 |
| Evidence Clarity | 0..20 |
| Role Intent Fit | 0..20 |
| Naturalness | 0..10 |
| Concision | 0..10 |

Report QA blocks:

- `role_intent_reference_missing`
- `answer_alignment_without_proof_point`
- `alignment_claim_not_grounded`
- `company_claim_not_in_reviewed_profile`
- `evidence_id_not_found`
- `must_cover_intent_unreported`
- `review_confidence_misused_as_source_truth`
- `website_url_used_without_content_evidence`

## BDD Scenarios

```gherkin
Scenario: User review does not overwrite source confidence
  Given a role intent hypothesis was inferred from JD wording with medium source confidence
  When the user edits and confirms the wording
  Then reviewConfidence becomes user_confirmed
  And sourceConfidence remains medium
  And downstream report copy does not claim the employer independently verified that intent

Scenario: Website URL alone cannot support a company fact
  Given the candidate supplies a valid company website URL
  And website content was not fetched or extracted
  When company understanding is generated
  Then the website reference is marked supplied_url_only
  And factual company claims from that URL are needs_confirmation or blocked

Scenario: Private network URL is blocked
  Given the candidate submits a localhost or private-IP company URL
  When website evidence fetch starts
  Then the fetch is blocked before network access
  And roleFitDiagnostics includes blocked_company_website
  And the UI asks for manual company context

Scenario: Role intent decoder produces hiring logic
  Given a JD says the candidate will build automation tools for internal teams
  When RoleIntentDecoder v2 runs with reviewed company context
  Then it produces a workflow pain hypothesis
  And it identifies a hiring risk around workflow discovery or stakeholder adoption
  And it maps at least one interview probe to that risk

Scenario: Weak evidence is not upgraded
  Given a role intent needs production cloud ownership
  And the candidate only has a student deployment example
  When Role Evidence Map v2 is built
  Then the fit type is adjacent or weak
  And the limitation is visible in the prep/report surfaces
  And no report copy calls it direct production ownership

Scenario: Proof strategy is shown before but not during interview
  Given the evidence strategy is ready
  When the candidate opens preparation
  Then they see best evidence, gaps and likely interviewer tests
  When the candidate starts live interview
  Then the active interview UI does not show recommended examples or proof point labels

Scenario: Accepted answer receives alignment coaching
  Given an accepted answer is paired with a question testing a role intent
  And the answer uses a traceable evidence item
  When report generation runs
  Then AnswerAlignmentV2 includes six dimension scores
  And the better answer plan explains whether to reuse the same example or change angle

Scenario: Wrong example is diagnosed
  Given the candidate answers a stakeholder-risk question with a purely technical tool dump
  When AnswerAlignmentV2 runs
  Then questionAlignment may be partial
  And evidenceFit or roleIntentFit is weak
  And the coaching explains the missing stakeholder or business-risk signal

Scenario: Voice path remains light
  Given a voice session has precomputed proof metadata
  When the user finishes speaking
  Then turn-time code does not fetch website content
  And does not run RoleIntentDecoder v2
  And records roleFitQuestionRankingMs for diagnostics
```

## Verification

### Focused tests

| Layer | Required tests |
| --- | --- |
| JD/company services | URL safety, website fetch states, source snippets, manual fallback, source/review confidence split, unsupported claim blocking |
| Role intent decoder | hiring-logic fields, over-inference downgrade, prompt injection filtering, review version invalidation |
| Evidence graph/map | proof angles, direct/adjacent/weak/gap, source traceability, avoid-using guidance |
| Diagnostics | parse/match/plan/session/report payload shape and redaction |
| Question runtime | metadata ranking, overuse penalty, no live hints, v1/v2 compatibility |
| Voice | no turn-time website/decoder call, low-confidence confirmation, latency markers |
| Report | six-dimension scoring, wrong-example diagnosis, QA failure codes, TXT/PDF/UI rendering |
| Frontend | prep strategy page, degraded states, long-text wrapping, no nested cards, active interview no-hint |

### Eval suite

At least 12 adversarial cases:

1. Clear direct fit.
2. Missing evidence.
3. Adjacent / transferable evidence.
4. Career transition.
5. Noisy marketing-heavy JD.
6. Fake company context.
7. Prompt injection in JD.
8. Prompt injection in manual company context.
9. Company website unavailable.
10. Role intent over-inference.
11. Same project, different proof angle.
12. Answer uses wrong example.

Each case records:

- role intent correctness
- source/review confidence correctness
- unsupported claim rate
- evidence mapping correctness
- gap detection
- question relevance
- answer alignment diagnosis

### Commands

Use smallest checks first. Expected command groups:

```text
backend: npm run test:jd
backend: npm run test:match
backend: npm run test:questions
backend: npm run test:voice
backend: npm run test:report
backend: npm run test:retrieval
frontend: npm run test:all
frontend: npm run lint
```

Run `backend npm run test:all` and `frontend npm run quality:all` before structural phase completion when feasible. Do not run real AI evals, live speech provider checks or paid website/search provider checks without approval.

## Rollout

| PR | Scope | Main proof |
| --- | --- | --- |
| PR 1 | Contract hardening: confidence split, diagnostics, stale status cleanup | Backend/frontend contract tests |
| PR 2 | Website-grounded company understanding and SSRF guard | URL safety, fetch/degraded/conflict tests；bounded same-origin evidence capture 與 explicit manual/website conflict diagnostics 已開始落地，richer company-intelligence extraction/review UX 待後續 |
| PR 3 | CompanyUnderstanding v2, RoleIntentDecoder v2 and service boundary split | Company-understanding detail fields、hiring-logic decoder tests、compact role-intent diagnostics、controller thinness；deterministic detail/decoder slice 已開始落地，LLM/bounded critic expansion 待後續 |
| PR 4 | CandidateEvidenceGraph v2 and RoleEvidenceMap v2 | Source trace and fit-type tests |
| PR 5 | Proof Strategy UX and question ranking metadata | Prep UI tests, no-hint runtime tests |
| PR 6 | Answer Alignment v2 and report QA | Report/QA/TXT/PDF/UI tests |
| PR 7 | Adversarial eval, human calibration and cleanup | Versioned eval reports and calibration decision |

## Acceptance Criteria

v2 can be considered implemented only when:

1. Website-grounded and manual company context paths both work with clear degraded behavior.
2. Role intent includes hiring logic, not only JD requirement restatement.
3. Human edits preserve source confidence separately from review confidence.
4. Candidate evidence has source traces, proof angles and fit limitations.
5. Proof Strategy is visible before interview and absent from live answer-hint UI.
6. Answer Alignment report diagnoses wrong example, weak evidence and off-target answers.
7. Diagnostics make silent degradation impossible across parse, match, plan, interview and report.
8. The adversarial suite and human calibration are complete enough to set or explicitly defer release thresholds.
9. Browser visual, voice flow and retention contract gates remain separately tracked; voice 3 秒 next-question SLO 超標不得被隱藏。

## Unresolved Decisions

| Decision | Default unless changed |
| --- | --- |
| Website page scope | Fetch only bounded official/same-origin pages from user-provided URL. |
| External search | Not allowed in v2 without separate approval. |
| Company source storage | Store snippets/references, not full raw pages, unless retention policy explicitly permits. |
| Human calibration size | 12 adversarial cases are reviewed; current release threshold decision is 0.85. |
| Existing v1 docs | Keep as shipped foundation trace. Add v2 docs as next-phase contract until implementation starts. |

## Repo-docs sync decision

Current `repo-docs/` describes shipped behavior and has been updated for V2. If later work changes parse/match/question/report/voice behavior, patch the relevant Chinese guide module and `repo-docs/change-log.md` in that same turn.

證據狀態：本 spec 已從下一輪藍圖更新為 V2 final local implementation contract。Release evidence 聚合於 `backend/eval/reports/role-fit-release-gate.latest.json`；狀態為 `ready_with_known_issues`，known issue 是 voice next-question first audio 超過 3 秒。
