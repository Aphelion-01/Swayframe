import { build } from 'esbuild';
import fs from 'node:fs/promises';
await build({
  entryPoints: ['work/agent-v2-6/main.ts'],
  outfile: 'work/agent-v2-6/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
await build({
  entryPoints: ['work/agent-v2-6/renderer.ts'],
  outfile: 'work/agent-v2-6/renderer.js',
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  plugins: [
    {
      name: 'raw',
      setup(b) {
        b.onResolve({ filter: /\?raw$/ }, (a) => ({
          path: new URL(
            a.path.replace(/\?raw$/, ''),
            'file://' + a.resolveDir + '/',
          ).pathname,
          namespace: 'raw',
        }));
        b.onLoad({ filter: /.*/, namespace: 'raw' }, async (a) => ({
          contents:
            'export default ' +
            JSON.stringify(await fs.readFile(a.path, 'utf8')),
          loader: 'js',
        }));
      },
    },
  ],
});
await build({
  entryPoints: ['work/agent-v2-6/ui-renderer.tsx'],
  outfile: 'work/agent-v2-6/ui-renderer.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
});
