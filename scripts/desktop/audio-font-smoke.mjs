import { build } from 'esbuild';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import electron from 'electron';
// Run after npm run desktop:build. Optional SF_AUDIO_FILES_JSON supplies local test files.
await fs.mkdir('outputs/audio-font-029', { recursive: true });
await fs.mkdir('work/audio-font-029', { recursive: true });
await build({
  entryPoints: ['scripts/desktop/audio-font-smoke-renderer.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  define: { 'import.meta': '{}' },
  outfile: 'work/audio-font-029/renderer.js',
});
await build({
  entryPoints: ['scripts/desktop/audio-font-smoke.ts'],
  bundle: true,
  platform: 'node',
  external: ['electron'],
  outfile: 'work/audio-font-029/integration.cjs',
});
const code = await new Promise((resolve, reject) => {
  const child = spawn(electron, ['work/audio-font-029/integration.cjs'], {
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('exit', resolve);
});
process.exitCode = code === 0 ? 0 : 1;
