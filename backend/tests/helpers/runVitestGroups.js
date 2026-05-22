/**
 * File responsibility: Backend Vitest group runner.
 * Main responsibilities:
 * - Run multiple Vitest groups without fail-fast behaviour.
 * - Keep the final exit code failing when any group fails.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const backendRoot = resolve(new URL('../..', import.meta.url).pathname);
const vitestCli = resolve(backendRoot, 'node_modules/vitest/vitest.mjs');

const requestedGroups = process.argv.slice(2);
const groups = requestedGroups.length > 0 ? requestedGroups : ['tests/robustness'];
const failures = [];

if (!existsSync(vitestCli)) {
  console.error(`Vitest CLI not found at ${vitestCli}. Run npm install in backend first.`);
  process.exit(1);
}

for (const group of groups) {
  console.log(`\n\n=== Running backend test group: ${group} ===`);
  const result = spawnSync(process.execPath, [vitestCli, 'run', group, '--passWithNoTests=false'], {
    cwd: backendRoot,
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
