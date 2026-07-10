import path from 'node:path';

import { runHumanCalibrationEvaluation } from '../helpers/humanCalibrationEvaluator.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/manual-review/role-fit-calibration-v1.json');
const reportRoot = path.join(repoRoot, 'eval/reports');

const summary = await runHumanCalibrationEvaluation({ datasetPath, reportRoot });

console.log('Human calibration evaluation complete.');
console.log(`Status: ${summary.status}`);
console.log(`Reviewed cases: ${summary.reviewedCases}/${summary.totalCases}`);
console.log(`Numerical threshold allowed: ${summary.canAssertNumericalReleaseThreshold ? 'yes' : 'no'}`);
