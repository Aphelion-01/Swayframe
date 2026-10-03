// @vitest-environment jsdom
import { expect, it, beforeAll, afterEach, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CompositingGraphPanel } from '../src/ui/CompositingGraph';
import {
  createLayer,
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { EditorStore } from '../src/ui/editor-store';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup() {
  const p = createDefaultProject(),
    l = createLayer('solid'),
    s = new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, layers: [l] })),
    });
  s.select(l.id);
  const result = render(<CompositingGraphPanel store={s} />);
  return { s, l, ...result };
}
function add() {
  fireEvent.click(screen.getByRole('button', { name: '＋ 添加节点' }));
  fireEvent.change(screen.getByRole('textbox', { name: '搜索节点类型' }), {
    target: { value: '曝光' },
  });
  fireEvent.keyDown(screen.getByRole('textbox', { name: '搜索节点类型' }), {
    key: 'Enter',
  });
}
it('搜索插入、拖动 50 次一个 Undo；Escape/平移/缩放不修改工程', () => {
  const { s, container } = setup();
  add();
  expect(s.commands.undoStack).toHaveLength(1);
  const graph = activeComposition(s.getSnapshot().project).layers[0]!.editor!
      .graph!,
    node = graph.nodes.find((n) => n.type === 'exposure')!;
  const card = container.querySelector(`[data-cg-node="${node.id}"]`)!,
    viewport = screen.getByLabelText('节点画布');
  const before = s.getSnapshot().project;
  fireEvent.pointerDown(card, { button: 0, clientX: 100, clientY: 100 });
  for (let i = 1; i <= 50; i++)
    fireEvent.pointerMove(viewport, { clientX: 100 + i * 8, clientY: 100 });
  expect(s.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(viewport, { clientX: 500, clientY: 100 });
  expect(s.commands.undoStack).toHaveLength(2);
  expect(
    activeComposition(
      s.getSnapshot().project,
    ).layers[0]?.editor?.graph?.nodes.find((n) => n.id === node.id)?.position.x,
  ).toBe(node.position.x + 500);
  act(() => s.undo());
  expect(s.getSnapshot().project).toEqual(before);
  fireEvent.pointerDown(card, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(viewport, { clientX: 300, clientY: 100 });
  act(() => window.dispatchEvent(new Event('motion:cancel')));
  fireEvent.pointerUp(viewport, { clientX: 300, clientY: 100 });
  expect(s.commands.undoStack).toHaveLength(1);
  fireEvent.keyDown(viewport, { key: ' ', code: 'Space' });
  fireEvent.pointerDown(viewport, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(viewport, { clientX: 50, clientY: 50 });
  fireEvent.pointerUp(viewport);
  fireEvent.wheel(viewport, { deltaY: -100, clientX: 50, clientY: 50 });
  fireEvent.keyDown(viewport, { key: 'Home' });
  expect(s.getSnapshot().project).toEqual(before);
});
it('端口自连原子拒绝；复制/删除节点与固定节点保护', () => {
  const { s } = setup();
  add();
  const before = s.getSnapshot().project;
  fireEvent.pointerDown(
    screen.getByRole('button', { name: '曝光 输出 图像' }),
    { button: 0, clientX: 100, clientY: 100 },
  );
  fireEvent.pointerUp(screen.getByRole('button', { name: '曝光 输入 图像' }), {
    clientX: 200,
    clientY: 100,
  });
  expect(s.getSnapshot().project).toBe(before);
  expect(s.getSnapshot().status).toContain('自连接');
  const viewport = screen.getByLabelText('节点画布');
  fireEvent.keyDown(viewport, { key: 'd', metaKey: true });
  expect(
    activeComposition(s.getSnapshot().project).layers[0]?.editor?.graph?.nodes,
  ).toHaveLength(4);
  fireEvent.keyDown(viewport, { key: 'Delete' });
  expect(
    activeComposition(s.getSnapshot().project).layers[0]?.editor?.graph?.nodes,
  ).toHaveLength(3);
  const source = screen.getByText('源图像');
  fireEvent.click(source);
  fireEvent.keyDown(viewport, { key: 'Delete' });
  expect(
    activeComposition(s.getSnapshot().project).layers[0]?.editor?.graph?.nodes,
  ).toHaveLength(3);
});
