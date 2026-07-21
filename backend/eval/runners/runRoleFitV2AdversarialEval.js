import path from 'node:path';

import { runRoleFitV2AdversarialEvaluation } from '../helpers/roleFitV2AdversarialEvaluator.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/role-fit-v2/adversarial-v1.json');
const calibrationDatasetPath = path.join(repoRoot, 'eval/manual-review/role-fit-calibration-v1.json');
const reportRoot = path.join(repoRoot, 'eval/reports');

const summary = await runRoleFitV2AdversarialEvaluation({ datasetPath, calibrationDatasetPath, reportRoot });

console.log('Role-Fit V2 adversarial evaluation complete.');
console.log(`Dataset checks passed: ${summary.datasetChecksPassed ? 'yes' : 'no'}`);
console.log(`Cases: ${summary.totalCases}`);
console.log(`Calibration status: ${summary.calibrationStatus}`);
console.log(`Calibration reviewed cases: ${summary.calibrationReviewedCases}`);
console.log(`Release threshold: ${summary.releaseThreshold ?? 'not set'}`);
console.log(`Production claim allowed: ${summary.productionClaimAllowed ? 'yes' : 'no'}`);
console.log(`Production claim blocker: ${summary.productionClaimBlocker || 'none'}`);
