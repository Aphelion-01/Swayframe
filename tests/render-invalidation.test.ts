import { expect, it } from 'vitest';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { sameVisualProject } from '../src/core/render-invalidation';
import {
  insertGraphNode,
  patchGraphNode,
} from '../src/core/compositing-operations';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
it('节点布局/名称只改持久化布局；参数、连接、开关、素材和嵌套合成必须失效', () => {
  const p = createDefaultProject(),
    raw = createLayer('rectangle');
  const graph = insertGraphNode(raw.editor!.graph!, 'exposure').graph;
  const layer = { ...raw, editor: { ...raw.editor!, graph } };
  const sys = new CommandSystem({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers: [layer] })),
  });
  const before = sys.getSnapshot(),
    comp = before.compositions[0]!,
    node = graph.nodes.find((n) => n.type === 'exposure')!;
  const layout = patchGraphNode(graph, node.id, {
    position: { x: 900, y: 500 },
    name: '新名字',
  });
  expect(
    sys.executeTransaction(
      transaction('布局', 'human', [
        command({
          type: 'graph.replace',
          compositionId: comp.id,
          layerId: layer.id,
          graph: layout,
        }),
      ]),
    ).ok,
  ).toBe(true);
  const after = sys.getSnapshot();
  expect(after).not.toBe(before);
  expect(sameVisualProject(before, after)).toBe(true);
  const update = (next: typeof graph) => ({
    ...after,
    compositions: after.compositions.map((c) => ({
      ...c,
      layers: c.layers.map((l) => ({
        ...l,
        editor: { ...l.editor!, graph: next },
      })),
    })),
  });
  expect(
    sameVisualProject(
      after,
      update(patchGraphNode(layout, node.id, { enabled: false })),
    ),
  ).toBe(false);
  expect(sameVisualProject(after, update({ ...layout, edges: [] }))).toBe(
    false,
  );
  expect(
    sameVisualProject(
      after,
      update({
        ...layout,
        nodes: layout.nodes.map((n) =>
          n.id === node.id
            ? {
                ...n,
                params: {
                  ...n.params,
                  exposure: { ...n.params.exposure!, baseValue: 1 },
                },
              }
            : n,
        ),
      }),
    ),
  ).toBe(false);
  expect(
    sameVisualProject(after, {
      ...after,
      compositions: [
        ...after.compositions,
        { ...comp, id: 'nested', layers: [] },
      ],
    }),
  ).toBe(false);
  expect(
    sameVisualProject(after, {
      ...after,
      assets: [
        {
          id: 'asset',
          name: 'a',
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,AA==',
        },
      ],
    }),
  ).toBe(false);
});
