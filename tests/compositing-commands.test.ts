import { expect, it } from 'vitest';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import { createGraph } from '../src/core/compositing-registry';
import { graphCommand } from '../src/core/compositing-commands';
import {
  insertGraphNode,
  patchGraphNode,
  deleteGraphNodes,
  duplicateGraphNodes,
} from '../src/core/compositing-operations';
it('插入、重连、删除、复制与连续坐标编辑共用事务，单次撤销恢复', () => {
  const p = createDefaultProject(),
    l = createLayer('solid'),
    g = createGraph(l.id),
    s = new CommandSystem({
      ...p,
      compositions: p.compositions.map((c) => ({
        ...c,
        layers: [{ ...l, editor: { ...l.editor!, graph: g } }],
      })),
    });
  const before = s.getSnapshot(),
    insert = insertGraphNode(g, 'gaussianBlur');
  expect(
    s.executeTransaction(
      transaction('插入节点', 'human', [
        graphCommand(before, l.id, insert.graph),
      ]),
    ).ok,
  ).toBe(true);
  expect(s.undoStack).toHaveLength(1);
  s.undo();
  expect(s.getSnapshot()).toEqual(before);
  s.redo();
  let preview = insert.graph;
  for (let i = 0; i < 50; i++)
    preview = patchGraphNode(preview, insert.node.id, {
      position: { x: i * 10, y: 50 },
    });
  expect(
    s.executeTransaction(
      transaction('移动', 'human', [
        graphCommand(s.getSnapshot(), l.id, preview),
      ]),
    ).ok,
  ).toBe(true);
  expect(s.undoStack).toHaveLength(2);
  s.undo();
  expect(deleteGraphNodes(insert.graph, [insert.node.id]).nodes).toHaveLength(
    2,
  );
  expect(() => deleteGraphNodes(g, [g.outputNodeId])).toThrow('不可');
  const copy = duplicateGraphNodes(insert.graph, [insert.node.id]);
  expect(copy.graph.nodes).toHaveLength(4);
  expect(copy.graph.nodes.at(-1)?.params.radius?.id).not.toBe(
    insert.node.params.radius?.id,
  );
  const snap = s.getSnapshot();
  expect(
    s.executeTransaction(
      transaction('非法半径', 'agent', [
        command({
          type: 'property.setBase',
          propertyId: insert.node.params.radius!.id,
          value: -1,
        }),
      ]),
    ).ok,
  ).toBe(false);
  expect(s.getSnapshot()).toBe(snap);
});
