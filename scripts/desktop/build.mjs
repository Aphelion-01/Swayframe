import { execFileSync } from 'node:child_process';
import './product.mjs';
import { build } from 'esbuild';
await build({
  entryPoints: [
    'apps/desktop/electron/main.ts',
    'apps/desktop/electron/preload.ts',
    'apps/desktop/electron/export-worker.ts',
    'apps/desktop/electron/mcp-server.ts',
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

if (process.platform === 'darwin') {
  execFileSync(
    'xcrun',
    [
      'swiftc',
      '-O',
      '-target',
      'arm64-apple-macos14.0',
      '-module-cache-path',
      '/private/tmp/sf-swift-module-cache',
      'apps/desktop/native/segment-image.swift',
      '-o',
      'desktop-dist/sf-segment-image',
    ],
    { stdio: 'inherit' },
  );
}
