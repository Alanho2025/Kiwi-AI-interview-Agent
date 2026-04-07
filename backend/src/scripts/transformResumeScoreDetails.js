import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { buildJdRubricSchema, buildRequirementItem, buildExplanationItem, buildExplanationObject } from '../services/scoringSchemaService.js';
import { buildTaxonomyItem } from '../services/taxonomyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultInputDir = path.resolve(__dirname, '../../../../resume-score-details');
const defaultOutputDir = path.resolve(__dirname, '../../../../data/resume-score-details-normalized');

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const safeReadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const listJsonFiles = (dir) => fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => path.join(dir, name));

const toArray = (value) => (Array.isArray(value) ? value : []);
const toString = (value) => (typeof value === 'string' ? value : '');
const parseCaseLabel = (fileName) => {
  if (fileName.startsWith('match_')) return 'match';
  if (fileName.startsWith('mismatch_')) return 'mismatch';
  if (fileName.startsWith('invalid_')) return 'invalid';
  if (fileName.startsWith('empty_')) return 'empty';
  return 'other';
};

const normalizeCvProfile = (details = {}, caseId) => ({
  caseId,
  candidateName: toString(details.name) || 'Candidate',
  email: toString(details.email_id),
  phone: toString(details.number),
  location: toString(details.location),
  executiveSummary: toString(details.executive_summary),
  skills: toArray(details.skills),
  education: toArray(details.education),
  employmentHistory: toArray(details.employment_history),
  projects: toArray(details.projects),
  certifications: toArray(details.certifications),
  achievements: toArray(details.achievements),
  publications: toArray(details.publications),
  urls: toArray(details.additional_urls),
  schemaVersion: 'v1',
});

const normalizeJdRubric = (input = {}, caseId) => {
  const macroDict = input.macro_dict || {};
  const microDict = input.micro_dict || {};
  const macroCriteria = Object.keys(macroDict).map((label) => buildTaxonomyItem(label, { type: 'macro', weight: Number(macroDict[label]) || 0 }));
  const microCriteria = Object.keys(microDict).map((label) => buildTaxonomyItem(label, { type: 'micro', weight: Number(microDict[label]) || 0 }));
  const requirements = toArray(input.minimum_requirements).map((label) => buildRequirementItem({ label, type: 'hard', importance: 'high' }));

  return buildJdRubricSchema({
    title: 'Imported JD',
    roleSummary: [toString(input.job_description).slice(0, 240)],
    macroCriteria,
    microCriteria,
    requirements,
    weights: {
      macro: macroDict,
      micro: microDict,
      overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
    },
    keywords: [...Object.keys(macroDict), ...Object.keys(microDict)],
    metadata: {
      sourceType: 'resume_score_details',
      parserVersion: 'import_v1',
      confidence: 0.95,
      caseId,
      sourceLength: toString(input.job_description).length,
    },
  });
};

const normalizeGroundTruth = (output = {}, caseId) => {
  const scores = output.scores || {};
  const macroScores = toArray(scores.macro_scores).map((item) => ({
    id: buildTaxonomyItem(item.criteria).id,
    label: item.criteria,
    score: Number(item.score) || 0,
  }));
  const microScores = toArray(scores.micro_scores).map((item) => ({
    id: buildTaxonomyItem(item.criteria).id,
    label: item.criteria,
    score: Number(item.score) || 0,
  }));
  const requirementChecks = toArray(scores.requirements).map((item) => ({
    id: buildTaxonomyItem(item.criteria).id,
    label: item.criteria,
    status: item.meets ? 'met' : 'not_met',
    type: 'hard',
    importance: 'high',
  }));
  const justifications = toArray(output.justification).map((text) => buildExplanationItem({ label: text, detail: text }));

  return {
    caseId,
    validResumeAndJd: Boolean(output.valid_resume_and_jd),
    personalInfo: output.personal_info || {},
    macroScores,
    microScores,
    requirementChecks,
    aggregatedScores: scores.aggregated_scores || {},
    explanation: buildExplanationObject({
      strengths: justifications.slice(0, 2),
      gaps: justifications.slice(2, 4),
      risks: !output.valid_resume_and_jd ? [buildExplanationItem({ label: 'invalid_input', detail: 'Original sample marked invalid' })] : [],
      summary: toArray(output.justification).join(' '),
    }),
    schemaVersion: 'v1',
  };
};

const buildChunks = ({ caseId, cvProfile, jdRubric, groundTruth, rawResume, rawJobDescription }) => {
  const chunks = [];
  const pushChunk = (documentType, sourceType, text, metadata = {}) => {
    if (!text || !String(text).trim()) return;
    chunks.push({
      chunkId: crypto.randomUUID(),
      caseId,
      sourceType,
      sourceId: caseId,
      documentType,
      text: String(text).trim(),
      normalizedText: String(text).toLowerCase().trim(),
      metadata,
      schemaVersion: 'v1',
    });
  };

  pushChunk('cv_profile', 'cv', rawResume, { kind: 'raw_resume' });
  pushChunk('jd_rubric', 'jd', rawJobDescription, { kind: 'raw_job_description' });
  pushChunk('cv_profile', 'cv', cvProfile.executiveSummary, { kind: 'executive_summary' });
  for (const skill of cvProfile.skills || []) pushChunk('cv_profile', 'cv', skill, { kind: 'skill' });
  for (const criterion of jdRubric.macroCriteria || []) pushChunk('jd_rubric', 'jd', criterion.label, { kind: 'macro_criterion' });
  for (const criterion of jdRubric.microCriteria || []) pushChunk('jd_rubric', 'jd', criterion.label, { kind: 'micro_criterion' });
  for (const requirement of jdRubric.requirements || []) pushChunk('requirement', 'jd', requirement.label, { kind: 'requirement', type: requirement.type });
  for (const justification of groundTruth.explanation?.strengths || []) pushChunk('ground_truth', 'ground_truth', justification.label, { kind: 'justification_strength' });
  for (const justification of groundTruth.explanation?.gaps || []) pushChunk('ground_truth', 'ground_truth', justification.label, { kind: 'justification_gap' });
  return chunks;
};

const writeJsonl = (filePath, records) => fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n'));

const run = ({ inputDir = defaultInputDir, outputDir = defaultOutputDir } = {}) => {
  ensureDir(outputDir);
  const cvProfiles = [];
  const jdRubrics = [];
  const groundTruthRecords = [];
  const chunks = [];
  const benchmarkCases = [];

  for (const filePath of listJsonFiles(inputDir)) {
    const raw = safeReadJson(filePath);
    const fileName = path.basename(filePath);
    const caseId = fileName.replace(/\.json$/i, '');
    const label = parseCaseLabel(fileName);
    const cvProfile = normalizeCvProfile(raw.details, caseId);
    const jdRubric = normalizeJdRubric(raw.input, caseId);
    const groundTruth = normalizeGroundTruth(raw.output, caseId);
    const caseChunks = buildChunks({
      caseId,
      cvProfile,
      jdRubric,
      groundTruth,
      rawResume: raw.input?.resume || '',
      rawJobDescription: raw.input?.job_description || '',
    });

    cvProfiles.push(cvProfile);
    jdRubrics.push(jdRubric);
    groundTruthRecords.push(groundTruth);
    chunks.push(...caseChunks);
    benchmarkCases.push({
      caseId,
      label,
      input: raw.input,
      parsedCvProfile: cvProfile,
      jdRubric,
      groundTruth,
      schemaVersion: 'v1',
    });
  }

  fs.writeFileSync(path.join(outputDir, 'normalized_cv_profiles.json'), JSON.stringify(cvProfiles, null, 2));
  fs.writeFileSync(path.join(outputDir, 'normalized_jd_rubrics.json'), JSON.stringify(jdRubrics, null, 2));
  fs.writeFileSync(path.join(outputDir, 'normalized_eval_ground_truth.json'), JSON.stringify(groundTruthRecords, null, 2));
  fs.writeFileSync(path.join(outputDir, 'normalized_rag_chunks.json'), JSON.stringify(chunks, null, 2));
  fs.writeFileSync(path.join(outputDir, 'normalized_rag_benchmark_cases.json'), JSON.stringify(benchmarkCases, null, 2));
  writeJsonl(path.join(outputDir, 'normalized_cv_profiles.jsonl'), cvProfiles);
  writeJsonl(path.join(outputDir, 'normalized_jd_rubrics.jsonl'), jdRubrics);
  writeJsonl(path.join(outputDir, 'normalized_eval_ground_truth.jsonl'), groundTruthRecords);
  writeJsonl(path.join(outputDir, 'normalized_rag_chunks.jsonl'), chunks);
  writeJsonl(path.join(outputDir, 'normalized_rag_benchmark_cases.jsonl'), benchmarkCases);

  console.log(`Normalized ${benchmarkCases.length} cases into ${outputDir}`);
};

if (process.argv[1] === __filename) {
  const inputDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultInputDir;
  const outputDir = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : defaultOutputDir;
  run({ inputDir, outputDir });
}

export { run as transformResumeScoreDetails };
