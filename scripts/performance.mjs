import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
const temporary = await mkdtemp(join(tmpdir(), 'swayframe-benchmark-'));
const bundle = join(temporary, 'core.mjs');
await build({
  stdin: {
    contents: `export * from './src/core/project-model'; export * from './src/core/renderer-core'; export * from './src/core/command-system'; export * from './src/core/core-types';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundle,
});
const {
  createDefaultProject,
  createLayer,
  newId,
  CommandSystem,
  createRenderSnapshot,
} = await import(pathToFileURL(bundle).href);
const results = [];
for (const parented of [false, true]) {
  const p = createDefaultProject();
  const layers = Array.from({ length: 500 }, (_, i) =>
    createLayer(i === 0 && parented ? 'null' : 'rectangle', {
      position: { x: (i % 25) * 24, y: Math.floor(i / 25) * 24 },
    }),
  );
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    layers[i] = {
      ...layer,
      editor: {
        ...layer.editor,
        parentId: parented && i > 0 ? layers[0].id : null,
      },
      transform: {
        ...layer.transform,
        position: {
          ...layer.transform.position,
          keyframes: Array.from({ length: 100 }, (_, k) => ({
            id: newId(),
            time: k / 30,
            value: {
              x: layer.transform.position.baseValue.x + k,
              y: layer.transform.position.baseValue.y,
            },
            interpolation: { type: 'linear' },
          })),
        },
      },
    };
  }
  const project = new CommandSystem({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers })),
  }).getSnapshot();
  const c = project.compositions[0];
  const durations = [];
  let checksum = 0;
  for (let trial = 0; trial < 6; trial++) {
    const start = performance.now();
    let sum = 0;
    for (let frame = 0; frame < 120; frame++) {
      const snapshot = createRenderSnapshot(
        c,
        frame / 30,
        [],
        undefined,
        project,
      );
      sum += snapshot.layers.reduce(
        (n, l) => n + l.position.x + l.position.y,
        0,
      );
    }
    const ms = performance.now() - start;
    if (trial) durations.push(ms);
    checksum = sum;
  }
  durations.sort((a, b) => a - b);
  results.push({
    scenario: parented
      ? '500 parented animated layers'
      : '500 flat animated layers',
    layers: 500,
    keyframes: 50000,
    frames: 120,
    medianMs: durations[2],
    msPerFrame: durations[2] / 120,
    checksum,
  });
}
const output = resolve(
  process.argv[2] ?? 'outputs/performance/frame-snapshots.json',
);
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      runtime: process.version,
      kind: 'CPU frame evaluation only; excludes Canvas, React and export',
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(results));
