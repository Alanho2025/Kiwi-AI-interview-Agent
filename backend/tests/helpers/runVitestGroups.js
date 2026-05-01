/**
 * File responsibility: Backend Vitest group runner.
 * Main responsibilities:
 * - Run multiple Vitest groups without fail-fast behaviour.
 * - Keep the final exit code failing when any group fails.
 */

import { spawnSync } from 'node:child_process';

const requestedGroups = process.argv.slice(2);
const groups = requestedGroups.length > 0 ? requestedGroups : ['tests/robustness'];
const failures = [];

for (const group of groups) {
  console.log(`\n\n=== Running backend test group: ${group} ===`);
  const result = spawnSync('npx', ['vitest', 'run', group, '--passWithNoTests=false'], {
    cwd: new URL('../..', import.meta.url),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    failures.push({ group, status: result.status ?? 1 });
  }
}

if (failures.length > 0) {
  console.error('\n\nBackend test run completed with failures:');
  for (const failure of failures) {
    console.error(`- ${failure.group} failed with exit code ${failure.status}`);
  }
  process.exit(1);
}

console.log('\n\nAll backend test groups passed.');
