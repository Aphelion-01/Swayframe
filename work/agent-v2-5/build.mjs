import { build } from 'esbuild';
import fs from 'node:fs/promises';
await build({
  entryPoints: ['work/agent-v2-5/main.ts'],
  outfile: 'work/agent-v2-5/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
await build({
  entryPoints: ['work/agent-v2-5/renderer.ts'],
  outfile: 'work/agent-v2-5/renderer.js',
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  plugins: [
    {
      name: 'raw-text',
      setup(b) {
        b.onResolve({ filter: /\?raw$/ }, (args) => ({
          path: new URL(
            args.path.replace(/\?raw$/, ''),
            'file://' + args.resolveDir + '/',
          ).pathname,
          namespace: 'raw-text',
        }));
        b.onLoad({ filter: /.*/, namespace: 'raw-text' }, async (args) => ({
          contents:
            'export default ' +
            JSON.stringify(await fs.readFile(args.path, 'utf8')),
          loader: 'js',
        }));
      },
    },
  ],
});
await build({
  entryPoints: ['work/agent-v2-5/ui-renderer.tsx'],
  outfile: 'work/agent-v2-5/ui-renderer.js',
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
});
