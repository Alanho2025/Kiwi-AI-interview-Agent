import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { buildStructuredJobDescriptionRubric } from '../backend/src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { buildRoleFitProfile } from '../backend/src/services/jobDescription/roleFitProfileBuilder.js';
import { compareCvToJobDescription } from '../backend/src/services/matchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Inject environment variables from .env
dotenv.config({ path: path.join(projectRoot, 'backend/.env') });

// Ensure correct test/real AI mode and engine settings
process.env.AI_TEST_MODE = 'real';
process.env.MATCH_ENGINE = 'semantic';
process.env.DISABLE_AI_JD_ENHANCEMENT = 'false'; // Keep standard enhancement active

const fixturesRoot = path.join(projectRoot, 'backend/tests/fixtures');
const cvPath = path.join(fixturesRoot, 'cv/alan-ho-cv.txt');
const jdFiles = [
  {
    id: 'seek_caruso_senior_software_engineer_agentic',
    name: 'seek-caruso-senior-software-engineer-agentic.txt',
    companyWebsiteUrl: 'https://getcaruso.com',
    userCompanyContext: 'Caruso is an AI-native fund administration platform for private markets.'
  },
  {
    id: 'seek_humankind_junior_intermediate_frontend_developer',
    name: 'seek-humankind-junior-intermediate-frontend-developer.txt',
    companyWebsiteUrl: 'https://humankind.co.nz',
    userCompanyContext: 'Humankind represents an aviation SaaS platform used globally.'
  },
  {
    id: 'seek_talent_army_software_engineer',
    name: 'seek-talent-army-software-engineer.txt',
    companyWebsiteUrl: 'https://talent.army',
    userCompanyContext: 'Talent Army client is a Work-From-Home remote workflow automation platform SaaS.'
  },
  {
    id: 'seek_serato_graduate_programme',
    name: 'seek-serato-graduate-programme.txt',
    companyWebsiteUrl: 'https://serato.com',
    userCompanyContext: 'Serato is one of the world leaders in audio software for professional DJs and musicians.'
  },
  {
    id: 'seek_hi_tech_ai_product_engineer',
    name: 'seek-hi-tech-ai-product-engineer.txt',
    companyWebsiteUrl: 'https://hi-tech.example.com',
    userCompanyContext: 'HI Tech represents a construction technology client building software.'
  }
];

async function run() {
  console.log('Reading Alan Ho CV from', cvPath);
  const cvText = await fs.readFile(cvPath, 'utf8');

  const comparisonReport = [];

  for (const jdFile of jdFiles) {
    console.log(`\n----------------------------------------`);
    console.log(`Processing JD: ${jdFile.name}...`);
    const jdPath = path.join(fixturesRoot, 'jobDescription', jdFile.name);
    const jdText = await fs.readFile(jdPath, 'utf8');

    console.log('Parsing JD using current code (DeepSeek)...');
    const rubric = await buildStructuredJobDescriptionRubric(jdText);

    console.log('Building Role Fit profile...');
    const roleFit = buildRoleFitProfile({
      rawJD: jdText,
      rubric,
      companyWebsiteUrl: jdFile.companyWebsiteUrl,
      userCompanyContext: jdFile.userCompanyContext
    });
    rubric.roleFit = roleFit;
    rubric.roleFit.review = { status: 'verified', version: 1, baseVersion: 0 };

    console.log('Running CV-JD Match...');
    const result = await compareCvToJobDescription(cvText, jdText, rubric, { matchEngine: 'semantic' });

    console.log(`Match Score (DS): ${result.overallScore}`);
    console.log(`Decision: ${result.decision?.label}`);
    console.log(`Macro Fit: ${result.scoreBreakdown?.macro}`);
    console.log(`Micro Fit: ${result.scoreBreakdown?.micro}`);
    console.log(`Requirements: ${result.scoreBreakdown?.requirements}`);
    console.log(`Intent Coverage:`, result.roleEvidenceMap?.intentCoverage);

    comparisonReport.push({
      id: jdFile.id,
      fileName: jdFile.name,
      dsOutput: {
        overallScore: result.overallScore,
        decision: result.decision?.label,
        scoreBreakdown: result.scoreBreakdown,
        intentCoverage: result.roleEvidenceMap?.intentCoverage,
        classificationCounts: result.roleEvidenceMap?.classificationCounts,
        title: rubric.title,
        companyName: rubric.jobOverview?.companyName,
        industry: rubric.universalRoleProfile?.industry,
        roleDomain: rubric.universalRoleProfile?.roleDomain,
        seniority: rubric.universalRoleProfile?.seniority,
        requirementCount: rubric.universalRoleProfile?.requirements?.length || 0,
        requirements: rubric.universalRoleProfile?.requirements?.map(r => ({ text: r.text, type: r.type, importance: r.importance }))
      }
    });
  }

  const outPath = path.join(projectRoot, 'scratch/ds-run-results.json');
  await fs.writeFile(outPath, JSON.stringify(comparisonReport, null, 2), 'utf8');
  console.log(`\nEvaluation run complete. Results saved to: ${outPath}`);
}

run().catch(error => {
  console.error('Run failed:', error);
  process.exit(1);
});
