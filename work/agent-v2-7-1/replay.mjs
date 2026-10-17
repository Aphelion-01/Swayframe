import { build } from 'esbuild';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const source = resolve(process.argv[2] ?? '.');
const output = process.argv[3] ?? 'docs/qa/agent-v2-7-1/replay-fixed.json';
await build({ entryPoints: ['work/agent-v2-7-1/replay.ts'], outfile: 'work/agent-v2-7-1/replay.bundle.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { '@product': resolve(source, 'src') } });
const result = spawnSync(process.execPath, ['work/agent-v2-7-1/replay.bundle.mjs', output], { stdio: 'inherit' });
process.exit(result.status ?? 1);
