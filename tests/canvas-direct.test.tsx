// @vitest-environment jsdom
import { createRenderSnapshot } from '../src/core/renderer-core';
import { it, expect, vi, beforeAll, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import type { Layer } from '../src/core/project-model';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const rect = (left = 0, top = 0, width = 1920, height = 1080) => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
});
const shape = (x = 400, y = 200) =>
  createLayer('rectangle', { position: { x, y }, width: 100, height: 100 });
function setup(layers: readonly Layer[] = [shape()]) {
  const p = createDefaultProject();
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers })),
  });
  store.setTransformSettings({
    orientation: 'global',
    pivotMode: 'selection-center',
  });
  if (layers[0]) store.select(layers[0].id);
  render(<App store={store} />);
  const canvas = screen.getByTestId('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect());
  return { store, canvas, layers };
}
const current = (s: EditorStore) =>
  activeComposition(s.getSnapshot().project).layers;
it('Shift direction remains stable despite later dominant Y movement; Esc restores snapshot', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(canvas, {
    clientX: 500,
    clientY: 210,
    shiftKey: true,
    ctrlKey: true,
  });
  fireEvent.pointerMove(canvas, {
    clientX: 420,
    clientY: 500,
    shiftKey: true,
    ctrlKey: true,
  });
  expect(store.getSnapshot().preview?.position).toEqual({ x: 420, y: 200 });
  fireEvent.keyDown(canvas, { key: 'Escape' });
  fireEvent.pointerUp(canvas);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('side handle is single axis even with linked Inspector; live Inspector and one undo', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 200 });
  expect(screen.getByLabelText('缩放 X（%）')).toHaveValue(200);
  expect(screen.getByLabelText('缩放 Y（%）')).toHaveValue(100);
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.scale.baseValue).toEqual({ x: 2, y: 1 });
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('corner scales proportionally by default; Shift unlocks ratio', () => {
  const { store, canvas } = setup();
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 250 });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 350, shiftKey: true });
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.scale.baseValue).toEqual({ x: 2, y: 3 });
});
it('rotation accumulates through 180 and 360 degrees, then one Undo restores all', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 105 });
  for (const [x, y] of [
    [495, 200],
    [400, 295],
    [305, 200],
    [400, 105],
  ])
    fireEvent.pointerMove(canvas, { clientX: x, clientY: y });
  expect(screen.getByLabelText('旋转（°）')).toHaveValue(360);
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.rotation.baseValue).toBeCloseTo(360);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('Alt starts duplicate preview without Scene writes; release creates and moves copy in one transaction', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, {
    button: 0,
    clientX: 400,
    clientY: 200,
    altKey: true,
  });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 200, ctrlKey: true });
  expect(store.getSnapshot().project).toBe(before);
  expect(activeComposition(store.getRenderProject()).layers).toHaveLength(2);
  fireEvent.pointerUp(canvas);
  expect(current(store)).toHaveLength(2);
  expect(current(store)[0]!.transform.position.baseValue).toEqual({
    x: 400,
    y: 200,
  });
  expect(current(store)[1]!.transform.position.baseValue).toEqual({
    x: 500,
    y: 200,
  });
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  act(() => store.redo());
  expect(current(store)).toHaveLength(2);
});
it('duplicate cancel leaves no copy/history; next gesture remains usable', () => {
  const { store, canvas } = setup();
  fireEvent.pointerDown(canvas, {
    button: 0,
    clientX: 400,
    clientY: 200,
    altKey: true,
  });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 200 });
  fireEvent.pointerCancel(canvas);
  fireEvent.pointerUp(canvas);
  expect(current(store)).toHaveLength(1);
  expect(store.commands.undoStack).toHaveLength(0);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 200, ctrlKey: true });
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.position.baseValue.x).toBe(500);
});
it('reverse marquee on viewport margin selects only visible unlocked objects; cancel restores original selection', () => {
  const base = shape(),
    hidden = { ...shape(600), visible: false },
    locked = { ...shape(700), locked: true };
  const { store, canvas } = setup([base, hidden, locked]);
  const viewport = canvas.closest('.canvas-scroll')!;
  fireEvent.pointerDown(viewport, { button: 0, clientX: 850, clientY: 350 });
  fireEvent.pointerMove(viewport, { clientX: 300, clientY: 100 });
  fireEvent.pointerUp(viewport);
  expect(store.getSnapshot().selection).toEqual([base.id]);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  expect(store.getSnapshot().selection).toEqual([]);
  fireEvent.keyDown(canvas, { key: 'Escape' });
  fireEvent.pointerUp(canvas);
  expect(store.getSnapshot().selection).toEqual([base.id]);
});
it('hover targets editable topmost object under locked layer; selection/timeline remain unified', () => {
  const base = shape(),
    locked = { ...shape(), locked: true };
  const { store, canvas } = setup([base, locked]);
  act(() => store.select(null));
  fireEvent.pointerMove(canvas, { clientX: 400, clientY: 200 });
  expect(screen.getByLabelText('悬停对象轮廓')).toBeInTheDocument();
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerUp(canvas);
  expect(store.getSnapshot().selection).toEqual([base.id]);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('multi selection shows Mixed rather than first layer values, still scales/rotates with shared transaction', () => {
  const a = shape(200),
    b = shape(600);
  const { store } = setup([a, b]);
  act(() => store.select(b.id, true));
  expect(screen.getByLabelText('位置 X')).toHaveValue(null);
  expect(screen.getByLabelText('位置 X')).toHaveAttribute('placeholder', '—');
  expect(screen.getByLabelText('位置 Y')).toHaveValue(200);
  const field = screen.getByLabelText('旋转（°）');
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: '90' } });
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(current(store).map((l) => l.transform.position.baseValue)).toEqual([
    { x: 400, y: 0 },
    { x: 400, y: 400 },
  ]);
  expect(store.commands.undoStack).toHaveLength(1);
});
it('keyboard repeat nudges coalesce within held key; release separates history and Undo/Redo are exact', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.keyDown(canvas, { key: 'ArrowRight' });
  for (let i = 0; i < 20; i++)
    fireEvent.keyDown(canvas, { key: 'ArrowRight', repeat: true });
  fireEvent.keyUp(canvas, { key: 'ArrowRight' });
  expect(current(store)[0]!.transform.position.baseValue.x).toBe(421);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  act(() => store.redo());
  expect(current(store)[0]!.transform.position.baseValue.x).toBe(421);
  fireEvent.keyDown(canvas, { key: 'ArrowRight', shiftKey: true });
  fireEvent.keyUp(canvas, { key: 'ArrowRight' });
  expect(store.commands.undoStack).toHaveLength(2);
});
it('Space-pan preserves selection and prior tool; typing Space in an input never starts pan', () => {
  const { store, canvas, layers } = setup();
  const viewport = canvas.closest('.canvas-scroll')!;
  fireEvent.keyDown(canvas, { key: ' ', code: 'Space' });
  fireEvent.pointerDown(viewport, { button: 0, clientX: 300, clientY: 200 });
  fireEvent.pointerMove(viewport, { clientX: 420, clientY: 270 });
  fireEvent.pointerUp(viewport);
  expect(canvas.parentElement!.style.transform).toBe('translate(120px,70px)');
  fireEvent.keyUp(canvas, { key: ' ', code: 'Space' });
  expect(store.getSnapshot().selection).toEqual([layers[0]!.id]);
  expect(store.commands.undoStack).toHaveLength(0);
  const input = screen.getByLabelText('图层名称');
  fireEvent.keyDown(input, { key: ' ', code: 'Space' });
  expect(canvas.style.cursor).not.toBe('grab');
});
it.each([0.25, 0.5, 1, 2, 4])(
  'screen coordinates at %s scale remain correct for direct dragging',
  (scale) => {
    const { store, canvas } = setup();
    act(() => store.setZoom(scale));
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
      rect(20, 30, 1920 * scale, 1080 * scale),
    );
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 20 + 400 * scale,
      clientY: 30 + 200 * scale,
    });
    fireEvent.pointerMove(canvas, {
      clientX: 20 + 550 * scale,
      clientY: 30 + 220 * scale,
      ctrlKey: true,
    });
    fireEvent.pointerUp(canvas);
    expect(current(store)[0]!.transform.position.baseValue).toEqual({
      x: 550,
      y: 220,
    });
    expect(store.commands.undoStack).toHaveLength(1);
  },
);

it('A: creation/move/scale/rotation/anchor are five undoable actions and five Redos restore exact Scene', () => {
  const { store, canvas } = setup([]);
  fireEvent.click(screen.getByRole('button', { name: '矩形工具' }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 300, clientY: 300 });
  fireEvent.pointerUp(canvas);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 250, clientY: 250 });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 300, ctrlKey: true });
  fireEvent.pointerUp(canvas);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 550, clientY: 350 });
  fireEvent.pointerMove(canvas, { clientX: 600, clientY: 400 });
  fireEvent.pointerUp(canvas);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 500, clientY: 155 });
  fireEvent.pointerMove(canvas, { clientX: 645, clientY: 300 });
  fireEvent.pointerUp(canvas);
  fireEvent.click(screen.getByRole('button', { name: /^锚点$/ }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: 500, clientY: 300 });
  fireEvent.pointerMove(canvas, { clientX: 520, clientY: 320 });
  fireEvent.pointerUp(canvas);
  const after = store.getSnapshot().project;
  expect(store.commands.undoStack).toHaveLength(5);
  for (let i = 0; i < 5; i++) act(() => store.undo());
  expect(current(store)).toHaveLength(0);
  for (let i = 0; i < 5; i++) act(() => store.redo());
  expect(store.getSnapshot().project).toEqual(after);
});
it('B: Shift-click Rectangle/Ellipse/Text and transform the group; each Undo restores all objects', () => {
  const rectangle = shape(200),
    ellipse = createLayer('ellipse', {
      position: { x: 400, y: 200 },
      width: 100,
      height: 100,
    }),
    text = createLayer('text', {
      position: { x: 600, y: 200 },
      width: 100,
      height: 100,
    });
  const { store, canvas } = setup([rectangle, ellipse, text]);
  const before = store.getSnapshot().project;
  for (const x of [400, 600]) {
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: x,
      clientY: 200,
      shiftKey: true,
    });
    fireEvent.pointerUp(canvas);
  }
  expect(store.getSnapshot().selection).toHaveLength(3);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 300, clientY: 300, ctrlKey: true });
  fireEvent.pointerUp(canvas);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 750, clientY: 350 });
  fireEvent.pointerMove(canvas, { clientX: 1000, clientY: 400 });
  fireEvent.pointerUp(canvas);
  expect(current(store).map((l) => l.transform.scale.baseValue)).toEqual([
    { x: 2, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 2 },
  ]);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 500, clientY: 155 });
  fireEvent.pointerMove(canvas, { clientX: 645, clientY: 300 });
  fireEvent.pointerUp(canvas);
  expect(current(store).map((l) => l.transform.rotation.baseValue)).toEqual([
    90, 90, 90,
  ]);
  expect(store.commands.undoStack).toHaveLength(3);
  for (let i = 0; i < 3; i++) act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it.each([0.25, 0.5, 1, 2, 4])(
  'D: handles and 6-screen-pixel snapping remain correct at %s zoom',
  (scale) => {
    const { store, canvas } = setup();
    act(() => store.setZoom(scale));
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
      rect(20, 30, 1920 * scale, 1080 * scale),
    );
    const pointer = (x: number, y: number) => ({
      button: 0,
      clientX: 20 + x * scale,
      clientY: 30 + y * scale,
    });
    fireEvent.pointerDown(canvas, pointer(450, 200));
    fireEvent.pointerMove(canvas, pointer(500, 200));
    fireEvent.pointerUp(canvas);
    expect(current(store)[0]!.transform.scale.baseValue).toEqual({
      x: 2,
      y: 1,
    });
    act(() => store.undo());
    fireEvent.pointerDown(canvas, pointer(400, 200));
    fireEvent.pointerMove(canvas, pointer(960 - 5 / scale, 540));
    fireEvent.pointerUp(canvas);
    expect(current(store)[0]!.transform.position.baseValue).toEqual({
      x: 960,
      y: 540,
    });
  },
);
it('negative scale from side crossing pivot is preserved and one Undo restores original', () => {
  const { store, canvas } = setup();
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 300, clientY: 200 });
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.scale.baseValue).toEqual({ x: -2, y: 1 });
  act(() => store.undo());
  expect(current(store)[0]!.transform.scale.baseValue).toEqual({ x: 1, y: 1 });
});
it('viewport pointer cancellation restores selection and clears exclusive interaction state', () => {
  const { store, canvas, layers } = setup();
  const viewport = canvas.closest('.canvas-scroll')!;
  fireEvent.pointerDown(viewport, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(viewport, { clientX: 600, clientY: 400 });
  fireEvent.pointerCancel(viewport);
  expect(store.getSnapshot().selection).toEqual([layers[0]!.id]);
  expect(screen.getByLabelText('画布区域')).toHaveAttribute(
    'data-interaction',
    'idle',
  );
});

it.each([
  { x: 80, y: 90 },
  { x: 1700, y: 950 },
])('E: cursor zoom keeps composition point anchored at $x/$y', (cursor) => {
  const { store, canvas } = setup();
  const viewport = canvas.closest('.canvas-scroll')!;
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(rect());
  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() =>
    rect(
      0,
      0,
      1920 * store.getSnapshot().zoom,
      1080 * store.getSnapshot().zoom,
    ),
  );
  fireEvent.wheel(canvas, {
    ctrlKey: true,
    clientX: cursor.x,
    clientY: cursor.y,
    deltaY: -Math.log(2) / 0.002,
  });
  expect(store.getSnapshot().zoom).toBeCloseTo(2);
  expect(viewport.scrollLeft).toBeCloseTo(cursor.x);
  expect(viewport.scrollTop).toBeCloseTo(cursor.y);
  expect(cursor.x * 2 - viewport.scrollLeft).toBeCloseTo(cursor.x);
  expect(cursor.y * 2 - viewport.scrollTop).toBeCloseTo(cursor.y);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('manual zoom preserves actual pixel scale on resize while Fit adapts', () => {
  const observers: { callback: () => void; target?: Element }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      record: { callback: () => void; target?: Element };
      constructor(callback: () => void) {
        this.record = { callback };
        observers.push(this.record);
      }
      observe(target: Element) {
        this.record.target = target;
      }
      disconnect() {}
    },
  );
  vi.stubGlobal('getComputedStyle', () => ({
    paddingLeft: '0',
    paddingRight: '0',
    paddingTop: '0',
    paddingBottom: '0',
  }));
  try {
    const { store, canvas } = setup();
    const viewport = canvas.closest('.canvas-scroll')!;
    let width = 1100;
    Object.defineProperty(viewport, 'clientWidth', { get: () => width });
    Object.defineProperty(viewport, 'clientHeight', { get: () => 800 });
    const observer = observers.find((o) => o.target === viewport)!;
    act(() => observer.callback());
    fireEvent.change(screen.getByLabelText('画布缩放'), {
      target: { value: '100' },
    });
    expect(store.getSnapshot().zoom * 1100).toBeCloseTo(1920);
    width = 800;
    act(() => observer.callback());
    expect(store.getSnapshot().zoom * 800).toBeCloseTo(1920);
    fireEvent.change(screen.getByLabelText('画布缩放'), {
      target: { value: 'fit' },
    });
    width = 600;
    act(() => observer.callback());
    expect(store.getSnapshot().zoom).toBe(1);
    expect(canvas.parentElement!.style.width).toBe('600px');
  } finally {
    vi.unstubAllGlobals();
  }
});
it('moving preview reaches Inspector before mouse release without changing Scene', () => {
  const { store, canvas } = setup();
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 600, clientY: 300, ctrlKey: true });
  expect(screen.getByLabelText('位置 X')).toHaveValue(600);
  expect(screen.getByLabelText('位置 Y')).toHaveValue(300);
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(canvas);
  expect(store.commands.undoStack).toHaveLength(1);
});

it('anchor move preserves visual matrix under rotated scaled 2D parent and Undo restores properties', () => {
  const raw = createLayer('null', { position: { x: 500, y: 300 } });
  const parent = {
    ...raw,
    transform: {
      ...raw.transform,
      scale: { ...raw.transform.scale, baseValue: { x: 2, y: 2 } },
      rotation: { ...raw.transform.rotation, baseValue: 37 },
    },
  };
  const childRaw = shape(100, 60);
  const child = {
    ...childRaw,
    editor: { ...childRaw.editor!, parentId: parent.id },
    transform: {
      ...childRaw.transform,
      scale: { ...childRaw.transform.scale, baseValue: { x: 2, y: 0.5 } },
      rotation: { ...childRaw.transform.rotation, baseValue: 25 },
    },
  };
  const { store, canvas } = setup([child, parent]);
  const before = store.getSnapshot().project;
  const snapshot = () =>
    createRenderSnapshot(activeComposition(store.getSnapshot().project), 0, [
      child.id,
    ]);
  const matrix = snapshot().layers.find(
    (l) => l.source.id === child.id,
  )!.matrix!;
  fireEvent.click(screen.getByRole('button', { name: /^锚点$/ }));
  fireEvent.pointerDown(canvas, {
    button: 0,
    clientX: matrix[4],
    clientY: matrix[5],
  });
  fireEvent.pointerMove(canvas, {
    clientX: matrix[4] + 20,
    clientY: matrix[5] + 30,
  });
  fireEvent.pointerUp(canvas);
  const after = snapshot().layers.find((l) => l.source.id === child.id)!;
  after.matrix!.forEach((n, i) => expect(n).toBeCloseTo(matrix[i]!, 7));
  expect(after.anchor).not.toEqual({ x: 0, y: 0 });
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('equal spacing is visible during drag, commits once and Ctrl bypasses it', () => {
  const moving = shape(900),
    left = shape(200),
    right = shape(600);
  const { store, canvas } = setup([moving, left, right]);
  fireEvent.pointerDown(canvas, { button: 0, clientX: 900, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 398, clientY: 200 });
  expect(screen.getByLabelText('等间距参考线')).toBeInTheDocument();
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.position.baseValue.x).toBe(400);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  fireEvent.pointerDown(canvas, { button: 0, clientX: 900, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 398, clientY: 200, ctrlKey: true });
  expect(screen.queryByLabelText('等间距参考线')).toBeNull();
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.position.baseValue.x).toBe(398);
});
