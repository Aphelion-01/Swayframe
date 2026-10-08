import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const temporary = await mkdtemp(join(tmpdir(), 'swayframe-effect-perf-'));
try {
  const outfile = join(temporary, 'runtime.mjs');
  await build({
    stdin: {
      contents: `export { compileEffect } from './src/core/programmable-effect';
export { organicTexturePackage } from './src/core/effect-examples';
export { referencePixels } from './tests/helpers/reference-pixel-runtime';`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  const { compileEffect, organicTexturePackage, referencePixels } =
    await import(pathToFileURL(outfile).href);
  const pkg = organicTexturePackage(),
    compiled = compileEffect(pkg),
    results = [];
  const renderers = {
    reference: (ctx) => referencePixels(pkg, {}, ctx),
    optimized: (ctx) => compiled.render({}, ctx),
  };
  for (const render of Object.values(renderers))
    render({ width: 192, height: 108, time: 0.75, frame: 18 });
  for (const [width, height] of [
    [192, 108],
    [1280, 720],
    [1920, 1080],
  ]) {
    const result = { width, height };
    for (const [name, render] of Object.entries(renderers)) {
      const samples = [];
      let hash = '';
      for (let i = 0; i < 3; i++) {
        const start = performance.now(),
          pixels = render({ width, height, time: 0.75, frame: 18 });
        samples.push(performance.now() - start);
        hash = createHash('sha256').update(pixels).digest('hex');
      }
      result[name] = {
        samples,
        median: [...samples].sort((a, b) => a - b)[1],
        hash,
      };
    }
    result.pixelsEqual = result.reference.hash === result.optimized.hash;
    result.speedup = result.reference.median / result.optimized.median;
    results.push(result);
  }
  const report = {
    node: process.version,
    results,
    pass: results.every((r) => r.pixelsEqual),
  };
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[2]) await writeFile(process.argv[2], output);
  console.log(output);
  if (!report.pass) process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
