#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const groups = [
  { name: 'backend voice unit', cwd: path.join(root, 'backend'), cmd: 'npx', args: ['vitest', 'run', 'tests/unit/voice', '--passWithNoTests=false'] },
  { name: 'frontend voice utils', cwd: path.join(root, 'frontend'), cmd: 'npx', args: ['vitest', 'run', 'src/utils/__tests__', '--passWithNoTests=false'] },
];

const results = [];
for (const group of groups) {
  console.log(`\n[voice-test-suite] Running ${group.name}`);
  const result = spawnSync(group.cmd, group.args, { cwd: group.cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  results.push({ name: group.name, status: result.status ?? 1 });
}

console.log('\n[voice-test-suite] Summary');
for (const result of results) {
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${result.name}`);
}

process.exit(results.some((result) => result.status !== 0) ? 1 : 0);
