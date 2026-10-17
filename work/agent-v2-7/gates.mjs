import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const phase = process.argv[2];
if (!/^phase(?:[0-9]|10)$/.test(phase ?? '')) throw Error('phase0..phase10 required');
const out = `outputs/agent-v2-7/quality/${phase}`;
fs.mkdirSync(out, { recursive: true });
const results = [];
for (const [name, args] of [
  ['typecheck', ['run', 'typecheck']],
  ['lint', ['run', 'lint']],
  ['tests', ['run', 'test', '--', '--reporter=default', '--reporter=json', `--outputFile=${out}/tests.json`]],
  ['build', ['run', 'build']],
  ['desktop-build', ['run', 'desktop:build']],
]) {
  const run = spawnSync('npm', args, { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 });
  fs.writeFileSync(`${out}/${name}.log`, ((run.stdout ?? '') + (run.stderr ?? '')).trimEnd() + '\n');
  results.push({ name, exitCode: run.status });
  console.log(phase, name, run.status);
  fs.writeFileSync(`${out}/result.json`, JSON.stringify(results, null, 2) + '\n');
  // Preserve inherited historical evidence; retain newly generated output separately.
  const changed = spawnSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).stdout.split('\n');
  for (const file of changed.filter((f) => f.startsWith('outputs/') && !f.startsWith('outputs/agent-v2-7/'))) {
    const original = spawnSync('git', ['show', '469470d:' + file]);
    if (original.status !== 0) throw Error('Unexpected inherited evidence path ' + file);
    const saved = `${out}/generated/${file}`;
    fs.mkdirSync(saved.slice(0, saved.lastIndexOf('/')), { recursive: true });
    fs.copyFileSync(file, saved);
    fs.writeFileSync(file, original.stdout);
  }
  if (run.status !== 0) process.exit(1);
}
