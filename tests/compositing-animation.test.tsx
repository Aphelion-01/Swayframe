// @vitest-environment jsdom
import { openTimelineLayers } from './timeline-test-helpers';
import { expect, it, beforeAll, afterEach, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createLayer,
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { insertGraphNode } from '../src/core/compositing-operations';
import { evaluateProperty } from '../src/core/animation-engine';
import { saveProject, loadProject } from '../src/core/project-io';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('节点 Inspector 开启半径动画 0→30，同一轨道/曲线属性，保存恢复且 Undo 有效', () => {
  const p = createDefaultProject(),
    l = createLayer('solid'),
    { graph, node } = insertGraphNode(l.editor!.graph!, 'gaussianBlur');
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({
      ...c,
      layers: [{ ...l, editor: { ...l.editor!, graph } }],
    })),
  });
  store.select(l.id);
  store.selectGraphNodes(l.id, [node.id]);
  render(<App store={store} />);
  openTimelineLayers();
  expect(screen.getByLabelText('节点属性面板')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '开启半径动画' }));
  act(() => store.setTime(1));
  fireEvent.change(screen.getByLabelText('半径'), { target: { value: '30' } });
  fireEvent.blur(screen.getByLabelText('半径'));
  const radius = activeComposition(
    store.getSnapshot().project,
  ).layers[0]!.editor!.graph!.nodes.find((n) => n.id === node.id)!.params
    .radius!;
  expect(radius.keyframes.map((k) => [k.time, k.value])).toEqual([
    [0, 0],
    [1, 30],
  ]);
  expect(evaluateProperty(radius, 0.5)).toBe(15);
  expect(
    screen.getByLabelText('纯色 高斯模糊 · 半径 轨道'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  expect(screen.getByRole('option', { name: '高斯模糊 · 半径' })).toHaveValue(
    radius.id,
  );
  expect(loadProject(saveProject(store.getSnapshot().project))).toEqual(
    store.getSnapshot().project,
  );
  act(() => store.undo());
  expect(
    activeComposition(
      store.getSnapshot().project,
    ).layers[0]?.editor?.graph?.nodes.find((n) => n.id === node.id)?.params
      .radius?.keyframes,
  ).toHaveLength(1);
});
