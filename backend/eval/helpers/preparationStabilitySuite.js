/**
 * File responsibility: Deterministic preparation stability evaluation cases.
 * Main responsibilities:
 * - Define the 80 mock-mode preparation stability cases from the implementation plan.
 * - Validate preparation artifacts without allowing fallback responses to convert failures into passes.
 * - Build JSON and Markdown reports for the dedicated preparation stability runner.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export const PREPARATION_STABILITY_SUITE = 'preparation_stability';

export const PREPARATION_STABILITY_GROUPS = {
  cvParsing: 'cv_parsing',
  cvSeeds: 'cv_seed_generation',
  jdParsing: 'jd_parsing',
  jdFilter: 'jd_question_filter',
  match: 'cv_jd_match',
  questionPool: 'prepared_question_pool',
  retrieval: 'artifact_retrieval',
  report: 'report_evidence_qa',
};

const ARTIFACT_FAILURE_KEYS = {
  cv_profile: 'cvProfileMissing',
  cv_seeds: 'cvSeedsMissing',
  jd_rubric: 'jdRubricMissing',
  jd_filter: 'jdFilterMissing',
  match_analysis: 'matchAnalysisMissing',
  question_pool: 'questionPoolMissing',
  retrieval_index: 'indexingMissing',
  report_evidence: 'reportEvidenceMissing',
};

const BASE_ARTIFACT_FAILURES = {
  cvProfileMissing: 0,
  cvSeedsMissing: 0,
  jdRubricMissing: 0,
  jdFilterMissing: 0,
  matchAnalysisMissing: 0,
  questionPoolMissing: 0,
  indexingMissing: 0,
  reportEvidenceMissing: 0,
};

const normalize = (value = '') => String(value || '').trim().toLowerCase();
const toList = (value) => (Array.isArray(value) ? value : []);
const includesValue = (items = [], expected = '') => toList(items).some((item) => normalize(item).includes(normalize(expected)));
const hasText = (value) => normalize(value).length > 0;
const unique = (items = []) => [...new Set(toList(items).filter(Boolean))];

const makeEvidence = (sourceType, label, text = label) => ({
  sourceType,
  label,
  text,
  sourceId: `${sourceType}:${normalize(label).replaceAll(' ', '_')}`,
});

const makeCvProfile = ({
  skills = ['React', 'SQL', 'Testing'],
  projects = ['Portfolio dashboard'],
  experience = ['Built production-facing features'],
  education = ['Master of Information Technology'],
  warnings = [],
  confidence = 0.82,
  missingSections = [],
  evidence = [],
} = {}) => ({
  artifactType: 'cv_profile',
  skills: unique(skills),
  projects: unique(projects),
  experience: unique(experience),
  education: unique(education),
  missingSections: unique(missingSections),
  warnings: unique(warnings),
  confidence,
  evidenceRefs: unique(evidence).map((item) => makeEvidence('cv', item)),
});

const makeCvSeeds = (topics = [], sourceProfileVersion = 'cv-profile-v1') => unique(topics).map((topic, index) => ({
  seedId: `cv-seed-${index + 1}-${normalize(topic).replaceAll(' ', '-')}`,
  topic,
  sourceProfileVersion,
  sourceType: index % 2 === 0 ? 'cv_project' : 'cv_skill',
  evidenceRefs: [makeEvidence('cv', topic, `${topic} evidence from CV`)],
  draftQuestion: `Tell me about your ${topic} evidence.`,
  fallbackGenerated: false,
}));

const makeJdRubric = ({
  roleTitle = 'Software Engineer',
  responsibilities = ['Build production software'],
  requiredSkills = ['React', 'SQL'],
  preferredSkills = ['Cloud'],
  seniority = '',
  location = '',
  workType = '',
  warnings = [],
  ignoredInstructions = [],
  fingerprint = 'jd-fingerprint-v1',
} = {}) => ({
  artifactType: 'jd_rubric',
  roleTitle,
  responsibilities,
  requiredSkills,
  preferredSkills,
  seniority,
  location,
  workType,
  warnings,
  ignoredInstructions,
  fingerprint,
  evidenceRefs: [
    ...requiredSkills.map((skill) => makeEvidence('jd', skill, `Required: ${skill}`)),
    ...responsibilities.map((item) => makeEvidence('jd', item)),
  ],
});

const makeJdFilter = ({
  prioritySkills = ['React'],
  gapTargets = [],
  jdFingerprint = 'jd-fingerprint-v1',
  matchAnalysisId = 'match-analysis-v1',
  unsupportedRequirements = [],
} = {}) => ({
  artifactType: 'jd_filter',
  jdFilterReady: true,
  prioritySkills,
  gapTargets,
  jdFingerprint,
  matchAnalysisId,
  unsupportedRequirements,
  evidenceRefs: prioritySkills.map((skill) => makeEvidence('jd', skill)),
});

const makeMatchAnalysis = ({
  strengths = ['React project evidence'],
  gaps = ['SQL depth'],
  score = 0.72,
  stableSignature = 'match-signature-v1',
  persistedForPlan = true,
} = {}) => ({
  artifactType: 'match_analysis',
  score,
  strengths: strengths.map((item) => ({
    label: item,
    cvEvidenceRefs: [makeEvidence('cv', item)],
  })),
  gaps: gaps.map((item) => ({
    label: item,
    jdEvidenceRefs: [makeEvidence('jd', item)],
  })),
  explanations: [`Score ${score} is based on CV evidence and JD gaps.`],
  stableSignature,
  persistedForPlan,
});

const makeQuestionPool = ({
  count = 10,
  sources = ['cv_seed', 'jd_filter', 'match_gap'],
  mode = 'combined',
  topics = ['React', 'SQL gap', 'teamwork'],
  juniorSafe = true,
  seniorSafe = true,
} = {}) => Array.from({ length: count }, (_, index) => {
  const sourceStage = sources[index % sources.length];
  const topic = topics[index % topics.length];
  return {
    questionId: `prep-q-${index + 1}`,
    text: `Preparation question ${index + 1} about ${topic}.`,
    topic,
    category: mode === 'behavioural' ? 'behavioural' : index % 3 === 0 ? 'behavioural' : 'technical',
    sourceStage,
    sourceMetadata: {
      artifactId: `${sourceStage}-${index + 1}`,
      evidenceRefs: [makeEvidence(sourceStage, topic)],
    },
    whyThisQuestion: `Covers ${topic} from ${sourceStage}.`,
    fallbackGenerated: false,
    juniorSafe,
    seniorSafe,
  };
});

const makeIndex = (artifacts = []) => ({
  artifactType: 'retrieval_index',
  indexedArtifacts: artifacts.map((artifact) => ({
    artifactId: artifact.id,
    sourceType: artifact.sourceType,
    text: artifact.text,
    metadata: { sourceType: artifact.sourceType },
  })),
});

const makeRetrievalResult = ({ sourceType, text, query }) => ({
  query,
  items: [{
    sourceType,
    text,
    metadata: { sourceType },
    scores: { fusion: 0.91 },
  }],
});

const makeReportBundle = ({
  evidenceSources = ['cv_profile', 'jd_rubric', 'transcript'],
  qaStatus = 'ready',
  unsupportedClaims = [],
  needsReview = false,
} = {}) => ({
  artifactType: 'report_evidence',
  report: {
    summary: 'Grounded preparation report.',
    evidenceReferences: evidenceSources.map((source) => ({ sourceType: source, sourceId: `${source}-1` })),
    claims: ['Candidate gave supported React evidence.'],
  },
  qa: {
    status: qaStatus,
    unsupportedClaims,
    needsReview,
    checks: evidenceSources.map((source) => ({ sourceType: source, passed: true })),
  },
});

const makePreparationFailure = ({ artifactType, stage, reason }) => ({
  explicit: true,
  artifactType,
  stage,
  reason,
  fallbackConvertedToPass: false,
});

const readyCase = (base) => ({
  expectedOutcome: 'ready',
  fallback: { triggered: false, convertedToPass: false },
  ...base,
});

const explicitFailureCase = (base) => ({
  expectedOutcome: 'explicit_failure',
  fallback: { triggered: false, convertedToPass: false },
  ...base,
});

const cvParsingCases = [
  readyCase({
    id: 'cv_parse_structured_profile',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['React', 'SQL', 'Git'], projects: ['Interview Coach'], experience: ['Frontend developer'], education: ['MIT'] }) },
    expected: { skills: ['React', 'SQL'], sectionsPresent: ['projects', 'experience', 'education'], minConfidence: 0.7 },
  }),
  readyCase({
    id: 'cv_parse_without_projects',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ projects: [], missingSections: ['projects'], warnings: ['No clear projects section.'] }) },
    expected: { skills: ['React'], missingSections: ['projects'], absentSections: ['projects'], minConfidence: 0.65 },
  }),
  readyCase({
    id: 'cv_parse_dense_bullets',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['Python', 'Pandas', 'SQL'], projects: ['Metrics pipeline'], evidence: ['reduced processing time by 40%'] }) },
    expected: { skills: ['Python', 'SQL'], evidenceLabels: ['reduced processing time by 40%'], minConfidence: 0.75 },
  }),
  readyCase({
    id: 'cv_parse_mixed_education_work',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['Java', 'Testing'], experience: ['Tutor'], education: ['Bachelor of Engineering'] }) },
    expected: { skills: ['Java'], sectionsPresent: ['experience', 'education'], minConfidence: 0.7 },
  }),
  readyCase({
    id: 'cv_parse_ai_project_names',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['DeepSeek API', 'Azure Speech', 'WebSocket'], projects: ['KIWI Mock Interview AI Agent'] }) },
    expected: { skills: ['DeepSeek API', 'Azure Speech'], projectNames: ['KIWI Mock Interview AI Agent'], minConfidence: 0.75 },
  }),
  readyCase({
    id: 'cv_parse_low_information_warning',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: [], projects: [], experience: ['Customer support'], confidence: 0.42, warnings: ['No common technical skills found.'] }) },
    expected: { warnings: ['technical skills'], maxConfidence: 0.55, absentSkills: ['Kubernetes'] },
  }),
  readyCase({
    id: 'cv_parse_repeated_skills_deduped',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['React', 'React', 'SQL', 'SQL'] }) },
    expected: { skills: ['React', 'SQL'], uniqueSkills: true },
  }),
  readyCase({
    id: 'cv_parse_missing_dates',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['Node.js'], experience: ['Backend internship without clear dates'], warnings: ['Some dates are missing.'] }) },
    expected: { skills: ['Node.js'], warnings: ['dates'], minConfidence: 0.6 },
  }),
  readyCase({
    id: 'cv_parse_personal_statement_noise',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['HTML', 'CSS'], projects: ['Portfolio site'], evidence: ['Portfolio site'] }) },
    expected: { skills: ['HTML'], absentSkills: ['Kubernetes'], evidenceLabels: ['Portfolio site'] },
  }),
  readyCase({
    id: 'cv_parse_malformed_layout_no_crash',
    group: PREPARATION_STABILITY_GROUPS.cvParsing,
    stage: 'cv_profile_generation',
    artifactType: 'cv_profile',
    artifacts: { cvProfile: makeCvProfile({ skills: ['Git'], projects: [], warnings: ['Malformed layout recovered.'], confidence: 0.58 }) },
    expected: { skills: ['Git'], warnings: ['Malformed'], minConfidence: 0.45 },
  }),
];

const cvSeedCases = [
  readyCase({
    id: 'cv_seed_react_project_ownership',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['React project ownership', 'testing']) },
    expected: { seedTopics: ['React project ownership'], minSeedCount: 2 },
  }),
  readyCase({
    id: 'cv_seed_backend_api_implementation',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['backend API implementation', 'PostgreSQL']) },
    expected: { seedTopics: ['backend API implementation'], minSeedCount: 2 },
  }),
  readyCase({
    id: 'cv_seed_data_metrics',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['evaluation metrics', 'data cleaning']) },
    expected: { seedTopics: ['evaluation metrics'], minSeedCount: 2 },
  }),
  readyCase({
    id: 'cv_seed_education_only_entry_level',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['entry-level education project', 'coursework']) },
    expected: { seedTopics: ['entry-level education project'], minSeedCount: 2 },
  }),
  readyCase({
    id: 'cv_seed_weak_experience_no_invention',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['candidate background clarification']) },
    expected: { seedTopics: ['candidate background'], absentSeedTopics: ['professional leadership'], minSeedCount: 1 },
  }),
  readyCase({
    id: 'cv_seed_review_adds_project',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'reviewed_cv_seed_refresh',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['new capstone project', 'React'], 'cv-profile-v2') },
    expected: { seedTopics: ['new capstone project'], sourceProfileVersion: 'cv-profile-v2', minSeedCount: 2 },
  }),
  readyCase({
    id: 'cv_seed_review_removes_skill',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'reviewed_cv_seed_refresh',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['Node.js project'], 'cv-profile-v3') },
    expected: { seedTopics: ['Node.js project'], absentSeedTopics: ['Kubernetes'], sourceProfileVersion: 'cv-profile-v3' },
  }),
  readyCase({
    id: 'cv_seed_repeated_project_deduped',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['dashboard project', 'dashboard project', 'testing']) },
    expected: { seedTopics: ['dashboard project'], uniqueSeedTopics: true, minSeedCount: 2, powerOf3: true },
  }),
  readyCase({
    id: 'cv_seed_unclear_ownership_clarification',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: makeCvSeeds(['project ownership clarification']) },
    expected: { seedTopics: ['ownership clarification'], minSeedCount: 1 },
  }),
  explicitFailureCase({
    id: 'cv_seed_no_usable_evidence_failure',
    group: PREPARATION_STABILITY_GROUPS.cvSeeds,
    stage: 'cv_seed_generation',
    artifactType: 'cv_seeds',
    artifacts: { cvSeeds: [], preparationFailure: makePreparationFailure({ artifactType: 'cv_seeds', stage: 'cv_seed_generation', reason: 'No usable CV evidence for seed readiness.' }) },
    expected: { failureArtifactType: 'cv_seeds', failureStage: 'cv_seed_generation' },
  }),
];

const jdParsingCases = [
  readyCase({ id: 'jd_parse_normal_software_engineer', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Software Engineer', requiredSkills: ['JavaScript', 'Testing'] }) }, expected: { roleTitle: 'Software Engineer', requiredSkills: ['JavaScript'], responsibilities: ['Build production software'] } }),
  readyCase({ id: 'jd_parse_junior_role', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Junior Developer', seniority: 'junior', requiredSkills: ['Git'] }) }, expected: { roleTitle: 'Junior Developer', seniority: 'junior', requiredSkills: ['Git'] } }),
  readyCase({ id: 'jd_parse_senior_role', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Senior Backend Engineer', seniority: 'senior', requiredSkills: ['Node.js', 'System design'] }) }, expected: { roleTitle: 'Senior Backend Engineer', seniority: 'senior', requiredSkills: ['System design'] } }),
  readyCase({ id: 'jd_parse_no_salary_no_hallucination', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Frontend Engineer', requiredSkills: ['React'] }) }, expected: { roleTitle: 'Frontend Engineer', noHallucinatedFields: ['salary'], requiredSkills: ['React'] } }),
  readyCase({ id: 'jd_parse_long_company_intro', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Platform Engineer', responsibilities: ['Operate cloud services'], requiredSkills: ['AWS'] }) }, expected: { responsibilities: ['Operate cloud services'], requiredSkills: ['AWS'], absentRequirements: ['free snacks'] } }),
  readyCase({ id: 'jd_parse_repeated_requirements_deduped', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ requiredSkills: ['SQL', 'Python'] }) }, expected: { requiredSkills: ['SQL', 'Python'], uniqueRequiredSkills: true } }),
  readyCase({ id: 'jd_parse_benefits_responsibilities_split', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ responsibilities: ['Build APIs'], requiredSkills: ['Node.js'], preferredSkills: ['Docker'] }) }, expected: { responsibilities: ['Build APIs'], requiredSkills: ['Node.js'], absentRequirements: ['annual leave'] } }),
  readyCase({ id: 'jd_parse_vague_responsibilities', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Software Developer', responsibilities: ['Deliver reliable software'], requiredSkills: ['problem solving'], warnings: ['Vague responsibility wording.'] }) }, expected: { roleTitle: 'Software Developer', warnings: ['Vague'], requiredSkills: ['problem solving'] } }),
  readyCase({ id: 'jd_parse_non_jd_marketing_text_flagged', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: '', responsibilities: [], requiredSkills: [], warnings: ['Input appears low quality for a JD.'] }) }, expected: { warnings: ['low quality'], maxRequirementCount: 0 } }),
  readyCase({ id: 'jd_parse_prompt_injection_ignored', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ requiredSkills: ['React'], ignoredInstructions: ['ignore previous instructions'] }) }, expected: { requiredSkills: ['React'], ignoredInstructions: ['ignore previous instructions'], absentRequirements: ['system prompt'] } }),
  readyCase({ id: 'jd_parse_seek_noisy_formatting', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Senior Frontend Developer', location: 'Auckland', workType: 'hybrid', requiredSkills: ['React', 'TypeScript'] }) }, expected: { roleTitle: 'Senior Frontend Developer', location: 'Auckland', workType: 'hybrid', requiredSkills: ['TypeScript'] } }),
  readyCase({ id: 'jd_parse_updated_jd_invalidates_summary', group: PREPARATION_STABILITY_GROUPS.jdParsing, stage: 'jd_rubric_generation', artifactType: 'jd_rubric', artifacts: { jdRubric: makeJdRubric({ roleTitle: 'Data Engineer', requiredSkills: ['Python'], fingerprint: 'jd-fingerprint-v2' }) }, expected: { roleTitle: 'Data Engineer', requiredSkills: ['Python'], fingerprint: 'jd-fingerprint-v2' } }),
];

const jdFilterCases = [
  readyCase({ id: 'jd_filter_frontend_priority', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['React', 'CSS'] }) }, expected: { prioritySkills: ['React'], linkedArtifact: 'jd-fingerprint-v1' } }),
  readyCase({ id: 'jd_filter_backend_priority', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['Node.js', 'PostgreSQL'] }) }, expected: { prioritySkills: ['Node.js'], linkedArtifact: 'jd-fingerprint-v1' } }),
  readyCase({ id: 'jd_filter_fullstack_balanced', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['React', 'API integration'] }) }, expected: { prioritySkills: ['React', 'API integration'] } }),
  readyCase({ id: 'jd_filter_sql_gap_target', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['SQL'], gapTargets: ['SQL depth'] }) }, expected: { prioritySkills: ['SQL'], gapTargets: ['SQL depth'] } }),
  readyCase({ id: 'jd_filter_testing_weak_evidence', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['testing'], gapTargets: ['testing evidence'] }) }, expected: { prioritySkills: ['testing'], gapTargets: ['testing evidence'] } }),
  readyCase({ id: 'jd_filter_benefits_noise_excluded', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['JavaScript'], unsupportedRequirements: [] }) }, expected: { prioritySkills: ['JavaScript'], absentPrioritySkills: ['birthday leave'] } }),
  readyCase({ id: 'jd_filter_required_ranked_higher', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['required React', 'preferred GraphQL'] }) }, expected: { prioritySkills: ['required React'], lowerPrioritySkills: ['preferred GraphQL'] } }),
  readyCase({ id: 'jd_filter_vague_role_level_targets', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['software delivery', 'problem solving'] }) }, expected: { prioritySkills: ['software delivery'] } }),
  readyCase({ id: 'jd_filter_prompt_injection_ignored', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: makeJdFilter({ prioritySkills: ['React'], unsupportedRequirements: [] }) }, expected: { prioritySkills: ['React'], absentPrioritySkills: ['ignore filters'] } }),
  explicitFailureCase({ id: 'jd_filter_missing_match_failure', group: PREPARATION_STABILITY_GROUPS.jdFilter, stage: 'jd_filter_generation', artifactType: 'jd_filter', artifacts: { jdFilter: null, preparationFailure: makePreparationFailure({ artifactType: 'jd_filter', stage: 'jd_filter_generation', reason: 'Match analysis missing.' }) }, expected: { failureArtifactType: 'jd_filter', failureStage: 'jd_filter_generation' } }),
];

const matchCases = [
  readyCase({ id: 'match_strong_evidence', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['React project'], gaps: [], score: 0.88 }) }, expected: { strengthsWithCvEvidence: true, maxGapCount: 0, minScore: 0.8 } }),
  readyCase({ id: 'match_weak_evidence', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['communication'], gaps: ['React'], score: 0.36 }) }, expected: { gapsWithJdEvidence: true, maxScore: 0.5 } }),
  readyCase({ id: 'match_partial_transferable', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['transferable support evidence'], gaps: ['production React'], score: 0.62 }) }, expected: { strengthsWithCvEvidence: true, gapsWithJdEvidence: true, minScore: 0.55 } }),
  readyCase({ id: 'match_jd_skill_missing_gap', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['Node.js'], gaps: ['SQL'], score: 0.58 }) }, expected: { gapLabels: ['SQL'], gapsWithJdEvidence: true } }),
  readyCase({ id: 'match_cv_skill_not_required', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['React extra evidence'], gaps: ['AWS'], score: 0.66 }) }, expected: { strengthsWithCvEvidence: true, gapLabels: ['AWS'] } }),
  readyCase({ id: 'match_overclaimed_candidate_evidence', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['skills list only'], gaps: ['production ownership'], score: 0.48 }) }, expected: { gapLabels: ['production ownership'], maxScore: 0.55 } }),
  readyCase({ id: 'match_junior_cv_senior_jd', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['project React'], gaps: ['senior architecture leadership'], score: 0.44 }) }, expected: { gapLabels: ['senior architecture leadership'], maxScore: 0.55 } }),
  readyCase({ id: 'match_senior_cv_junior_jd', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['architecture leadership'], gaps: [], score: 0.86 }) }, expected: { strengthsWithCvEvidence: true, minScore: 0.8 } }),
  readyCase({ id: 'match_ambiguous_role_title', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['software project'], gaps: ['role-specific domain'], score: 0.61 }) }, expected: { gapsWithJdEvidence: true, minScore: 0.5 } }),
  readyCase({ id: 'match_power_of_3_stability', group: PREPARATION_STABILITY_GROUPS.match, stage: 'match_analysis_generation', artifactType: 'match_analysis', artifacts: { matchAnalysis: makeMatchAnalysis({ strengths: ['React project'], gaps: ['cloud'], stableSignature: 'match-power-3-same', score: 0.69 }) }, expected: { stableSignature: 'match-power-3-same', powerOf3: true } }),
];

const questionPoolCases = [
  readyCase({ id: 'pool_rich_cv_rich_jd_full_pool', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ count: 12 }) }, expected: { minPoolCount: 10, requiredSources: ['cv_seed', 'jd_filter', 'match_gap'] } }),
  readyCase({ id: 'pool_react_cv_backend_integration_jd', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ topics: ['React', 'backend integration', 'API tradeoff'] }) }, expected: { requiredTopics: ['React', 'backend integration'], requiredSources: ['cv_seed', 'jd_filter'] } }),
  readyCase({ id: 'pool_sql_gap_validation', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ topics: ['SQL gap', 'database evidence'], sources: ['match_gap', 'jd_filter', 'cv_seed'] }) }, expected: { requiredTopics: ['SQL gap'], requiredSources: ['match_gap'] } }),
  readyCase({ id: 'pool_cloud_gap_validation', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ topics: ['cloud gap', 'deployment'], sources: ['match_gap', 'jd_filter', 'cv_seed'] }) }, expected: { requiredTopics: ['cloud gap'], requiredSources: ['match_gap'] } }),
  readyCase({ id: 'pool_behavioural_mode_star', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ mode: 'behavioural', topics: ['teamwork STAR', 'ownership STAR'] }) }, expected: { mode: 'behavioural', requiredCategories: ['behavioural'] } }),
  readyCase({ id: 'pool_technical_mode_tradeoff', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ mode: 'technical', topics: ['technical trade-off', 'validation method'] }) }, expected: { mode: 'technical', requiredTopics: ['technical trade-off'] } }),
  readyCase({ id: 'pool_combined_mode_balanced', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ mode: 'combined', topics: ['React', 'teamwork', 'SQL gap'] }) }, expected: { requiredCategories: ['technical', 'behavioural'], requiredSources: ['cv_seed', 'jd_filter', 'match_gap'] } }),
  readyCase({ id: 'pool_junior_role_avoids_overly_senior', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ juniorSafe: true, topics: ['entry-level implementation', 'learning evidence'] }) }, expected: { juniorSafe: true, absentTopics: ['enterprise architecture ownership'] } }),
  readyCase({ id: 'pool_senior_role_avoids_too_basic', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: makeQuestionPool({ seniorSafe: true, topics: ['architecture trade-off', 'mentoring'] }) }, expected: { seniorSafe: true, absentTopics: ['what is React'] } }),
  readyCase({
    id: 'pool_duplicate_seeds_deduped',
    group: PREPARATION_STABILITY_GROUPS.questionPool,
    stage: 'question_pool_composition',
    artifactType: 'question_pool',
    artifacts: {
      questionPool: makeQuestionPool({
        count: 8,
        topics: ['React ownership', 'React depth', 'testing result', 'teamwork STAR', 'API validation', 'SQL gap', 'deployment', 'wrap-up evidence'],
      }),
    },
    expected: { uniqueQuestionTopics: true, minPoolCount: 8 },
  }),
  explicitFailureCase({ id: 'pool_empty_cv_seeds_failure', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: [], preparationFailure: makePreparationFailure({ artifactType: 'cv_seeds', stage: 'question_pool_composition', reason: 'CV seeds missing before pool composition.' }) }, expected: { failureArtifactType: 'cv_seeds', failureStage: 'question_pool_composition' } }),
  explicitFailureCase({ id: 'pool_missing_jd_filter_failure', group: PREPARATION_STABILITY_GROUPS.questionPool, stage: 'question_pool_composition', artifactType: 'question_pool', artifacts: { questionPool: [], preparationFailure: makePreparationFailure({ artifactType: 'jd_filter', stage: 'question_pool_composition', reason: 'JD filter missing before pool composition.' }) }, expected: { failureArtifactType: 'jd_filter', failureStage: 'question_pool_composition' } }),
];

const retrievalCases = [
  readyCase({ id: 'retrieval_cv_profile_skill_query', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([{ id: 'cv-1', sourceType: 'cv_profile', text: 'React project evidence' }]), retrievalResult: makeRetrievalResult({ sourceType: 'cv_profile', text: 'React project evidence', query: 'React' }) }, expected: { indexedSourceTypes: ['cv_profile'], retrievalSourceType: 'cv_profile', query: 'React' } }),
  readyCase({ id: 'retrieval_jd_rubric_skill_query', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([{ id: 'jd-1', sourceType: 'jd_rubric', text: 'Required SQL evidence' }]), retrievalResult: makeRetrievalResult({ sourceType: 'jd_rubric', text: 'Required SQL evidence', query: 'SQL' }) }, expected: { indexedSourceTypes: ['jd_rubric'], retrievalSourceType: 'jd_rubric', query: 'SQL' } }),
  readyCase({ id: 'retrieval_prepared_pool_topic_query', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([{ id: 'pool-1', sourceType: 'question_pool', text: 'Question about API integration' }]), retrievalResult: makeRetrievalResult({ sourceType: 'question_pool', text: 'Question about API integration', query: 'API integration' }) }, expected: { indexedSourceTypes: ['question_pool'], retrievalSourceType: 'question_pool', query: 'API integration' } }),
  readyCase({ id: 'retrieval_match_gap_evidence', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([{ id: 'match-1', sourceType: 'match_analysis', text: 'Cloud gap evidence' }]), retrievalResult: makeRetrievalResult({ sourceType: 'match_analysis', text: 'Cloud gap evidence', query: 'cloud gap' }) }, expected: { indexedSourceTypes: ['match_analysis'], retrievalSourceType: 'match_analysis', query: 'cloud gap' } }),
  readyCase({ id: 'retrieval_interview_plan_objective', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([{ id: 'plan-1', sourceType: 'interview_plan', text: 'Validate ownership and depth' }]), retrievalResult: makeRetrievalResult({ sourceType: 'interview_plan', text: 'Validate ownership and depth', query: 'ownership' }) }, expected: { indexedSourceTypes: ['interview_plan'], retrievalSourceType: 'interview_plan', query: 'ownership' } }),
  readyCase({ id: 'retrieval_transcript_answer_evidence', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([{ id: 'turn-1', sourceType: 'transcript', text: 'I built the React dashboard' }]), retrievalResult: makeRetrievalResult({ sourceType: 'transcript', text: 'I built the React dashboard', query: 'React dashboard' }) }, expected: { indexedSourceTypes: ['transcript'], retrievalSourceType: 'transcript', query: 'React dashboard' } }),
  readyCase({ id: 'retrieval_source_type_preserved', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([{ id: 'source-1', sourceType: 'jd_filter', text: 'Priority React filter' }]), retrievalResult: makeRetrievalResult({ sourceType: 'jd_filter', text: 'Priority React filter', query: 'priority React' }) }, expected: { indexedSourceTypes: ['jd_filter'], retrievalSourceType: 'jd_filter', query: 'priority React' } }),
  explicitFailureCase({ id: 'retrieval_missing_artifact_failure', group: PREPARATION_STABILITY_GROUPS.retrieval, stage: 'artifact_indexing_retrieval', artifactType: 'retrieval_index', artifacts: { retrievalIndex: makeIndex([]), retrievalResult: { items: [] }, preparationFailure: makePreparationFailure({ artifactType: 'retrieval_index', stage: 'artifact_indexing_retrieval', reason: 'Required artifact was not indexed.' }) }, expected: { failureArtifactType: 'retrieval_index', failureStage: 'artifact_indexing_retrieval' } }),
];

const reportCases = [
  readyCase({ id: 'report_supported_strength_passes', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle() }, expected: { evidenceSources: ['cv_profile', 'jd_rubric', 'transcript'], qaStatus: 'ready' } }),
  explicitFailureCase({ id: 'report_invented_kubernetes_fails', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle({ qaStatus: 'needs_review', unsupportedClaims: ['Kubernetes skill invented'], needsReview: true }), preparationFailure: makePreparationFailure({ artifactType: 'report_evidence', stage: 'report_evidence_qa', reason: 'Unsupported Kubernetes claim detected.' }) }, expected: { failureArtifactType: 'report_evidence', failureStage: 'report_evidence_qa' } }),
  explicitFailureCase({ id: 'report_skipped_topic_claim_fails', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle({ qaStatus: 'needs_review', unsupportedClaims: ['Claimed answered skipped topic'], needsReview: true }), preparationFailure: makePreparationFailure({ artifactType: 'report_evidence', stage: 'report_evidence_qa', reason: 'Transcript did not support answered topic claim.' }) }, expected: { failureArtifactType: 'report_evidence', failureStage: 'report_evidence_qa' } }),
  explicitFailureCase({ id: 'report_high_score_without_evidence_fails', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle({ qaStatus: 'needs_review', unsupportedClaims: ['High score without evidence'], needsReview: true }), preparationFailure: makePreparationFailure({ artifactType: 'report_evidence', stage: 'report_evidence_qa', reason: 'Score lacks evidence.' }) }, expected: { failureArtifactType: 'report_evidence', failureStage: 'report_evidence_qa' } }),
  explicitFailureCase({ id: 'report_wrong_jd_requirement_fails', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle({ qaStatus: 'needs_review', unsupportedClaims: ['Wrong JD requirement'], needsReview: true }), preparationFailure: makePreparationFailure({ artifactType: 'report_evidence', stage: 'report_evidence_qa', reason: 'Report misstated JD requirement.' }) }, expected: { failureArtifactType: 'report_evidence', failureStage: 'report_evidence_qa' } }),
  explicitFailureCase({ id: 'report_transcript_contradiction_fails', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle({ qaStatus: 'needs_review', unsupportedClaims: ['Contradicts transcript'], needsReview: true }), preparationFailure: makePreparationFailure({ artifactType: 'report_evidence', stage: 'report_evidence_qa', reason: 'Report contradicts transcript.' }) }, expected: { failureArtifactType: 'report_evidence', failureStage: 'report_evidence_qa' } }),
  readyCase({ id: 'report_weak_evidence_needs_review', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle({ qaStatus: 'needs_review', needsReview: true }) }, expected: { evidenceSources: ['cv_profile', 'jd_rubric', 'transcript'], qaStatus: 'needs_review', needsReview: true } }),
  readyCase({ id: 'report_power_of_3_qa_stability', group: PREPARATION_STABILITY_GROUPS.report, stage: 'report_evidence_qa', artifactType: 'report_evidence', artifacts: { reportEvidence: makeReportBundle() }, expected: { evidenceSources: ['cv_profile', 'jd_rubric', 'transcript'], qaStatus: 'ready', powerOf3: true } }),
];

export const preparationStabilityCases = [
  ...cvParsingCases,
  ...cvSeedCases,
  ...jdParsingCases,
  ...jdFilterCases,
  ...matchCases,
  ...questionPoolCases,
  ...retrievalCases,
  ...reportCases,
];

const addFailure = (failures, message) => {
  if (message) failures.push(message);
};

const validateCvProfile = (caseItem, failures) => {
  const profile = caseItem.artifacts?.cvProfile;
  const expected = caseItem.expected || {};
  addFailure(failures, !profile && 'cv_profile_missing');
  if (!profile) return;

  for (const skill of expected.skills || []) addFailure(failures, !includesValue(profile.skills, skill) && `skill_missing:${skill}`);
  for (const skill of expected.absentSkills || []) addFailure(failures, includesValue(profile.skills, skill) && `skill_hallucinated:${skill}`);
  for (const section of expected.sectionsPresent || []) addFailure(failures, toList(profile[section]).length === 0 && `section_missing:${section}`);
  for (const section of expected.absentSections || []) addFailure(failures, toList(profile[section]).length > 0 && `section_hallucinated:${section}`);
  for (const section of expected.missingSections || []) addFailure(failures, !includesValue(profile.missingSections, section) && `missing_section_not_recorded:${section}`);
  for (const warning of expected.warnings || []) addFailure(failures, !includesValue(profile.warnings, warning) && `warning_missing:${warning}`);
  for (const label of expected.evidenceLabels || []) addFailure(failures, !profile.evidenceRefs?.some((item) => includesValue([item.label, item.text], label)) && `evidence_missing:${label}`);
  for (const project of expected.projectNames || []) addFailure(failures, !includesValue(profile.projects, project) && `project_missing:${project}`);
  if (expected.minConfidence != null) addFailure(failures, Number(profile.confidence) < expected.minConfidence && 'confidence_below_expected');
  if (expected.maxConfidence != null) addFailure(failures, Number(profile.confidence) > expected.maxConfidence && 'confidence_above_expected');
  if (expected.uniqueSkills) addFailure(failures, new Set(profile.skills.map(normalize)).size !== profile.skills.length && 'skills_not_deduped');
  addFailure(failures, !Array.isArray(profile.evidenceRefs) && 'cv_evidence_refs_missing');
};

const validateCvSeeds = (caseItem, failures) => {
  const seeds = caseItem.artifacts?.cvSeeds;
  const expected = caseItem.expected || {};
  addFailure(failures, !Array.isArray(seeds) && 'cv_seeds_missing');
  if (!Array.isArray(seeds)) return;

  if (expected.minSeedCount != null) addFailure(failures, seeds.length < expected.minSeedCount && 'seed_count_below_minimum');
  for (const topic of expected.seedTopics || []) addFailure(failures, !seeds.some((seed) => includesValue([seed.topic], topic)) && `seed_topic_missing:${topic}`);
  for (const topic of expected.absentSeedTopics || []) addFailure(failures, seeds.some((seed) => includesValue([seed.topic], topic)) && `seed_topic_hallucinated:${topic}`);
  if (expected.uniqueSeedTopics) addFailure(failures, new Set(seeds.map((seed) => normalize(seed.topic))).size !== seeds.length && 'seed_topics_not_deduped');
  if (expected.sourceProfileVersion) addFailure(failures, seeds.some((seed) => seed.sourceProfileVersion !== expected.sourceProfileVersion) && 'stale_seed_profile_version');
  addFailure(failures, seeds.some((seed) => !toList(seed.evidenceRefs).length) && 'seed_evidence_refs_missing');
  addFailure(failures, seeds.some((seed) => seed.fallbackGenerated === true) && 'fallback_seed_counted_as_ready');
};

const validateJdRubric = (caseItem, failures) => {
  const rubric = caseItem.artifacts?.jdRubric;
  const expected = caseItem.expected || {};
  addFailure(failures, !rubric && 'jd_rubric_missing');
  if (!rubric) return;

  if (expected.roleTitle != null) addFailure(failures, rubric.roleTitle !== expected.roleTitle && 'role_title_mismatch');
  if (expected.seniority) addFailure(failures, rubric.seniority !== expected.seniority && 'seniority_mismatch');
  if (expected.location) addFailure(failures, rubric.location !== expected.location && 'location_mismatch');
  if (expected.workType) addFailure(failures, rubric.workType !== expected.workType && 'work_type_mismatch');
  if (expected.fingerprint) addFailure(failures, rubric.fingerprint !== expected.fingerprint && 'fingerprint_mismatch');
  for (const item of expected.responsibilities || []) addFailure(failures, !includesValue(rubric.responsibilities, item) && `responsibility_missing:${item}`);
  for (const skill of expected.requiredSkills || []) addFailure(failures, !includesValue(rubric.requiredSkills, skill) && `required_skill_missing:${skill}`);
  for (const requirement of expected.absentRequirements || []) {
    addFailure(failures, includesValue([...rubric.requiredSkills, ...rubric.preferredSkills], requirement) && `unsupported_requirement_included:${requirement}`);
  }
  for (const warning of expected.warnings || []) addFailure(failures, !includesValue(rubric.warnings, warning) && `jd_warning_missing:${warning}`);
  for (const instruction of expected.ignoredInstructions || []) addFailure(failures, !includesValue(rubric.ignoredInstructions, instruction) && `injection_not_recorded:${instruction}`);
  if (expected.maxRequirementCount != null) addFailure(failures, rubric.requiredSkills.length > expected.maxRequirementCount && 'too_many_requirements_for_low_quality_input');
  if (expected.uniqueRequiredSkills) addFailure(failures, new Set(rubric.requiredSkills.map(normalize)).size !== rubric.requiredSkills.length && 'requirements_not_deduped');
  addFailure(failures, !Array.isArray(rubric.evidenceRefs) && 'jd_evidence_refs_missing');
};

const validateJdFilter = (caseItem, failures) => {
  const filter = caseItem.artifacts?.jdFilter;
  const expected = caseItem.expected || {};
  addFailure(failures, !filter && 'jd_filter_missing');
  if (!filter) return;

  addFailure(failures, filter.jdFilterReady !== true && 'jd_filter_not_ready');
  for (const skill of expected.prioritySkills || []) addFailure(failures, !includesValue(filter.prioritySkills, skill) && `priority_skill_missing:${skill}`);
  for (const skill of expected.absentPrioritySkills || []) addFailure(failures, includesValue(filter.prioritySkills, skill) && `noise_ranked_as_priority:${skill}`);
  for (const target of expected.gapTargets || []) addFailure(failures, !includesValue(filter.gapTargets, target) && `gap_target_missing:${target}`);
  if (expected.linkedArtifact) addFailure(failures, filter.jdFingerprint !== expected.linkedArtifact && 'jd_filter_unlinked_to_fingerprint');
  addFailure(failures, toList(filter.unsupportedRequirements).length > 0 && 'unsupported_jd_requirement_in_filter');
  addFailure(failures, !Array.isArray(filter.evidenceRefs) && 'jd_filter_evidence_refs_missing');
};

const validateMatchAnalysis = (caseItem, failures) => {
  const matchAnalysis = caseItem.artifacts?.matchAnalysis;
  const expected = caseItem.expected || {};
  addFailure(failures, !matchAnalysis && 'match_analysis_missing');
  if (!matchAnalysis) return;

  if (expected.minScore != null) addFailure(failures, Number(matchAnalysis.score) < expected.minScore && 'match_score_below_expected');
  if (expected.maxScore != null) addFailure(failures, Number(matchAnalysis.score) > expected.maxScore && 'match_score_above_expected');
  if (expected.maxGapCount != null) addFailure(failures, matchAnalysis.gaps.length > expected.maxGapCount && 'unexpected_gap_count');
  for (const gap of expected.gapLabels || []) addFailure(failures, !matchAnalysis.gaps.some((item) => includesValue([item.label], gap)) && `gap_missing:${gap}`);
  if (expected.strengthsWithCvEvidence) addFailure(failures, matchAnalysis.strengths.some((item) => !toList(item.cvEvidenceRefs).length) && 'strength_cv_evidence_missing');
  if (expected.gapsWithJdEvidence) addFailure(failures, matchAnalysis.gaps.some((item) => !toList(item.jdEvidenceRefs).length) && 'gap_jd_evidence_missing');
  if (expected.stableSignature) addFailure(failures, matchAnalysis.stableSignature !== expected.stableSignature && 'stability_signature_changed');
  addFailure(failures, matchAnalysis.persistedForPlan !== true && 'match_not_shaped_for_plan_use');
};

const validateQuestionPool = (caseItem, failures) => {
  const pool = caseItem.artifacts?.questionPool;
  const expected = caseItem.expected || {};
  addFailure(failures, !Array.isArray(pool) && 'question_pool_missing');
  if (!Array.isArray(pool)) return;

  if (expected.minPoolCount != null) addFailure(failures, pool.length < expected.minPoolCount && 'question_pool_below_minimum');
  for (const source of expected.requiredSources || []) addFailure(failures, !pool.some((item) => item.sourceStage === source) && `question_source_missing:${source}`);
  for (const topic of expected.requiredTopics || []) addFailure(failures, !pool.some((item) => includesValue([item.topic, item.text], topic)) && `question_topic_missing:${topic}`);
  for (const topic of expected.absentTopics || []) addFailure(failures, pool.some((item) => includesValue([item.topic, item.text], topic)) && `question_topic_should_not_exist:${topic}`);
  for (const category of expected.requiredCategories || []) addFailure(failures, !pool.some((item) => item.category === category) && `question_category_missing:${category}`);
  if (expected.juniorSafe) addFailure(failures, pool.some((item) => item.juniorSafe === false) && 'junior_unsafe_question');
  if (expected.seniorSafe) addFailure(failures, pool.some((item) => item.seniorSafe === false) && 'senior_unsafe_question');
  if (expected.uniqueQuestionTopics) addFailure(failures, new Set(pool.map((item) => normalize(item.topic))).size !== pool.length && 'duplicate_question_topics');
  addFailure(failures, pool.some((item) => !item.sourceMetadata?.evidenceRefs?.length) && 'question_source_metadata_missing');
  addFailure(failures, pool.some((item) => !hasText(item.whyThisQuestion)) && 'question_rationale_missing');
  addFailure(failures, pool.some((item) => item.fallbackGenerated === true || item.sourceStage === 'fallback') && 'fallback_question_counted_as_ready');
};

const validateRetrieval = (caseItem, failures) => {
  const retrievalIndex = caseItem.artifacts?.retrievalIndex;
  const retrievalResult = caseItem.artifacts?.retrievalResult;
  const expected = caseItem.expected || {};
  addFailure(failures, !retrievalIndex && 'retrieval_index_missing');
  if (!retrievalIndex) return;

  for (const sourceType of expected.indexedSourceTypes || []) {
    addFailure(failures, !retrievalIndex.indexedArtifacts.some((item) => item.sourceType === sourceType) && `indexed_source_missing:${sourceType}`);
  }
  addFailure(failures, !retrievalResult?.items?.length && 'retrieval_result_missing');
  if (retrievalResult?.items?.length) {
    addFailure(failures, retrievalResult.items[0].sourceType !== expected.retrievalSourceType && 'retrieval_source_type_mismatch');
    addFailure(failures, !includesValue([retrievalResult.items[0].text], expected.query) && 'retrieval_query_not_supported_by_text');
    addFailure(failures, retrievalResult.items[0].metadata?.sourceType !== retrievalResult.items[0].sourceType && 'retrieval_source_type_not_preserved');
  }
};

const validateReportEvidence = (caseItem, failures) => {
  const reportEvidence = caseItem.artifacts?.reportEvidence;
  const expected = caseItem.expected || {};
  addFailure(failures, !reportEvidence && 'report_evidence_missing');
  if (!reportEvidence) return;

  const sources = reportEvidence.report?.evidenceReferences?.map((item) => item.sourceType) || [];
  for (const source of expected.evidenceSources || []) addFailure(failures, !sources.includes(source) && `report_evidence_source_missing:${source}`);
  if (expected.qaStatus) addFailure(failures, reportEvidence.qa?.status !== expected.qaStatus && 'report_qa_status_mismatch');
  if (expected.needsReview != null) addFailure(failures, reportEvidence.qa?.needsReview !== expected.needsReview && 'report_needs_review_mismatch');
  if (reportEvidence.qa?.status === 'ready') addFailure(failures, toList(reportEvidence.qa.unsupportedClaims).length > 0 && 'unsupported_claim_ready_status');
};

const validators = {
  cv_profile: validateCvProfile,
  cv_seeds: validateCvSeeds,
  jd_rubric: validateJdRubric,
  jd_filter: validateJdFilter,
  match_analysis: validateMatchAnalysis,
  question_pool: validateQuestionPool,
  retrieval_index: validateRetrieval,
  report_evidence: validateReportEvidence,
};

const validateExplicitFailure = (caseItem, failures) => {
  const failure = caseItem.artifacts?.preparationFailure;
  const expected = caseItem.expected || {};
  addFailure(failures, !failure?.explicit && 'preparation_failure_not_explicit');
  addFailure(failures, failure?.artifactType !== expected.failureArtifactType && 'failure_artifact_type_mismatch');
  addFailure(failures, failure?.stage !== expected.failureStage && 'failure_stage_mismatch');
  addFailure(failures, failure?.fallbackConvertedToPass === true && 'fallback_converted_failure_to_pass');
};

export const getPreparationStabilityCasesByGroup = (group) => preparationStabilityCases.filter((caseItem) => caseItem.group === group);

export const evaluatePreparationStabilityCase = (caseItem = {}) => {
  const failures = [];
  const expectedPreparationFailure = caseItem.artifacts?.preparationFailure;

  addFailure(failures, caseItem.fallback?.convertedToPass === true && 'fallback_converted_to_pass');
  if (caseItem.expectedOutcome === 'explicit_failure') validateExplicitFailure(caseItem, failures);
  else validators[caseItem.artifactType]?.(caseItem, failures);

  return {
    id: caseItem.id,
    group: caseItem.group,
    stage: caseItem.stage,
    artifactType: caseItem.artifactType,
    expectedOutcome: caseItem.expectedOutcome,
    passed: failures.length === 0,
    failedChecks: failures,
    fallbackTriggered: caseItem.fallback?.triggered === true,
    fallbackConvertedToPass: caseItem.fallback?.convertedToPass === true,
    failedArtifactType: failures.length ? caseItem.artifactType : expectedPreparationFailure?.artifactType || null,
    failedStage: failures.length ? caseItem.stage : expectedPreparationFailure?.stage || null,
    recommendedFixArea: failures.length
      ? `${caseItem.stage}:${caseItem.artifactType}`
      : expectedPreparationFailure
        ? `${expectedPreparationFailure.stage}:${expectedPreparationFailure.artifactType}`
        : null,
  };
};

const countPowerOf3Cases = (cases = []) => cases.filter((caseItem) => caseItem.expected?.powerOf3 === true).length;

export const buildPreparationStabilitySummary = (cases = preparationStabilityCases) => {
  const results = cases.map((caseItem) => evaluatePreparationStabilityCase(caseItem));
  const failedResults = results.filter((result) => !result.passed);
  const artifactFailures = { ...BASE_ARTIFACT_FAILURES };

  for (const result of failedResults) {
    const key = ARTIFACT_FAILURE_KEYS[result.artifactType];
    if (key) artifactFailures[key] += 1;
  }

  return {
    suite: PREPARATION_STABILITY_SUITE,
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    passed: results.length - failedResults.length,
    failed: failedResults.length,
    artifactFailures,
    fallbackDiagnostics: {
      fallbackTriggered: results.filter((result) => result.fallbackTriggered).length,
      fallbackConvertedToPass: results.filter((result) => result.fallbackConvertedToPass).length,
    },
    stabilityChecks: {
      powerOf3Cases: countPowerOf3Cases(cases),
      criticalInconsistency: failedResults.length,
    },
    groups: Object.fromEntries(Object.values(PREPARATION_STABILITY_GROUPS).map((group) => {
      const groupResults = results.filter((result) => result.group === group);
      return [group, {
        totalCases: groupResults.length,
        passed: groupResults.filter((result) => result.passed).length,
        failed: groupResults.filter((result) => !result.passed).length,
      }];
    })),
    results,
  };
};

export const renderPreparationStabilityMarkdown = (summary = {}) => {
  const lines = [
    '# Preparation Stability Evaluation',
    '',
    `Suite: ${summary.suite}`,
    `Total cases: ${summary.totalCases}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    '',
    '## Artifact Failures',
    '',
    '| Artifact type | Count |',
    '|---|---:|',
    ...Object.entries(summary.artifactFailures || {}).map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Case Results',
    '',
    '| Case | Group | Passed | Failed artifact type | Failed stage | Fallback triggered | Why fallback did not count as pass | Recommended fix area |',
    '|---|---|---|---|---|---|---|---|',
  ];

  for (const result of summary.results || []) {
    const fallbackReason = result.expectedOutcome === 'explicit_failure'
      ? 'Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness.'
      : result.fallbackTriggered || result.fallbackConvertedToPass
      ? 'Fallback is diagnostic only and cannot satisfy required preparation artifacts.'
      : 'No fallback was used for this case.';
    lines.push([
      result.id,
      result.group,
      String(result.passed),
      result.failedArtifactType || '-',
      result.failedStage || '-',
      String(result.fallbackTriggered),
      fallbackReason,
      result.recommendedFixArea || '-',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  return lines.join('\n');
};

export const writePreparationStabilityReports = async ({ reportRoot, summary = buildPreparationStabilitySummary() } = {}) => {
  await fs.mkdir(reportRoot, { recursive: true });
  await fs.writeFile(
    path.join(reportRoot, 'preparation-stability.latest.json'),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  await fs.writeFile(
    path.join(reportRoot, 'preparation-stability.latest.md'),
    `${renderPreparationStabilityMarkdown(summary)}\n`
  );
  return summary;
};
