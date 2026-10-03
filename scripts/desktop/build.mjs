import './product.mjs';
import { build } from 'esbuild';
await build({
  entryPoints: [
    'apps/desktop/electron/main.ts',
    'apps/desktop/electron/preload.ts',
    'apps/desktop/electron/export-worker.ts',
  ],
  outdir: 'desktop-dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  target: 'node22',
  sourcemap: true,
});
