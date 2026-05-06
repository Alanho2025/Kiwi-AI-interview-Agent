/**
 * File responsibility: Deterministic report grounding checks for Kiwi report evals.
 * Main responsibilities:
 * - Verify that feedback reports are backed by transcript evidence and analysis data.
 * - Catch hallucinated skills, unsupported praise, missing score justification, and weak coaching.
 * - Complement the existing report QA agent with outcome-validity style checks.
 */

const normalize = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const toText = (value = {}) => normalize(JSON.stringify(value));
const unique = (items = []) => [...new Set(items.filter(Boolean))];
const tokenize = (value = '') => normalize(value).split(' ').filter((token) => token.length > 2);
const collectKnownTerms = ({ transcript = [], analysisResult = {} } = {}) => unique([...transcript.map((turn) => turn.text || ''), ...(analysisResult.parsedCvProfile?.skills || []), ...(analysisResult.parsedCvProfile?.projects || []), ...(analysisResult.parsedJdProfile?.requiredSkills || []), ...(analysisResult.parsedJdProfile?.preferredSkills || []), ...(analysisResult.explanation?.strengths || []), ...(analysisResult.explanation?.gaps || [])].flatMap((item) => tokenize(item)));

export const judgeReportGrounding = ({ report = {}, transcript = [], analysisResult = {}, forbiddenClaims = [] } = {}) => {
  const reportText = toText(report);
  const transcriptText = toText(transcript);
  const knownTerms = collectKnownTerms({ transcript, analysisResult });
  const hasEvidenceReference = (report.evidenceReferences || []).length > 0 || transcript.some((turn) => reportText.includes(normalize(turn.text || '').slice(0, 24)));
  const forbiddenHits = forbiddenClaims.filter((claim) => reportText.includes(normalize(claim)) && !transcriptText.includes(normalize(claim)));
  const skillClaims = (report.claimedSkills || []).filter((skill) => !knownTerms.includes(normalize(skill)) && !transcriptText.includes(normalize(skill)));
  const checks = [
    { label: 'summary_present', passed: Boolean(report.summary) },
    { label: 'evidence_reference_present', passed: hasEvidenceReference },
    { label: 'score_has_justification', passed: Boolean(report.scores?.averageInteractionScore === undefined || reportText.includes('score') || reportText.includes('because') || reportText.includes('evidence')) },
    { label: 'coaching_present', passed: Boolean(report.candidateFeedback?.coachingAdvice?.length || reportText.includes('improve') || reportText.includes('next')) },
    { label: 'no_forbidden_claims', passed: forbiddenHits.length === 0 },
    { label: 'no_unknown_skill_claims', passed: skillClaims.length === 0 },
  ];
  const earned = checks.filter((check) => check.passed).length;
  return { score: Number((earned / checks.length).toFixed(2)), earned, possible: checks.length, failedChecks: checks.filter((check) => !check.passed).map((check) => check.label), forbiddenHits, skillClaims, checks };
};
