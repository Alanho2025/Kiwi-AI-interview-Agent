import path from 'node:path';

import { runE2eRefineReleaseGateEvaluation } from '../helpers/e2eRefineReleaseGateEvaluator.js';

const backendRoot = path.resolve('.');
const summary = await runE2eRefineReleaseGateEvaluation({
  backendRoot,
  reportRoot: path.join(backendRoot, 'eval/reports'),
});

console.log('E2E refine release gate evaluation complete.');
console.log(`Status: ${summary.releaseStatus}`);
console.log(`Release blockers: ${summary.releaseBlockers.length ? summary.releaseBlockers.join(', ') : 'none'}`);
console.log(`Known issues: ${summary.knownIssues.length ? summary.knownIssues.join(', ') : 'none'}`);

if (summary.releaseStatus === 'blocked') {
  process.exitCode = 1;
}
