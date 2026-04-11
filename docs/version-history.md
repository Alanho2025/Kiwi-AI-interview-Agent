# Kiwi AI Interview Agent - Version History

This file tracks structural and behaviour changes for engineers.
It is not a release marketing note.
It explains why a version exists, what changed, which modules were touched, and what still remains open.

## v1.9.1 - Match reliability hardening for inferred requirements, duplicate JD requirements, and summary quality

### Why this version exists
The previous match upgrade improved CV evidence modelling, but real testing exposed three trust problems:
- duplicated requirements could appear in the requirement list
- composite requirements could be scored too optimistically as one big sentence
- `gaps`, `risks`, and summary text were still too lenient when evidence was only inferred or project-based

This version hardens the decision layer so the UI reads more like a real recruiter review and less like an over-friendly keyword matcher.

### Main changes
- Hardened requirement scoring in `backend/src/services/match/matchScoringService.js`
- Added composite requirement splitting so requirements such as:
  - `4+ years of professional experience with C#, .NET MVC, SQL, and JavaScript`
  are no longer treated as one flat string only
- Added child requirement coverage logic:
  - split sub-items
  - score each sub-item
  - derive final requirement status from coverage instead of one loose lexical match
- Reduced over-optimistic handling of inferred evidence:
  - `inferred` is no longer treated like “no obvious gap”
  - core stack and commercial-experience requirements now remain visible as risks when proof is limited
- Added evidence-quality notes for requirement cards, including cases such as:
  - `direct evidence found`
  - `partial direct evidence`
  - `project-based evidence only`
  - `transferable evidence only`
  - `limited direct proof`
  - `missing direct commercial proof`
- Tightened explanation generation so `strengths`, `gaps`, and `risks` now reflect:
  - requirement status
  - requirement importance
  - evidence quality notes
  - hard requirement failure patterns
- Improved risk generation for inferred-but-core requirements such as:
  - C#
  - .NET
  - MVC
  - professional / commercial experience requirements
- Corrected legacy weighted breakdown behaviour so technical requirement counts no longer mirror soft-skill counts incorrectly
- Added a dedicated regression test for composite requirement handling:
  - `backend/tests/matchCompositeRequirement.test.js`

### Touched modules
- `backend/src/services/match/matchScoringService.js`
- `backend/src/services/match/matchResultBuilder.js`
- `backend/tests/matchCompositeRequirement.test.js`

### Open limits after this version
- JD requirement dedupe should still be pushed earlier into rubric construction, not only handled downstream by scoring behaviour
- Requirement cards would benefit from a clearer frontend display for note categories instead of a single flat notes string
- True span-level evidence is still not implemented; evidence remains summary-level rather than exact citation-level

## v1.9.0 - Section-aware CV evidence model and transition-aware JD-CV matching

### Why this version exists
The earlier match pipeline over-relied on CV `experience` text and plain token overlap.
That design under-read transition candidates, project-based software evidence, quantified outcomes, and transferable engineering skills.

This version rebuilds the CV side of the match system so the engine can evaluate:
- personal statement
- key competencies
- work experience
- projects
- education
- volunteer evidence
- hard skills
- functional capabilities
- quantified achievements

### Main changes
- Replaced the old CV-match input pattern that mainly preferred `cvProfile.experience`
- Added a new CV evidence profile model:
  - `backend/src/services/cv/cvEvidenceProfileBuilder.js`
- Added project normalization:
  - `backend/src/services/cv/cvProjectNormalizer.js`
  - projects are now split into title, tech stack, responsibilities, and outcomes
- Added quantified achievement extraction:
  - `backend/src/services/cv/cvAchievementExtractor.js`
- Added capability extraction for transferable and behavioural signals:
  - `backend/src/services/cv/cvCapabilityExtractor.js`
- Added capability taxonomy for reusable role-signal mapping:
  - `backend/src/services/match/capabilityTaxonomy.js`
- Added section-aware matching:
  - `backend/src/services/match/sectionAwareMatchService.js`
- Added capability-aware matching:
  - `backend/src/services/match/capabilityMatchService.js`
- Added achievement-based match boosting:
  - `backend/src/services/match/achievementBoostService.js`
- Added transition-aware scoring profile:
  - `backend/src/services/match/transitionAwareScoring.js`
- Reworked `backend/src/services/matchService.js` so the match pipeline now builds and uses:
  - `cvEvidenceProfile`
  - `transitionProfile`
- Extended analyze result building so match outputs now include:
  - `cvEvidenceProfile`
  - section breakdown counts
  - capability match notes
  - achievement signals
  - transition profile
  - additional score dimensions:
    - technical readiness
    - transferable strength
    - commercial experience
    - growth potential
- Updated question-plan generation so interview focus can probe:
  - project-backed claims
  - transferable strengths that still need direct proof
  - transition-readiness themes
- Added smoke / regression coverage:
  - `backend/tests/cvEvidenceProfileBuilder.test.js`
  - `backend/tests/matchService.regression.test.js`

### Touched modules
- `backend/src/services/cv/cvEvidenceProfileBuilder.js`
- `backend/src/services/cv/cvProjectNormalizer.js`
- `backend/src/services/cv/cvAchievementExtractor.js`
- `backend/src/services/cv/cvCapabilityExtractor.js`
- `backend/src/services/match/capabilityTaxonomy.js`
- `backend/src/services/match/sectionAwareMatchService.js`
- `backend/src/services/match/capabilityMatchService.js`
- `backend/src/services/match/achievementBoostService.js`
- `backend/src/services/match/transitionAwareScoring.js`
- `backend/src/services/matchService.js`
- `backend/src/services/match/matchResultBuilder.js`
- `backend/src/services/match/questionPlanService.js`
- `backend/src/services/match/matchScoringService.js`

### Open limits after this version
- Match still does not use semantic embeddings or citation-grade evidence spans
- JD-side capability normalization can still be expanded further
- Frontend summaries needed one more hardening pass, which is delivered in v1.9.1

## v1.8.1 - JD file upload support and CV / JD lifecycle wording alignment

### Why this version exists
The earlier CV flow supported file upload, but JD input still depended mainly on pasted text.
That mismatch created friction and made the JD side feel less product-ready.
At the same time, CV / JD privacy wording had started to overstate what the current implementation actually does.

### Main changes
- Added JD file upload support for:
  - PDF
  - DOCX
  - TXT
- Added backend JD upload pipeline so uploaded JD files can produce:
  - raw JD text
  - structured JD summary
  - structured JD rubric
  - JD file metadata
- Extended the analyze flow so JD input can come from:
  - uploaded file
  - pasted text
- Updated frontend JD action flow and labels so pasted-text analysis and uploaded-file analysis are clearly separated
- Added clearer JD analysis status handling and fallback display cues
- Updated CV / JD helper text and privacy wording so the UI now states current behaviour more accurately
- Added / updated lifecycle documentation for both domains:
  - `docs/cv-data-lifecycle.md`
  - `docs/jd-data-lifecycle.md`

### Open limits after this version
- JD URL import is still not implemented in this code line
- Automatic retention cleanup is still not active
- Privacy wording is more accurate now, but deletion/export UX is still incomplete in the frontend

## v1.8.0 - JD parser rebuild and cross-role skill taxonomy

### Why this version exists
This batch rebuilds the JD parsing flow so it can handle real-world headings, preserve requirement sentences, and stay reusable across software, data, AI, and IT job descriptions.

### Main changes
- Replaced the old JD parsing flow with a staged pipeline:
  - text normalization
  - heading detection
  - section collection
  - requirement classification
  - grouped skill extraction
  - role family detection
  - interview target derivation
  - diagnostics generation
- Added new JD parser modules:
  - `jobDescriptionTextNormalizer.js`
  - `jobDescriptionHeadingDetector.js`
  - `jobDescriptionSectionCollector.js`
  - `jobDescriptionRequirementClassifier.js`
  - `jobDescriptionRoleFamilyDetector.js`
  - `jobDescriptionSkillExtractor.js`
  - `jobDescriptionInterviewTargetBuilder.js`
  - `jobDescriptionAnalysisDiagnostics.js`
  - `jobDescriptionSchemaValidator.js`
- Added heading and skill lexicons for cross-role parsing:
  - software development
  - data
  - AI / ML
  - IT / infrastructure
  - common engineering
- Preserved downstream compatibility by keeping the existing rubric fields while adding richer `sections`, `jobOverview`, and `diagnostics` data
- Reworked the JD summary formatter so it outputs structured sections instead of a flat fallback summary
- Reworked the frontend JD card to show:
  - overview
  - responsibilities
  - core requirements
  - bonus requirements
  - grouped technical skills
  - soft skills
  - benefits
  - application notes
  - parser warnings and confidence
- Added a frontend JD view-model adapter to keep display logic out of the JSX tree

### Open limits after this version
- AI enhancement still remains optional and may fall back to heuristic-only mode when DeepSeek is unavailable
- Company and location extraction are still heuristic and should be expanded further if higher precision is needed
- Cross-role parser fixtures and automated JD tests should still be added as the next hardening step

## v1.3.0 - CV lifecycle, ownership guard, and export hardening

### Why this version exists
This batch closes the main remaining CV-domain gaps against the code review plan and the commercial product plan.
The focus is on lifecycle controls, ownership checks, safer upload rules, persisted match analysis, and session snapshot consistency.

### Main changes
- Added shared CV ownership helpers:
  - `backend/src/services/cv/cvOwnershipService.js`
- Added CV lifecycle service:
  - rebuild profile
  - soft delete
  - export redacted and normalized CV data
  - file: `backend/src/services/cv/cvLifecycleService.js`
- Added persisted match analysis records:
  - `backend/src/db/models/matchAnalysisRecordModel.js`
  - `backend/src/services/cv/matchAnalysisRecordService.js`
- Updated analyze flow:
  - `/analyze/match` now persists a `matchAnalysisId`
  - `/analyze/interview-plan` can create a session from an owned `matchAnalysisId`
- Updated session persistence:
  - session analysis now stores retrieval snapshots with `matchAnalysisId` and evidence refs
  - interview plan now stores a `questionPlanSnapshot`
- Updated interview plan schema to support internal trace metadata while keeping the frontend payload clean
- Added CV lifecycle endpoints:
  - rebuild profile
  - delete CV
  - export CV data
- Strengthened upload validation:
  - extension validation
  - MIME validation
- Kept question trace metadata internal and stripped it from session payloads sent to the frontend

### Open limits after this version
- No background retention worker yet
- No encrypted-at-rest file storage yet
- No self-service bulk account deletion yet
- Frontend does not yet expose dedicated UI actions for rebuild/delete/export

## v1.2.0 - CV domain separation and safe frontend flow

### Main changes
- Added CV section parsing, profile building, and display view services
- Extended `DocumentContent` to hold CV profile and display artifacts
- Changed analyze flow so the frontend sends `cvId` instead of raw CV text
- Session payloads now prefer `cvDisplay` instead of returning full CV text
- Analyze draft storage now saves safe CV metadata instead of full extracted CV text
- Added this version history concept and connected it to the clean delivery workflow

## v1.1.0 - Match analysis persistence and session trace foundation

### Main changes
- Added persisted match analysis support as an internal session input pattern
- Added question trace metadata foundation so interview planning can stay explainable internally
- Connected session creation to analysis outputs instead of treating analysis as a transient UI-only result

## v1.0.0 - CV upload domain baseline

### Main changes
- Upload flow now creates extracted CV content, profile data, and display-safe summaries
- Recent CV and selected CV responses now return safe summary data instead of raw CV text
- Frontend analyze flow no longer sends raw CV text through match and session creation

## Track 6 structural history before the CV and JD domain batches

### v1.1.0
- Split `sessionService.js` into lifecycle, transcript, question, and shared session modules

### v1.2.0
- Slimmed `interviewController.js` by moving session loading, state transitions, answer persistence, and audit logging into interview services

### v1.3.0
- Split `HomePage.jsx` into dedicated home sections and extracted session display helpers
- Split `ReportPage.jsx` into report view builders and dedicated report sections

### v1.4.0
- Split `sessionLifecycleService.js` into lifecycle orchestration, persistence helpers, and session view builders
- Split `AnalyzePage.jsx` by extracting analyze draft helpers and a dedicated action card

### v1.5.0
- Split JD parsing into AI extraction, heuristic extraction, and rubric builder modules
- Split CV/JD matching into rubric normalization, score builders, question plan builder, and analyze result builder

### v1.6.0
- Split `reportGeneratorAgent.js` into evidence analysis, metric builders, coaching builders, draft builders, and shared helpers
- Ran a hotspot scan to identify the next maintainability targets

### v1.7.0
- Added `useInterviewSession` to separate interview state orchestration from `InterviewPage.jsx`
- Split interview page layout into dedicated page sections
- Added `useReportData`
- Split report view logic into the report-view domain folder and kept the old entrypoint as a compatibility barrel export
