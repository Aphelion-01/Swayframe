import { build } from 'esbuild';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const temporary = await mkdtemp(join(tmpdir(), 'swayframe-sprint-'));
const bundle = join(temporary, 'core.mjs');
await build({
  stdin: {
    contents: `export * from './src/core/project-io'; export * from './src/core/command-system'; export * from './src/core/core-types';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundle,
});
const { loadProject, saveProject, CommandSystem, command, transaction, newId } =
  await import(pathToFileURL(bundle).href);
const project = loadProject(
  await readFile('outputs/examples/MotionEditor_CASE01_11.motion.json', 'utf8'),
);
const layer = project.compositions[0].layers.find((l) => l.name === '图片遮罩');
const blur = layer.editor.graph.nodes.find((n) => n.type === 'gaussianBlur');
const text = project.compositions[0].layers.find((l) => l.type === 'text');
const system = new CommandSystem(project);
const commands = [
  command({
    type: 'layer.patch',
    compositionId: project.compositions[0].id,
    layerId: text.id,
    patch: { text: 'Swayframe\n完整创作流程' },
  }),
];
if (blur)
  for (const [time, value] of [
    [0, 0],
    [1, 12],
  ])
    commands.push(
      command({
        type: 'keyframe.add',
        propertyId: blur.params.radius.id,
        keyframe: {
          id: newId(),
          time,
          value,
          interpolation: {
            type: 'bezier',
            out: { x: 0.42, y: 0 },
            in: { x: 0.58, y: 1 },
          },
        },
      }),
    );
const result = system.executeTransaction(
  transaction('完整创作验收', 'system', commands),
);
if (!result.ok) throw new Error(result.error);
const saved = saveProject(system.getSnapshot());
if (saveProject(loadProject(saved)) !== saved)
  throw new Error('Round-trip changed the project');
await mkdir('outputs/sprint-v2', { recursive: true });
await writeFile('outputs/sprint-v2/full-workflow.swayframe', saved);
await writeFile(
  'outputs/sprint-v2/full-workflow-evidence.json',
  JSON.stringify(
    {
      schemaVersion: project.schemaVersion,
      compositions: project.compositions.length,
      layers: project.compositions.flatMap((c) => c.layers).length,
      assets: project.assets.length,
      masks: layer.editor.masks.length,
      graphNodes: layer.editor.graph.nodes.length,
      blurAnimation: !!blur,
      parent: project.compositions.some((c) =>
        c.layers.some((l) => l.editor.parentId),
      ),
      precomp: project.compositions[0].layers.some((l) => l.type === 'precomp'),
      planes: project.compositions[0].layers.filter((l) => l.editor.is3D)
        .length,
      camera: project.compositions[0].layers.some((l) => l.type === 'camera'),
      roundTrip: true,
    },
    null,
    2,
  ) + '\n',
);
console.log('Full workflow fixture and round-trip evidence generated');
