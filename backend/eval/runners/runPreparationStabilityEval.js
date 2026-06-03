import path from 'node:path';

import {
  buildPreparationStabilitySummary,
  writePreparationStabilityReports,
} from '../helpers/preparationStabilitySuite.js';

const repoRoot = path.resolve('.');
const reportRoot = path.join(repoRoot, 'eval/reports');

const summary = buildPreparationStabilitySummary();
await writePreparationStabilityReports({ reportRoot, summary });

console.log('Preparation stability eval complete.');
console.log(`Cases run: ${summary.totalCases}`);
console.log(`Passed: ${summary.passed}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Fallback converted to pass: ${summary.fallbackDiagnostics.fallbackConvertedToPass}`);

if (summary.failed > 0 || summary.fallbackDiagnostics.fallbackConvertedToPass > 0) {
  process.exit(1);
}
