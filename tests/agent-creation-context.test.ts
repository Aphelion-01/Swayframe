import { expect, it } from 'vitest';
import { creationGraphContext } from '../src/agent/creation-context';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { CommandSystem } from '../src/core/command-system';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { AgentTransaction } from '../src/agent/transaction';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import { newId } from '../src/core/core-types';

it('bounds planning context and prioritizes the authorized layer without changing the project', async () => {
  const project = createDefaultProject();
  const layers = Array.from({ length: 40 }, () => createLayer('rectangle'));
  const host = new CommandSystem({
    ...project,
    compositions: [{ ...project.compositions[0]!, layers }],
  });
  const nodeId = newId();
  const target = layers[39]!;
  const registry = registerCompositingTools(new AgentToolRegistry());
  const tx = new AgentTransaction(host, registry, host.getSnapshot(), {
    time: 0,
    selection: [],
  });
  await tx.execute(
    'createNode',
    { layerId: target.id, type: 'gaussianBlur', nodeId },
    new AbortController().signal,
  );
  await tx.execute(
    'setNodeParameter',
    { nodeId, key: 'radius', value: 20 },
    new AbortController().signal,
  );
  tx.commit('fixture');
  const before = JSON.stringify(host.getSnapshot());
  const summary = creationGraphContext(
    host.getSnapshot(),
    {
      kind: 'PARAMETER_ONLY',
      compositionId: project.activeCompositionId,
      layerId: target.id,
      nodeIds: [nodeId],
    },
    1000,
  );
  expect(JSON.stringify(summary).length).toBeLessThanOrEqual(1000);
  expect(summary.truncated).toBe(true);
  expect(summary.graphs[0]).toMatchObject({
    layerId: target.id,
    nodes: expect.arrayContaining([
      expect.objectContaining({
        id: nodeId,
        params: expect.objectContaining({
          radius: { baseValue: 20, keyframeCount: 0 },
        }),
      }),
    ]),
  });
  expect(JSON.stringify(host.getSnapshot())).toBe(before);
  expect(summary.inspection).toContain('inspectGraphNode');
});

it('keeps exact package references but omits package source, large arrays and keyframe lists', async () => {
  const { createGraph, createProgrammableNode } =
    await import('../src/core/compositing-registry');
  const { organicTexturePackage } = await import('../src/core/effect-examples');
  const { createProperty } = await import('../src/core/project-model');
  const project = createDefaultProject(),
    layer = createLayer('rectangle');
  const pkg = organicTexturePackage(),
    node = createProgrammableNode(pkg);
  const graph = createGraph(layer.id);
  const fixture = {
    ...project,
    compositions: [
      {
        ...project.compositions[0]!,
        layers: [
          {
            ...layer,
            editor: {
              ...layer.editor!,
              graph: {
                ...graph,
                nodes: [
                  ...graph.nodes,
                  {
                    ...node,
                    params: {
                      ...node.params,
                      large: createProperty(Array(2000).fill(0)),
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  };
  const summary = creationGraphContext(fixture);
  const encoded = JSON.stringify(summary);
  expect(encoded).toContain(pkg.contentHash);
  expect(encoded).toContain('[omitted: inspectGraphNode]');
  expect(encoded).not.toContain('instructions');
  expect(encoded).not.toContain('"keyframes"');
  expect(summary.truncated).toBe(true);
  expect(encoded.length).toBeLessThanOrEqual(16000);
});
