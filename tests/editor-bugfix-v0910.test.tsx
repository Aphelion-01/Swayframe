// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
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
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { pathSvg } from '../src/core/shape-geometry';
import { saveProject, loadProject } from '../src/core/project-io';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  Element.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}
function setup() {
  const p = createDefaultProject(),
    layers = [createLayer('rectangle'), createLayer('ellipse')];
  const store = new EditorStore({
    ...p,
    compositions: [{ ...p.compositions[0]!, layers }],
  });
  render(<App store={store} />);
  const canvas = screen.getByTestId('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    rect(0, 0, 1920, 1080),
  );
  return { store, canvas, layers };
}
it('continuous creation over existing layers keeps the creation tool and distinct outline', () => {
  const { store, canvas } = setup();
  fireEvent.click(screen.getByRole('button', { name: '矩形工具' }));
  for (let i = 0; i < 3; i++) {
    fireEvent.pointerDown(canvas, { button: 0, clientX: 900, clientY: 500 });
    fireEvent.pointerMove(canvas, { clientX: 1000 + i * 20, clientY: 600 });
    expect(document.querySelector('.creation-preview')).not.toBeNull();
    fireEvent.pointerUp(canvas);
    expect(screen.getByRole('button', { name: '矩形工具' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(5);
  expect(store.commands.undoStack).toHaveLength(3);
  fireEvent.dblClick(canvas, { clientX: 950, clientY: 540 });
  expect(screen.getByRole('button', { name: '矩形工具' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
it('pen drag creates symmetric Bezier handles without a selection rectangle; fill and stroke persist and undo', () => {
  const { store, canvas } = setup(),
    before = store.getSnapshot().project;
  fireEvent.click(screen.getByRole('button', { name: '钢笔工具' }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { clientX: 150, clientY: 60 });
  expect(document.querySelector('.draw-preview')).toBeNull();
  fireEvent.pointerUp(canvas);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 300, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 350, clientY: 240 });
  fireEvent.pointerUp(canvas);
  fireEvent.keyDown(screen.getByRole('region', { name: '画布区域' }), {
    key: 'Enter',
  });
  const layer = activeComposition(store.getSnapshot().project).layers.at(-1)!;
  const path = layer.editor!.properties.path!.baseValue as readonly number[];
  expect(path).toHaveLength(12);
  expect(path[4]! - path[0]!).toBe(50);
  expect(path[3]! - path[1]!).toBe(40);
  expect(pathSvg(path, false)).toContain(' C ');
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  act(() => {
    store.redo();
    store.select(layer.id);
  });
  const alpha = screen.getByLabelText('路径填充 透明度（%）');
  fireEvent.change(alpha, { target: { value: '0' } });
  fireEvent.blur(alpha);
  fireEvent.change(screen.getByLabelText('描边宽度'), {
    target: { value: '8' },
  });
  fireEvent.blur(screen.getByLabelText('描边宽度'));
  const reopened = loadProject(saveProject(store.getSnapshot().project));
  expect(
    reopened.compositions[0]!.layers.at(-1)!.editor!.properties.fill!.baseValue,
  ).toEqual([0.18, 0.42, 1, 0]);
  expect(
    reopened.compositions[0]!.layers.at(-1)!.editor!.properties.strokeWidth!
      .baseValue,
  ).toBe(8);
});
for (const surface of ['.layer-list', '.timeline-scroll'])
  it(`${surface} boxes multiple layers without Scene or history writes`, () => {
    const { store, layers } = setup(),
      before = store.getSnapshot().project;
    const root = document.querySelector(surface)!;
    const rows = [...root.querySelectorAll<HTMLElement>('[data-layer-id]')];
    rows.forEach((row, i) =>
      vi
        .spyOn(row, 'getBoundingClientRect')
        .mockReturnValue(rect(0, 100 + i * 30, 250, 28)),
    );
    fireEvent.pointerDown(root, { button: 0, clientX: 260, clientY: 180 });
    fireEvent.pointerMove(window, { clientX: 5, clientY: 99 });
    expect(screen.getByLabelText('图层框选区域')).toBeInTheDocument();
    fireEvent.pointerUp(window, { clientX: 5, clientY: 99 });
    expect([...store.getSnapshot().selection].sort()).toEqual(
      layers.map((l) => l.id).sort(),
    );
    expect(store.getSnapshot().project).toBe(before);
    expect(store.commands.undoStack).toHaveLength(0);
  });
it('right click opens icon creation pie on layers and timeline, file menu contains only project actions', () => {
  const { store } = setup();
  fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
  expect(screen.queryByRole('button', { name: '创建 矩形' })).toBeNull();
  fireEvent.contextMenu(document.querySelector('.layer-list')!, {
    clientX: 100,
    clientY: 150,
  });
  expect(screen.getAllByRole('menuitem')).toHaveLength(10);
  for (const item of screen.getAllByRole('menuitem'))
    expect(item.querySelector('svg')).not.toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: '创建 星形' }));
  expect(
    activeComposition(store.getSnapshot().project).layers.at(-1),
  ).toMatchObject({ shapeKind: 'star' });
  act(() => store.undo());
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(2);
});
