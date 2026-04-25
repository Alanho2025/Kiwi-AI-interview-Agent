/**
 * File responsibility: Full test runner.
 * Main responsibilities:
 * - Run frontend and backend test groups without fail-fast behaviour.
 * - Report all failing groups at the end so one broken test does not hide the rest.
 */

import { spawnSync } from 'node:child_process';

const isVoiceOnly = process.argv.includes('--voice');

const groups = isVoiceOnly
  ? [
      { name: 'frontend voice tests', command: 'npm', args: ['--prefix', 'frontend', 'run', 'test:voice'] },
      { name: 'backend voice tests', command: 'npm', args: ['--prefix', 'backend', 'run', 'test:voice'] },
    ]
  : [
      { name: 'frontend tests', command: 'npm', args: ['--prefix', 'frontend', 'run', 'test'] },
      { name: 'backend tests', command: 'npm', args: ['--prefix', 'backend', 'run', 'test:all'] },
    ];

const failures = [];

for (const group of groups) {
  console.log(`\n\n=== Running ${group.name} ===`);
  const result = spawnSync(group.command, group.args, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    failures.push({ name: group.name, status: result.status ?? 1 });
  }
}

if (failures.length > 0) {
  console.error('\n\nTest run completed with failures:');
  for (const failure of failures) {
    console.error(`- ${failure.name} failed with exit code ${failure.status}`);
  }
  process.exit(1);
}

console.log('\n\nAll requested test groups passed.');
