import path from 'node:path';

import { runRoleFitReleaseGateEvaluation } from '../helpers/roleFitReleaseGateEvaluator.js';

const repoRoot = path.resolve('.');
const summary = await runRoleFitReleaseGateEvaluation({
  backendRoot: repoRoot,
  reportRoot: path.join(repoRoot, 'eval/reports'),
});

console.log('Role-Fit release gate evaluation complete.');
console.log(`Status: ${summary.releaseStatus}`);
console.log(`Final claim allowed: ${summary.finalClaimAllowed ? 'yes' : 'no'}`);
console.log(`Release blockers: ${summary.releaseBlockers.length ? summary.releaseBlockers.join(', ') : 'none'}`);
console.log(`Known issues: ${summary.knownIssues.length ? summary.knownIssues.join(', ') : 'none'}`);
