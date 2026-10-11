import { expect, it } from 'vitest';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { registerCoreWriteTools } from '../src/agent/write-tools';
import { AgentTransaction } from '../src/agent/transaction';
import { CommandSystem, command } from '../src/core/command-system';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { pathSvg } from '../src/core/shape-geometry';
import { saveProject, loadProject } from '../src/core/project-io';
const registry = registerCoreWriteTools(new AgentToolRegistry());
const signal = new AbortController().signal;
it('fills an editable perspective polygon through the native radial fill, persists parameters and atomic Undo', async () => {
  const host = new CommandSystem(createDefaultProject()),
    base = host.getSnapshot();
  const tx = new AgentTransaction(host, registry, base, {
    time: 0,
    selection: [],
  });
  const points = [
    -100, -80, -100, -80, -100, -80, 100, -60, 100, -60, 100, -60, 90, 80, 90,
    80, 90, 80, -100, 60, -100, 60, -100, 60,
  ];
  await tx.execute(
    'createPath',
    {
      layerId: '00000000-0000-4000-8000-000000000001',
      width: 200,
      height: 160,
      position: { x: 205, y: 115 },
      points,
    },
    signal,
  );
  await tx.execute(
    'setFill',
    {
      layerId: '00000000-0000-4000-8000-000000000001',
      color: { r: 0, g: 0.6, b: 0.6, a: 1 },
      gradient: 'radial',
      radialParameters: {
        center: { x: 0.25, y: 0.3 },
        radius: 0.8,
        stops: [0, 0.1, 0.8, 0.8, 1, 1, 0, 0.1, 0.1, 1],
      },
    },
    signal,
  );
  tx.commit('渐变路径');
  const layer = activeComposition(host.getSnapshot()).layers[0]!;
  expect(layer.editor?.gradient).toBe('radial');
  expect(layer.editor?.properties.radial_radius?.baseValue).toBe(0.8);
  expect(layer.editor?.properties.radial_center?.baseValue).toEqual({
    x: 0.25,
    y: 0.3,
  });
  expect(layer.editor?.properties.path?.baseValue).toEqual(points);
  expect(
    layer.editor?.graph?.nodes.some((n) => n.type === 'radialGradient'),
  ).toBe(false);
  expect(loadProject(saveProject(host.getSnapshot()))).toEqual(
    host.getSnapshot(),
  );
  host.undo();
  expect(host.getSnapshot()).toEqual(base);
  host.redo();
  expect(activeComposition(host.getSnapshot()).layers[0]).toEqual(layer);
  expect(pathSvg(points, true)).toContain('C -100 -80 100 -60 100 -60');
});
it('rejects unsupported radial parameters before any host mutation', async () => {
  const host = new CommandSystem(createDefaultProject());
  const tx = new AgentTransaction(host, registry, host.getSnapshot(), {
    time: 0,
    selection: [],
  });
  await tx.execute(
    'createRectangle',
    { layerId: '00000000-0000-4000-8000-000000000001' },
    signal,
  );
  const before = tx.getSnapshot();
  await expect(
    tx.execute(
      'setFill',
      {
        layerId: '00000000-0000-4000-8000-000000000001',
        color: { r: 0, g: 1, b: 1, a: 1 },
        gradient: 'radial',
        radialParameters: { radius: -1 },
      },
      signal,
    ),
  ).rejects.toThrow('radius');
  expect(tx.getSnapshot()).toBe(before);
  await expect(
    tx.execute(
      'setFill',
      {
        layerId: '00000000-0000-4000-8000-000000000001',
        color: { r: 0, g: 1, b: 1, a: 1 },
        gradient: 'radial',
        radialParameters: { unknown: 1 },
      },
      signal,
    ),
  ).rejects.toThrow('未知径向渐变参数');
  expect(host.undoStack).toHaveLength(0);
});
it('postflight rejects incorrect position and graph parameters even when the layer exists', async () => {
  const host = new CommandSystem(createDefaultProject());
  const tx = new AgentTransaction(host, registry, host.getSnapshot(), {
    time: 0,
    selection: [],
  });
  await tx.execute(
    'createText',
    {
      layerId: '00000000-0000-4000-8000-000000000002',
      content: 'Cubic',
      position: { x: 205, y: 115 },
    },
    signal,
  );
  const project = tx.getSnapshot(),
    layer = activeComposition(project).layers[0]!;
  expect(() =>
    registry.verifyResults(
      [
        command({
          type: 'layer.create',
          compositionId: project.activeCompositionId,
          layer: {
            ...layer,
            transform: {
              ...layer.transform,
              position: {
                ...layer.transform.position,
                baseValue: { x: 1, y: 2 },
              },
            },
          },
        }),
      ],
      project,
    ),
  ).toThrow('位置');
  const graph = layer.editor!.graph!;
  expect(() =>
    registry.verifyResults(
      [
        command({
          type: 'graph.replace',
          compositionId: project.activeCompositionId,
          layerId: layer.id,
          graph: { ...graph, nodes: [] },
        }),
      ],
      project,
    ),
  ).toThrow('节点');
});
