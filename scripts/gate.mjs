import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const stage = process.argv[2];
if (
  !/^(?:T(?:[0-9]|10)|Phase_[A-I]|M(?:[1-9]|10)|D(?:[0-9]|10)|UX-(?:[1-9]|10)|CG-(?:[0-9]|1[0-2])|V2-[1-9][0-9]*|OP-[1-9][0-9]*|UI-[1-9][0-9]*)$/.test(
    stage ?? '',
  )
)
  throw new Error(
    'Provide stage T0..T10, Phase_A..Phase_I, M1..M10, D0..D10, UX-1..UX-10, CG-0..CG-12 V2-1..N OP-1..N or UI-1..N',
  );
mkdirSync('outputs/quality', { recursive: true });
let log = `Stage ${stage}\nStarted: ${new Date().toISOString()}\n`;
for (const args of [
  ['run', 'typecheck'],
  ['run', 'lint'],
  ['test'],
  ['run', 'build'],
  ...((stage.startsWith('D') && stage !== 'D0') ||
  stage.startsWith('CG-') ||
  stage.startsWith('V2-') ||
  stage.startsWith('OP-') ||
  stage.startsWith('UI-')
    ? [['run', 'desktop:build']]
    : []),
]) {
  const result = spawnSync('npm', args, { encoding: 'utf8' });
  log += `\n$ npm ${args.join(' ')}\n${result.stdout}${result.stderr}\nExit: ${result.status}\n`;
  writeFileSync(`outputs/quality/${stage}.log`, log);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) process.exit(result.status ?? 1);
}
log += `\nPASS: typecheck / lint / unit + integration tests / Web build${(stage.startsWith('D') && stage !== 'D0') || stage.startsWith('CG-') || stage.startsWith('V2-') || stage.startsWith('OP-') || stage.startsWith('UI-') ? ' / desktop build' : ''}\n`;
writeFileSync(`outputs/quality/${stage}.log`, log);
