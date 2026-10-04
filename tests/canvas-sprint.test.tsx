// @vitest-environment jsdom
import { expect, it, vi, beforeAll, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup() {
  const p = createDefaultProject(),
    layer = createLayer('rectangle', {
      position: { x: 400, y: 200 },
      width: 100,
      height: 100,
    });
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers: [layer] })),
  });
  store.select(layer.id);
  store.setAutoKeyframes(false);
  render(<App store={store} />);
  const canvas = screen.getByTestId('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1920,
    bottom: 1080,
    width: 1920,
    height: 1080,
    toJSON: () => ({}),
  });
  return { store, layer, canvas };
}
it('画布吸附实际进入共享命令；移动时显示参考线，松手一条 Undo，Alt 临时关闭', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 200 });
  for (let i = 0; i < 100; i++)
    fireEvent.pointerMove(canvas, { clientX: 956 + i / 100, clientY: 539 });
  expect(store.getSnapshot().project).toBe(before);
  expect(screen.getByLabelText('画布吸附参考线')).toBeInTheDocument();
  fireEvent.pointerUp(canvas);
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.position
      .baseValue,
  ).toEqual({ x: 960, y: 540 });
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 957, clientY: 539, altKey: true });
  fireEvent.pointerUp(canvas);
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.position
      .baseValue,
  ).toEqual({ x: 957, y: 539 });
});
it('Shift 锁方向；窗口失焦取消连续交互与参考线，工程和历史不变', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 957, clientY: 539, shiftKey: true });
  expect(store.getSnapshot().preview?.position).toEqual({ x: 960, y: 200 });
  fireEvent.blur(window);
  fireEvent.pointerUp(canvas);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
  expect(screen.queryByLabelText('画布吸附参考线')).toBeNull();
});
it('边与角缩放使用属性 X/Y 链接，松手一次提交；取消手柄预览不改工程', () => {
  const { store, canvas, layer } = setup();
  localStorage.setItem(
    `swayframe.axis-link.${layer.transform.scale.id}`,
    'false',
  );
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 200 });
  for (let i = 1; i <= 100; i++)
    fireEvent.pointerMove(canvas, { clientX: 450 + i, clientY: 200 });
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(canvas);
  let edited = activeComposition(store.getSnapshot().project).layers[0]!;
  expect(edited.transform.scale.baseValue).toEqual({ x: 2, y: 1 });
  expect(edited.transform.position.baseValue).toEqual({ x: 450, y: 200 });
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  localStorage.removeItem(`swayframe.axis-link.${layer.transform.scale.id}`);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 250 });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 300 });
  fireEvent.pointerUp(canvas);
  edited = activeComposition(store.getSnapshot().project).layers[0]!;
  expect(edited.transform.scale.baseValue).toEqual({ x: 1.5, y: 1.5 });
  act(() => store.undo());
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 250 });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 300 });
  fireEvent.keyDown(canvas, { key: 'Escape' });
  fireEvent.pointerUp(canvas);
  expect(store.getSnapshot().project).toEqual(before);
  expect(store.commands.undoStack).toHaveLength(0);
});

it('快速手柄拖动在同一事件批次松手也提交最后坐标，而非初始预览', () => {
  const { store, canvas } = setup();
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 250 });
  act(() => {
    fireEvent.pointerMove(canvas, { clientX: 500, clientY: 300 });
    fireEvent.pointerUp(canvas);
  });
  const edited = activeComposition(store.getSnapshot().project).layers[0]!;
  expect(edited.transform.scale.baseValue).toEqual({ x: 1.5, y: 1.5 });
  expect(store.commands.undoStack).toHaveLength(1);
});
