import { expect, it } from 'vitest';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import { AgentTransaction } from '../src/agent/transaction';
import { CommandSystem } from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { loadProject, saveProject } from '../src/core/project-io';
import { compileGraph } from '../src/core/compositing-compiler';
function setup() {
  const base = createDefaultProject(),
    layer = createLayer('rectangle');
  const host = new CommandSystem({
    ...base,
    compositions: [{ ...base.compositions[0]!, layers: [layer] }],
  });
  const registry = registerCompositingTools(new AgentToolRegistry());
  const initial = host.getSnapshot(),
    draft = new AgentTransaction(host, registry, initial, {
      selection: [layer.id],
      time: 0,
    });
  return {
    host,
    registry,
    initial,
    draft,
    layer,
    signal: new AbortController().signal,
  };
}
it('graph blur and editable mask compile, persist and Undo in a single transaction', async () => {
  const s = setup(),
    nodeId = crypto.randomUUID(),
    maskId = crypto.randomUUID();
  await s.draft.execute(
    'createNode',
    { layerId: s.layer.id, type: 'gaussianBlur', nodeId },
    s.signal,
  );
  await s.draft.execute(
    'setNodeParameter',
    { nodeId, key: 'radius', value: 12 },
    s.signal,
  );
  await s.draft.execute(
    'createMask',
    { layerId: s.layer.id, maskId, kind: 'ellipse' },
    s.signal,
  );
  await s.draft.execute(
    'setMaskMode',
    { layerId: s.layer.id, maskId, mode: 'subtract' },
    s.signal,
  );
  await s.draft.execute(
    'setMaskFeather',
    { layerId: s.layer.id, maskId, value: 20 },
    s.signal,
  );
  await s.draft.execute(
    'setMaskExpansion',
    { layerId: s.layer.id, maskId, value: 8 },
    s.signal,
  );
  const layer = s.draft.getSnapshot().compositions[0]!.layers[0]!;
  expect(compileGraph(layer.editor!.graph!).valid).toBe(true);
  expect(layer.editor!.masks[0]).toMatchObject({
    mode: 'subtract',
    feather: { baseValue: 20 },
    expansion: { baseValue: 8 },
  });
  expect(s.host.getSnapshot()).toBe(s.initial);
  s.draft.commit('blur and mask');
  expect(s.host.undoStack).toHaveLength(1);
  expect(loadProject(saveProject(s.host.getSnapshot()))).toEqual(
    s.host.getSnapshot(),
  );
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(s.initial);
});
it('graph cycles, unknown disk assets and destructive node deletion are refused', async () => {
  const s = setup(),
    graph = s.layer.editor!.graph!;
  await expect(
    s.draft.execute(
      'connectNodes',
      {
        from: { nodeId: graph.outputNodeId, portId: 'out' },
        to: { nodeId: graph.nodes[0]!.id, portId: 'in' },
      },
      s.signal,
    ),
  ).rejects.toThrow();
  await expect(
    s.draft.execute(
      'createLayerFromAsset',
      { assetId: crypto.randomUUID() },
      s.signal,
    ),
  ).rejects.toThrow('已导入');
  await expect(
    s.draft.execute('deleteNode', { nodeId: graph.nodes[0]!.id }, s.signal),
  ).rejects.toThrow('确认');
  expect(s.host.getSnapshot()).toBe(s.initial);
});
it('new composition uses shared commands and opens before creating content', async () => {
  const s = setup(),
    compositionId = crypto.randomUUID();
  await s.draft.execute(
    'createComposition',
    {
      compositionId,
      name: 'Agent Comp',
      width: 800,
      height: 600,
      fps: 24,
      duration: 2,
    },
    s.signal,
  );
  await s.draft.execute('openComposition', { compositionId }, s.signal);
  await s.draft.execute('setFPS', { compositionId, value: 60 }, s.signal);
  s.draft.commit('composition');
  expect(s.host.getSnapshot().activeCompositionId).toBe(compositionId);
  expect(s.host.getSnapshot().compositions[1]!.fps).toBe(60);
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(s.initial);
});
