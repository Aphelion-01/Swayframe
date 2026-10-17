import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const phase = process.argv[2];
if (!/^phase[0-5]$/.test(phase ?? '')) throw Error('phase0..phase5 required');
const out = `outputs/agent-v2-6/quality/${phase}`;
fs.mkdirSync(out, { recursive: true });
const results = [];
for (const [name, args] of [
  ['typecheck', ['run', 'typecheck']],
  ['lint', ['run', 'lint']],
  [
    'tests',
    [
      'run',
      'test',
      '--',
      '--reporter=default',
      '--reporter=json',
      `--outputFile=${out}/tests.json`,
    ],
  ],
  ['build', ['run', 'build']],
  ['desktop-build', ['run', 'desktop:build']],
]) {
  const run = spawnSync('npm', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  fs.writeFileSync(
    `${out}/${name}.log`,
    ((run.stdout ?? '') + (run.stderr ?? '')).trimEnd() + '\n',
  );
  results.push({ name, exitCode: run.status });
  console.log(phase, name, run.status);
  fs.writeFileSync(
    `${out}/result.json`,
    JSON.stringify(results, null, 2) + '\n',
  );
  if (run.status !== 0) process.exit(1);
}
const performance = 'outputs/timeline-ux/performance.json';
if (fs.existsSync(performance)) {
  fs.copyFileSync(performance, `${out}/timeline-performance.json`);
  const base = spawnSync('git', ['show', `HEAD:${performance}`]);
  if (base.status === 0) fs.writeFileSync(performance, base.stdout);
}
