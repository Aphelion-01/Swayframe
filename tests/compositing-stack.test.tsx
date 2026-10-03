// @vitest-environment jsdom
import { expect, it, beforeAll, afterEach, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createLayer,
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import {
  insertGraphNode,
  deleteGraphNodes,
  addGraphNode,
} from '../src/core/compositing-operations';
import { graphCommand } from '../src/core/compositing-commands';
import { createNode } from '../src/core/compositing-registry';
import {
  linearGraphEffects,
  reorderGraphEffects,
} from '../src/core/compositing-migration';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('效果栈双向读取同一节点参数，删除同步；分支不能伪装为线性栈', () => {
  const p = createDefaultProject(),
    l = createLayer('solid'),
    a = insertGraphNode(l.editor!.graph!, 'exposure'),
    b = insertGraphNode(a.graph, 'gaussianBlur'),
    store = new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({
        ...c,
        layers: [{ ...l, editor: { ...l.editor!, graph: b.graph } }],
      })),
    });
  store.select(l.id);
  render(<App store={store} />);
  fireEvent.click(screen.getByText('效果与遮罩'));
  expect(screen.getByLabelText('效果2半径')).toBeDefined();
  act(() => {
    store.run('删模糊', [
      graphCommand(
        store.getSnapshot().project,
        l.id,
        deleteGraphNodes(b.graph, [b.node.id]),
      ),
    ]);
  });
  expect(screen.queryByLabelText('效果2半径')).toBeNull();
  expect(
    activeComposition(store.getSnapshot().project).layers[0]?.editor?.effects,
  ).toBeUndefined();
  const reordered = reorderGraphEffects(b.graph, [b.node.id, a.node.id]);
  expect(linearGraphEffects(reordered)?.map((e) => e.kind)).toEqual([
    'gaussianBlur',
    'exposure',
  ]);
  const advanced = addGraphNode(b.graph, createNode('solid'));
  expect(linearGraphEffects(advanced)).toBeNull();
  expect(() => reorderGraphEffects(advanced, [b.node.id, a.node.id])).toThrow(
    '高级',
  );
  act(() => {
    store.run('高级图', [
      graphCommand(store.getSnapshot().project, l.id, advanced),
    ]);
  });
  expect(screen.getByText(/高级节点图/)).toBeDefined();
  expect(screen.queryByLabelText('效果2半径')).toBeNull();
});
