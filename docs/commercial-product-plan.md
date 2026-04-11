# Kiwi AI Interview Agent - Commercial Product Readiness Plan

## 1. Purpose

This plan rebuilds the previous code review into a **commercial product readiness roadmap**.
The goal is not only to make the system run, but to make it usable, trustworthy, maintainable, and extensible for real users after deployment.

This version treats the product as a real service that must survive:
- real user data
- privacy expectations
- production incidents
- future feature growth
- ongoing maintenance cost
- team handover and scaling

---

## 2. Product-Level Goal

The target is to move the system from a strong prototype into a product that is:

1. **Trusted by users** - users feel safe uploading CVs, JDs, and interview data.
2. **Easy to use** - the core flow is smooth, clear, and low-friction.
3. **Operationally stable** - the deployed system is observable, recoverable, and predictable.
4. **Maintainable after launch** - future developers can debug, modify, and extend it without breaking unrelated features.
5. **Extensible** - adding new interview modes, scoring logic, AI providers, or enterprise features should be realistic, not painful.

---

## 3. Core Product Principles

### 3.1 Trust before growth
If users do not trust file upload, session privacy, report privacy, or login safety, product growth will stall even if the demo looks good.

### 3.2 Smooth first-run experience
A user should be able to:
- sign in
- upload CV
- paste or upload JD
- understand what the system is doing
- complete an interview
- receive a report
without confusion or repeated friction.

### 3.3 Honest privacy promises
Privacy wording must match actual implementation. The New Zealand Privacy Act 2020 sets principles for collecting, storing, using, and sharing personal information, and Principle 5 requires safeguards that are reasonable in the circumstances to prevent loss, misuse, or disclosure. If there is a serious privacy breach, notification is expected as soon as possible, with the Office of the Privacy Commissioner indicating a 72-hour expectation for notifiable breaches. [Source](https://www.privacy.org.nz/privacy-principles/) [Source](https://www.privacy.org.nz/privacy-principles/5/) [Source](https://www.privacy.org.nz/responsibilities/privacy-breaches/)

### 3.4 Secure-by-default architecture
Every endpoint that acts on a user-owned object should verify ownership. OWASP highlights Broken Object Level Authorization as a top API risk and recommends object-level checks on every endpoint that receives an ID and acts on the related resource. [Source](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)

### 3.5 Build for change
Interview logic, report generation, AI provider selection, and retrieval logic will change. The code structure must assume future change, not resist it.

---

## 4. Commercial Readiness Review Framework

This plan uses 7 workstreams.

1. Privacy and user trust
2. User experience and convenience
3. Security and access control
4. AI workflow quality and explainability
5. Deployment and operational maintainability
6. Code maintainability and extensibility
7. Product governance and delivery readiness

---

# Workstream 1. Privacy and User Trust

## Objective
Make users comfortable enough to upload sensitive career documents and interview responses.

## Current Risk Pattern
The system already handles sensitive personal information such as:
- CVs
- job descriptions
- transcript data
- report feedback
- login identity data
- possibly voice-related data

That means privacy cannot be treated as UI decoration. It must be designed as a product capability.

## Main Risks

### 1. Privacy wording is ahead of implementation
If the UI claims encryption, deletion guarantees, biometric-grade protection, or compliance readiness without the backend fully enforcing those controls, trust damage will happen faster than feature growth.

### 2. Data lifecycle is not yet explicit enough
The product should clearly define:
- what data is collected
- why it is collected
- where it is stored
- who can access it
- how long it is retained
- how it is deleted
- how a user can request deletion or export

### 3. Voice and biometric claims need care
If the product uses voice data only for speech-to-text and coaching, that is one privacy scenario. If it uses voice for identity, verification, classification, or biometric processing, the New Zealand Biometric Processing Privacy Code 2025 may become relevant. The Code was issued on 21 July 2025, came into force on 3 November 2025, and agencies already using biometrics have a transition period ending on 3 August 2026. [Source](https://www.privacy.org.nz/privacy-principles/codes-of-practice/biometric-processing-privacy-code/) [Source](https://www.privacy.org.nz/focus-areas/biometrics/)

## Product Requirements

### Must have
- Clear privacy notice written in plain language
- Accurate wording about what is encrypted and what is not
- Defined data retention policy
- Defined deletion process
- Internal access boundary by user ownership
- Breach response process

### Should have
- Download my data
- Delete my account and files
- Separate raw data from redacted display data
- Audit trail for sensitive operations

## Implementation Plan

### Phase 1
- Rewrite privacy wording to match current implementation exactly
- Define the product data lifecycle in one document
- Mark all stored sensitive fields by category: identity, document, transcript, report, analytics
- Stop claiming protections that are not fully implemented

### Phase 2
- Add account-level delete workflow
- Add file retention worker or scheduled cleanup
- Add export-my-data workflow
- Add audit logging for upload, analysis, report generation, export, deletion

### Phase 3
- Add encryption at rest for uploaded file storage if this is part of the product promise
- Add role-based internal admin controls if the product grows beyond solo use

## Success Measures
- A new user can understand privacy expectations in under 2 minutes
- All sensitive data paths are documented
- Deletion and export flows are testable
- No UI claim overstates real implementation

---

# Workstream 2. User Experience and Convenience

## Objective
Reduce friction in the end-to-end journey so a real user can complete the main task without getting stuck.

## Product Standard
The first-run flow should feel like this:
1. Sign in
2. Upload CV or skip for later
3. Add JD by upload or paste
4. See what the system extracted
5. Start interview with clear expectations
6. Finish interview and receive report
7. Revisit history later

## Main Risks

### 1. The system may be technically complete but cognitively heavy
Users do not care that there are controllers, agents, repositories, and chunking logic. They care whether the product explains itself well.

### 2. Too much uncertainty during AI analysis
If users do not know whether JD analysis worked, whether fallback mode was used, or whether report quality is limited by missing inputs, confidence drops.

### 3. Upload and analysis flow may feel opaque
Users need feedback like:
- upload received
- file parsed
- skills extracted
- fallback mode used
- ready for interview

## Product Requirements

### Must have
- A clean guided onboarding flow
- Clear upload status and analysis status
- Helpful empty states
- Useful error states
- Clear next-step prompts

### Should have
- Draft saving
- Resume later
- Input completeness indicator
- Report quality indicator based on data completeness

## Implementation Plan

### Phase 1
- Redesign core journey around one primary CTA per screen
- Add explicit status cards for CV upload, JD analysis, interview readiness, and report availability
- Show fallback state when AI extraction fails and heuristic mode is used

### Phase 2
- Add progress persistence for interrupted sessions
- Add clearer interview readiness checklist
- Add session recovery banner on returning login

### Phase 3
- Add adaptive onboarding for different user types: student, graduate, experienced professional
- Add role-based templates and quick-start presets

## Success Measures
- A new user can finish the first full workflow without needing external help
- Fewer abandonment points between upload and interview start
- Support questions shift from “what do I do now?” to “how can I improve more?”

---

# Workstream 3. Security and Access Control

## Objective
Protect user-owned resources and reduce the most likely real-world security failures.

## Main Risks

### 1. Object ownership checks are not strong enough
This is the most urgent system-level risk. Every endpoint that receives a `sessionId`, report ID, file ID, or export request must verify ownership.

### 2. Auth strategy is mixed
A mixed model of cookie, localStorage, and Bearer token increases state confusion and weakens trust boundaries. OWASP session guidance stresses secure storage of session identifiers and cookie hardening remains a standard browser session mechanism. [Source](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) [Source](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes)

### 3. Production secrets and environment validation are not strict enough
The product should fail fast if critical secrets are missing.

### 4. Sensitive exports are too easy to expose
Transcript export, report export, and raw analysis outputs need stronger delivery controls.

## Product Requirements

### Must have
- Ownership checks on every user-owned resource
- One auth strategy only
- Secure cookie configuration
- No production fallback secrets
- Rate limiting on auth, upload, report, and interview endpoints
- Structured security logging

### Should have
- Short-lived auth tokens if JWT is still used
- Admin and support action audit trail
- Suspicious activity detection basics

## Implementation Plan

### Phase 1
- Add `getOwnedSessionOrThrow` and equivalent ownership guards
- Convert auth to cookie-only session behavior
- Remove auth token dependence from localStorage
- Add startup env validation
- Add rate limiting

### Phase 2
- Protect exports through temporary download links or server-side streaming
- Add action audit logs for user-sensitive routes
- Add redaction rules for logs and error payloads

### Phase 3
- Add security review checklist to release process
- Add penetration-style test cases for authorization and storage

## Success Measures
- A logged-in user cannot access another user’s objects by changing IDs
- Auth state is consistent after login, refresh, logout, and expiry
- Security incidents are diagnosable from logs

---

# Workstream 4. AI Workflow Quality and Explainability

## Objective
Make the AI pipeline useful enough for real users and transparent enough that users trust the output.

## Current Product Truth
The system already has a meaningful AI architecture:
- JD analysis
- CV processing
- retrieval layer
- interview question generation support
- report generation
- report QA stage

That is a strong base. The next step is not “add AI”. It is “make AI product-grade”.

## Main Risks

### 1. RAG layering is not yet stable enough
Global knowledge and session knowledge need separate handling. If they are mixed under one filter, the system can underuse question banks or pull the wrong evidence.

### 2. Retrieval quality may not survive real language variation
The current embedding approach is efficient, but it is not as semantically robust as a dedicated embedding model.

### 3. Explainability is still limited
Users and developers should be able to answer:
- why this question was asked
- which JD requirement it maps to
- which CV gap it relates to
- which evidence supports this report claim

## Product Requirements

### Must have
- Reliable retrieval across global and session knowledge
- Fallback state visibility
- Question-to-reason traceability
- Report evidence traceability

### Should have
- Confidence labels
- Retrieval diagnostics for debugging
- Report quality indicators

## Implementation Plan

### Phase 1
- Split retrieval into global-bank retrieval and session-scoped retrieval
- Add source weighting and stage-aware weighting
- Return analysis mode and warning metadata to the frontend

### Phase 2
- Add evidence references to report sections
- Add question generation reason metadata
- Improve chunking by source type

### Phase 3
- Evaluate real embedding upgrade if retrieval quality becomes a growth bottleneck
- Add A/B testing for question usefulness and report usefulness

## Success Measures
- Interview questions feel role-relevant and non-generic
- Reports can point back to supporting evidence
- Developers can debug why a weak question or weak report happened

---

# Workstream 5. Deployment and Operational Maintainability

## Objective
Make the deployed system observable, recoverable, and affordable to operate.

## Main Risks

### 1. Demo success does not guarantee production stability
A product can work during a controlled test and still be painful after deployment because logs, alerts, health checks, and failure handling are weak.

### 2. Incident response is not yet a first-class workflow
The Office of the Privacy Commissioner recommends a tested and integrated incident response approach for privacy breach management. [Source](https://www.privacy.org.nz/responsibilities/poupou-matatapu-doing-privacy-well/breach-management/)

### 3. Operations and privacy are linked
If a privacy breach occurs, the team needs to know what happened, what data was affected, and who was impacted. That only works if observability is designed in.

## Product Requirements

### Must have
- Health checks
- Structured logs
- Error monitoring
- Request correlation IDs
- Backup and restore plan
- Deployment rollback plan
- Incident response playbook

### Should have
- Basic dashboards for API errors, upload failures, and report failures
- Cost monitoring for AI providers
- Queue or retry design for long-running analysis tasks

## Implementation Plan

### Phase 1
- Standardize logging format
- Add request IDs and session IDs in logs
- Add operational runbook for deploy, rollback, and incident triage
- Document backup and restore process

### Phase 2
- Add monitoring dashboards
- Add alerting for key failure paths
- Add retry handling for long-running AI jobs

### Phase 3
- Introduce background job architecture if workload grows
- Separate synchronous UX actions from asynchronous heavy processing

## Success Measures
- The team can diagnose failures quickly after deployment
- Releases are reversible
- Core user flows are measurable in production

---

# Workstream 6. Code Maintainability and Extensibility

## Objective
Make the codebase easy to change without creating fear.

## Main Risks

### 1. Some areas are still prototype-shaped
There is already useful structure, but several services and controllers are getting too broad.

### 2. Business logic and orchestration are too close in some paths
If orchestration logic, AI prompting, storage logic, and domain logic stay mixed, new features will become expensive.

### 3. There are not enough tests around the risky seams
The system needs stronger tests around ownership, session lifecycle, upload, JD analysis fallback, retrieval, and report generation.

## Product Requirements

### Must have
- Clear domain boundaries
- Smaller services with single responsibility
- Stable contracts between frontend and backend
- Tests around critical flows
- Release-safe refactoring standards

### Should have
- Shared error model
- Shared response envelope patterns
- Feature flags for high-risk changes

## Implementation Plan

### Phase 1
- Identify and split oversized services
- Define domain modules: auth, upload, session, analysis, retrieval, report, export
- Replace noisy console logging with a structured logger

### Phase 2
- Add service-level tests for critical flows
- Add API tests for auth, upload, interview lifecycle, and report retrieval
- Normalize response and error patterns

### Phase 3
- Add internal developer docs for major workflows
- Add feature flag support for risky rollout changes

## Success Measures
- New features can be added with localized changes
- Refactors do not frequently break unrelated features
- A new developer can understand the system faster

---

# Workstream 7. Product Governance and Delivery Readiness

## Objective
Make sure the product can be responsibly released and iterated.

## Main Risks

### 1. Documentation and real implementation can drift apart
If README, privacy claims, architecture diagrams, and actual code tell different stories, credibility drops.

### 2. Release packages may expose unnecessary risk
Source packages should not include secrets, local junk, or irrelevant build artifacts.

### 3. Business readiness is more than code completeness
The product needs rules for what is ready, what is experimental, and what is safe to promise externally.

## Product Requirements

### Must have
- Accurate README
- Accurate architecture diagram
- Accurate privacy summary
- Clean release packaging
- Clear release checklist

### Should have
- Internal version tracking
- Known limitations document
- Support escalation notes

## Implementation Plan

### Phase 1
- Rewrite README to reflect current implemented state
- Clean release package contents
- Add `.env.example` and remove secrets from deliverables
- Add release checklist

### Phase 2
- Create business-facing feature readiness labels: implemented, beta, planned
- Create known limitations document
- Add support and issue triage guide

### Phase 3
- Add internal release note process
- Add governance review for privacy and security-sensitive feature launches

## Success Measures
- Documentation matches product reality
- Release artifacts are clean and safe
- Product promises remain credible

---

# 5. Priority Roadmap

## Immediate Priority - before calling this commercially usable

1. Fix object ownership checks
2. Simplify auth to one model
3. Align privacy wording with implementation
4. Define data lifecycle and deletion policy
5. Improve export protection
6. Split global and session retrieval
7. Standardize logs and environment validation
8. Clean delivery package and documentation

## Near-Term Priority - to improve real user experience

1. Make upload and analysis states clearer
2. Add fallback transparency
3. Add report evidence references
4. Improve chunking and retrieval weighting
5. Add resume and recovery UX
6. Add operational dashboards and alerts

## Growth Priority - to support scaling and future features

1. Refactor domain boundaries further
2. Upgrade embedding stack if needed
3. Add feature flags
4. Add user data export and self-service deletion
5. Add background jobs for heavier tasks

---

# 6. Recommended Delivery Phases

## Phase A - Trust and Safety Foundation
Focus:
- privacy wording
- ownership checks
- auth simplification
- env validation
- export safety
- data lifecycle definition

Outcome:
The product becomes much safer to put in front of real users.

## Phase B - Product Experience Upgrade
Focus:
- smoother onboarding
- upload and analysis status clarity
- fallback transparency
- session recovery
- report evidence visibility

Outcome:
The product feels clearer, more guided, and less fragile.

## Phase C - Operational and Engineering Hardening
Focus:
- structured logging
- monitoring
- release checklist
- test coverage
- service refactor

Outcome:
The product becomes easier to deploy, maintain, and evolve.

## Phase D - Scale and Expansion Readiness
Focus:
- better embeddings if needed
- background jobs
- enterprise-style controls
- feature flags
- self-service privacy tools

Outcome:
The product is ready for broader usage and faster iteration.

---

# 7. Commercial Go/No-Go Criteria

The product should not be treated as commercially ready until the following are true:

### Trust
- Privacy wording is accurate
- Sensitive data lifecycle is documented
- Deletion path exists

### Security
- Ownership checks are complete
- Auth flow is unified
- No unsafe production fallback secret exists

### Usability
- A new user can complete the core journey without external explanation
- The system communicates analysis state clearly

### Operations
- Deploy, rollback, and incident response are documented
- Logs are structured enough to support debugging

### Maintainability
- Critical flows have automated tests
- Core domain boundaries are clear enough for safe change

---

# 8. Final Position

From a business product perspective, the system already has strong value and a good structural base. It is beyond the “class demo only” stage.

However, to be genuinely usable by real users after deployment, the next work should not focus mainly on adding more AI features.
The next work should focus on:
- trust
- privacy accuracy
- ownership safety
- operational maturity
- maintainable architecture

In short:

**The product is promising, but commercial readiness now depends more on product discipline than on model capability.**

That is good news.
Model upgrades can come later. Trust and maintainability need to come first.

---

# 9. Reference Sources

- New Zealand Privacy Act 2020 overview: https://www.privacy.org.nz/privacy-principles/
- New Zealand Privacy Principle 5: https://www.privacy.org.nz/privacy-principles/5/
- Privacy breach guidance: https://www.privacy.org.nz/responsibilities/privacy-breaches/
- Breach management guidance: https://www.privacy.org.nz/responsibilities/poupou-matatapu-doing-privacy-well/breach-management/
- Biometric Processing Privacy Code 2025: https://www.privacy.org.nz/privacy-principles/codes-of-practice/biometric-processing-privacy-code/
- Biometrics overview and transition timing: https://www.privacy.org.nz/focus-areas/biometrics/
- OWASP API1 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Testing for Cookie Attributes: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes
