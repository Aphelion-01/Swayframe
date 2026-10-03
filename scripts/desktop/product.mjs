import { build } from 'esbuild';
import fs from 'node:fs/promises';
const bundle = await build({
  entryPoints: ['src/desktop/product.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { ProductMetadata } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(bundle.outputFiles[0].text).toString('base64')
);
await fs.mkdir('build', { recursive: true });
await fs.writeFile(
  'build/product.json',
  JSON.stringify(ProductMetadata, null, 2) + '\n',
);
