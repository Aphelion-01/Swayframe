// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
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
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
beforeAll(() => {
  window.PointerEvent = class extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  } as typeof PointerEvent;
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
  store.setAutoKeyframes(false);
  store.select(layer.id);
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
  return { store, canvas };
}
const pos = (s: EditorStore) =>
  activeComposition(s.commands.getSnapshot()).layers[0]!.transform.position
    .baseValue;
it('capture loss mid-drag does not discard movement; global release commits the exact final point once', () => {
  const { store, canvas } = setup();
  const saved = store.save();
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 7,
    clientX: 410,
    clientY: 210,
  });
  fireEvent.pointerMove(canvas, {
    pointerId: 7,
    clientX: 490,
    clientY: 250,
    ctrlKey: true,
  });
  fireEvent.lostPointerCapture(canvas, { pointerId: 7 });
  fireEvent.pointerMove(window, {
    pointerId: 7,
    clientX: 530,
    clientY: 280,
    ctrlKey: true,
  });
  fireEvent.pointerUp(window, {
    pointerId: 7,
    clientX: 550,
    clientY: 290,
    ctrlKey: true,
  });
  expect(pos(store)).toEqual({ x: 540, y: 280 });
  expect(store.commands.undoStack).toHaveLength(1);
  const moved = store.save();
  act(() => store.undo());
  expect(store.save()).toBe(saved);
  act(() => store.redo());
  expect(store.save()).toBe(moved);
  act(() => store.load(moved));
  expect(pos(store)).toEqual({ x: 540, y: 280 });
});
it('pointerup coordinates newer than the last pointermove are applied before commit', () => {
  const { store, canvas } = setup();
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 2,
    clientX: 410,
    clientY: 210,
  });
  fireEvent.pointerMove(canvas, {
    pointerId: 2,
    clientX: 450,
    clientY: 230,
    ctrlKey: true,
  });
  fireEvent.pointerUp(canvas, {
    pointerId: 2,
    clientX: 520,
    clientY: 270,
    ctrlKey: true,
  });
  expect(pos(store)).toEqual({ x: 510, y: 260 });
  expect(store.commands.undoStack).toHaveLength(1);
});
it('another pointer cannot finish the active drag; explicit pointercancel still restores the original Scene', () => {
  const { store, canvas } = setup();
  const saved = store.save();
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 4,
    clientX: 410,
    clientY: 210,
  });
  fireEvent.pointerMove(canvas, {
    pointerId: 4,
    clientX: 480,
    clientY: 250,
    ctrlKey: true,
  });
  fireEvent.pointerUp(window, { pointerId: 9, clientX: 900, clientY: 900 });
  expect(store.save()).toBe(saved);
  fireEvent.pointerCancel(window, { pointerId: 4 });
  expect(store.save()).toBe(saved);
  expect(store.getSnapshot().preview).toBeUndefined();
  expect(store.commands.undoStack).toHaveLength(0);
});
