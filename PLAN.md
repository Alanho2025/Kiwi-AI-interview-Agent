You are working on the Kiwi-AI-interview-Agent project.

Read and follow this Notion implementation plan exactly:
https://www.notion.so/Root-Question-vs-Follow-up-Question-Implementation-Plan-3706c0b712f880a991a7db90dd81591d?source=copy_link

Main goal:
Implement controlled scenario-based interview turn orchestration for the question mechanism.

Product intent:
The system should behave like a real interviewer who has read the candidate's CV, understands the JD, listens to the candidate's introduction, and then decides whether to ask a new root question or a deep follow-up.

Core architecture rule:
Code controls the lane. LLM drives inside the lane. Guards stop invalid output.

Do not reduce the LLM to static templates.
Do not let the LLM freely control the whole interview plan.
The correct balance is:
- Code decides broad scenario, root/follow-up source policy, evidence boundary, hard constraints, mode guard, fallback policy, metadata, and whether a prepared pool item can be consumed.
- LLM performs bounded interview micro-planning inside that selected lane and generates the final spoken question.

Critical latency rule:
Live voice turn must use at most one blocking LLM call after end-of-speech.
Do not add separate blocking LLM calls for answer understanding, scenario planning, question wording, and validation in the same live turn.
Heavy work such as CV seed generation, JD parse, match filter, and root pool composition must happen before the interview starts, not inside the live voice turn.

Critical product rules:
1. CV upload and CV review should generate or refresh CV seed questions.
2. JD parse/review should expose role priorities and requirements.
3. CV-JD match should build JD filter decisions and gap/validation targets.
4. Interview plan generation should compose the prepared root question pool.
5. Root questions open a new topic and may consume prepared root pool items.
6. Follow-ups deepen the current answer or introduction and must not consume prepared root pool items.
7. Candidate introduction is the first live evidence signal. If the intro mentions a CV project but is shallow, prefer a follow-up before jumping to an unrelated root question.
8. After enough follow-up depth or topic coverage, return to a new root question from the prepared root pool.
9. Match-gap questions must be available and selectable as root questions.
10. Mode guards must remain. Behavioural-only mode must not ask technical implementation questions. Technical-only mode must not drift into generic personality questions.
11. Templates are fallback rails only, not the normal intelligence path.

Do not remove or weaken existing behaviour:
- CV upload and CV parse
- CV review and seed refresh
- CV question seed generation
- JD question filtering
- CV-JD match analysis
- Match analysis persistence
- Interview session creation
- Prepared DB-backed question pool composition
- Legacy fallback question pool
- Adaptive follow-up behaviour
- Voice fast path
- TTS streaming
- Mode guards
- Transcript persistence
- Interview question persistence
- Report generation
- Report QA

Implementation approach:
Do not do a big-bang rewrite.
Implement in phases and run tests after each phase.

Phase 0: Inspect and map current code
Before changing files:
1. Inspect current question, interview, voice, match, CV seed, JD filter, report, and test files.
2. Produce an implementation checklist mapping each planned change to existing files.
3. Identify current voice live path and count current blocking LLM calls.
4. Identify current test scripts and missing scripts.
5. Do not change code until the checklist is clear.

Phase 1: Diagnostics and test scripts
Add diagnostics and test infrastructure first.
Add or confirm a test-only diagnostics endpoint or dev-only debug panel that exposes:
- cvSeedsCount
- cvSeedSamples
- jdPrioritySummary
- jdFilterReady
- jdFilterDecisionCounts
- preparedRootQuestionCount
- fallbackRootQuestionCount
- wrapUpQuestionCount
- matchGapQuestionCount
- askedPreparedRootCount
- latestTurnKind
- latestScenario
- latestPreparedQuestionId
- latestParentQuestionId
- latestFollowUpIntent
- poolDegraded
- poolDegradedReason

Add memory and cache visibility fields to the same diagnostics output.
These fields are diagnostic visibility only in Phase 1. Do not implement a full account-level artifact cache in this phase unless a later phase explicitly requires it.

Memory visibility fields:
- sessionMemoryLoaded
- sessionMemoryTopicHistoryCount
- sessionMemoryEvidenceGapCount
- sessionMemoryProjectUsage
- userCoachingMemoryLoaded
- userCoachingMemoryRecordCount
- userCoachingMemorySummaryAvailable
- userCoachingMemoryLatestSummary
- memoryLoadPolicyRequested
- memoryLoadPolicyEffective
- heavyMemorySkippedBeforeFirstAudio
- memorySkippedReason

Retrieval and evidence reuse visibility fields:
- retrievalExecuted
- retrievalSkipped
- retrievalSkippedReason
- retrievalObjective
- retrievalSourceTypes
- retrievalItemCount
- retrievalCorrectiveRetryUsed
- evidencePackageSource
- evidencePackageFreshness
- evidencePackageStaleReason
- compactContextUsed
- warmContextHit
- warmContextCacheAgeMs
- warmContextSkippedReason

Artifact/cache candidate visibility fields:
- artifactCacheCandidateFound
- artifactCacheHit
- artifactCacheMissReason
- artifactCacheScope
- sameCvFingerprint
- sameJdFingerprint
- sameRoleKey
- cvFingerprint
- jdFingerprint
- roleKey
- preparedArtifactsReused
- preparedArtifactsRefreshRequired
- preparedArtifactsRefreshReason
- accountLevelCacheSupported

Diagnostics constraints:
- Never enable diagnostics in production.
- Do not expose raw CV text, raw JD text, full transcript text, or private user data in diagnostics.
- Diagnostics should expose counts, IDs, fingerprints, source labels, and short summaries only.
- Phase 1 diagnostics must not change interview behaviour.
- Phase 1 diagnostics must not add extra blocking LLM calls.
- If a field is not yet supported, return null, false, or "not_implemented" rather than inventing a value.

Add package scripts if missing:
- test:questions
- test:e2e
- test:e2e:headed
- test:e2e:debug
- test:e2e:question-pipeline

Phase 2: Data model and backward compatibility
Update InterviewQuestionPoolItem with:
- questionRole: root_question | fallback_root | wrap_up
- maxFollowUps
- followUpStrategies

Prepared pool items are root question preparation artifacts only.
Do not store generated live follow-ups in InterviewQuestionPoolItem.

Backward compatibility:
Old prepared pool records may not have questionRole.
When querying root questions, treat missing/null/empty questionRole as root_question during transition.

Phase 3: Prepared root pool and JD/CV quality
Improve CV seed quality so project seeds sound like a real interviewer read the CV.
Example:
Instead of "Tell me about one project where you used React..."
Use "Your CV says you used React in Forkcast Food AI Assistant. How did you apply it in the actual implementation?"

Do not remove existing seed intents:
- validate_ownership
- validate_depth
- validate_tradeoff
- behavioural_star
- validate_result
- career_transition_story
- risk_probe

Make JD priorities visible through diagnostics or UI:
- role title
- priority technical skills
- behavioural priorities
- must-probe requirements
- question planning hints

Match should not hard-delete useful CV seeds by default.
Use boost/adapt/suppress/keep states:
- boost: highly relevant to JD
- adapt: useful but should be reframed around JD needs
- suppress: low-confidence or irrelevant
- keep: useful backup or breadth signal

Phase 4: Scenario-based turn orchestrator
Add:
backend/src/services/questions/interviewTurnOrchestratorService.js

The orchestrator should:
1. Build cheap answer signals from the latest answer.
2. Treat introduction as first live evidence signal.
3. Decide broad lane/scenario by code.
4. Prepare root candidate space or follow-up candidate space.
5. Build a bounded LLM planning frame.
6. Return a turn plan to interviewerAgent.

Do not select a prepared pool item before scenario selection.

Scenarios should include:
Root scenarios:
- root_cv_evidence
- root_jd_requirement
- root_match_gap
- root_behavioural
- root_motivation
- root_wrap_up
- root_fallback

Follow-up scenarios:
- intro_follow_up
- follow_up_ownership
- follow_up_technical_depth
- follow_up_tradeoff
- follow_up_validation
- follow_up_result
- follow_up_failure
- follow_up_constraint
- follow_up_reflection
- follow_up_behavioural_action

Repair/transition scenarios:
- rephrase
- scaffold
- clarify_audio_or_transcript
- switch_topic
- shift_section
- wrap_up

Phase 5: Root question selection
Root questions open a new topic and should come from prepared DB-backed root pool when available.

Root selection must use questionPoolRankerService.
Do not keep a separate simplified sort inside interviewerAgent as the main selector.

Ranking factors should include:
- JD priority fit
- CV evidence strength
- introduction mention boost
- match gap urgency
- coverage need
- mode fit
- not asked before
- remaining time/question budget fit
- project overuse penalty
- confidence

When latency allows, pass top 3 candidate root targets to the LLM, not only one fixed final sentence.
Limit topRootCandidates to 3 to avoid prompt bloat.

Root question output must include:
- turnKind: root_question
- scenario
- selectedPreparedQuestionId if from DB pool
- source policy
- evidence package
- rankTrace
- metadata needed for asked-state marking

Phase 6: Follow-up generation
Follow-ups deepen current topic and must not consume prepared root pool items.

Inputs:
- parent question
- parent preparedQuestionId if parent came from DB pool
- latest candidate answer
- answer signals
- missing evidence
- followUpDepth
- current mode
- parent topic
- parent source evidence

Follow-up must preserve:
- parentQuestionId
- rootQuestionId
- parentPreparedQuestionId
- followUpIntent
- followUpDepth
- rootTopic
- evidenceTarget

Follow-up must not set a new preparedQuestionId.

Allowed follow-up intents:
- ownership
- technical_depth
- validation
- tradeoff
- result
- failure
- constraint
- reflection
- behavioural_action
- clarification
- scaffold

If a follow-up action appears before any AI parent question exists, safely convert it into a root fallback or prepared root selection.

Phase 7: Bounded LLM micro-planning
LLM should receive a controlled planning frame, not the whole world.

Frame should include:
- broad scenario selected by code
- turnKind
- parent question if follow-up
- latest candidate answer
- top candidate root targets if root
- allowed follow-up intents if follow-up
- CV/JD/match evidence package
- mode
- hard constraints
- forbidden moves
- fallback draft question if available

LLM output should be structured:
{
  "selectedAngle": "...",
  "shortReason": "one short sentence",
  "finalSpokenQuestion": "one clear interview question",
  "evidenceUsed": ["..."],
  "riskFlags": []
}

riskFlags is optional and must not be the only safety mechanism.
Code validation is the source of truth.

Output constraints:
- exactly one question
- finalSpokenQuestion must be immediately usable by TTS
- do not invent CV/JD/match/transcript facts
- do not switch broad scenario
- do not ask technical implementation questions in behavioural-only mode
- do not ask generic interview-bank questions when CV/JD evidence is available
- follow-up must stay on parent topic unless code selected transition

If LLM output violates the frame:
- reject, repair, or fallback
- do not silently accept invalid output

Phase 8: Latency and fallback
Live voice path must use at most one blocking LLM call after end-of-speech.

Preferred live flow:
1. Build cheap deterministic answer signals.
2. Rank prepared root candidates and build follow-up context in parallel.
3. Code selects broad lane.
4. One bounded LLM call produces micro-plan plus final question.
5. Code validates output.
6. TTS starts from first safe sentence.

Add telemetry:
- answerSignalBuildMs
- rootCandidateRankMs
- followUpContextBuildMs
- orchestratorDecisionMs
- llmFirstTokenMs
- llmCompleteMs
- ttsFirstAudioMs
- totalEndOfSpeechToFirstAudioMs

Fallback rules:
- If LLM times out for root question, use highest-ranked prepared root candidate.
- If LLM times out for follow-up, use deterministic depth-probe template based on parent topic and missing evidence.
- If repair path fails, ask for clarification or one concrete example.
- Fallback must preserve metadata and not consume prepared root items incorrectly.

Phase 9: Persistence and metadata
Persist:
- turnKind
- scenario
- selectionSource
- preparedQuestionId
- parentQuestionId
- parentPreparedQuestionId
- rootQuestionId
- rootTopic
- followUpIntent
- followUpDepth
- evidenceTarget
- rankTrace
- poolDegraded
- poolDegradedReason
- selectedAngle
- shortReason
- evidenceUsed
- latency fields

Prepared root item asked-state should update only when:
turnKind === "root_question" AND preparedQuestionId exists.

Follow-ups must never mark prepared root pool items as asked.

Phase 10: Tests
Add/expand Vitest tests under backend/tests/robustness/questions/.

Required tests:
- answerUnderstandingService.test.js
- interviewTurnOrchestratorService.test.js
- questionTurnClassifier.test.js if still used
- followUpQuestionService.test.js
- questionPoolComposerService.test.js
- questionPoolRankerService.test.js
- getPreparedQuestionPool.test.js
- rootFollowUpRuntimeFlow.test.js
- questionMetadataPersistence.test.js
- update questionPipelineE2eFlow.test.js

Required Vitest checks:
1. CV upload/review creates or refreshes seed questions.
2. JD priorities are exposed.
3. Match creates JD filter decisions.
4. Interview plan creates prepared root pool.
5. Root action selects prepared root item.
6. Introduction with shallow project answer triggers follow-up.
7. Follow-up preserves parent topic.
8. Follow-up does not consume prepared root item.
9. After enough follow-up depth, next turn returns to prepared root selection.
10. Match-gap question exists and can be selected.
11. Prepared root item is marked asked only for root turns.
12. Voice response shape is preserved.
13. Report and report QA still work with new metadata.
14. Normal path keeps bounded LLM micro-planning and is not template-only.
15. Live voice path does not make multiple blocking LLM calls for one turn.
16. Telemetry records end-of-speech to first-audio fields.
17. Diagnostics expose memory/cache visibility fields without changing runtime behaviour.

Phase 11: Playwright E2E
Add browser-level Playwright tests because service tests are not enough.

Required file:
e2e/specs/question-pipeline.spec.js

Required browser scenarios:
1. CV upload creates seed questions.
2. CV seeds include project-specific, technical, and behavioural seeds.
3. JD input produces role priorities.
4. JD priorities include technical and behavioural requirements.
5. CV-JD match shows strengths and gaps.
6. Match creates filter decisions for seed questions.
7. Interview plan creates prepared root pool.
8. Prepared root pool includes CV-based, JD requirement, and gap/validation root questions.
9. First meaningful interview question is a root question from the prepared pool when available.
10. Candidate introduction triggers a follow-up when the answer is shallow.
11. Follow-up stays on the parent topic and does not consume a new prepared item.
12. After enough follow-up depth, the next new question comes from the prepared root pool.
13. Match-gap question is available and can be asked.

Use stable data-testid selectors or diagnostics. Do not rely only on visible text.

Final validation gate:
Run:
npm run lint
npm run test:questions
npm run test:all
npm run test:e2e:question-pipeline

If voice path is touched, also run:
npm run test:voice
npm run eval:voice-quality

If report or transcript metadata is touched, also run:
npm run test:report
npm run eval:report

Final response format:
After implementation, report:
1. files changed
2. phases completed
3. behaviour changed
4. tests added
5. scripts run and results
6. live voice LLM-call count after end-of-speech
7. latency risk
8. evidence that LLM bounded autonomy is preserved
9. evidence that templates are fallback only
10. remaining risks or skipped items
11. memory/cache diagnostics added and whether they are visibility-only or behaviour-changing

Do not claim success unless tests pass.
If any test cannot be run, explain exactly why.