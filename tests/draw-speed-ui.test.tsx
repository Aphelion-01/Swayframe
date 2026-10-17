// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { GraphEditor } from '../src/ui/GraphEditor';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  findProperty,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { newId } from '../src/core/core-types';
import { evaluateProperty } from '../src/core/animation-engine';
beforeAll(() => {
  window.PointerEvent = class extends MouseEvent {
    readonly pointerId: number;
    constructor(t: string, i: PointerEventInit = {}) {
      super(t, i);
      this.pointerId = i.pointerId ?? 1;
    }
  } as typeof PointerEvent;
  SVGElement.prototype.setPointerCapture = vi.fn();
});
afterEach(cleanup);
function setup() {
  const p = createDefaultProject(),
    l = createLayer('rectangle'),
    store = new EditorStore(p),
    id = l.transform.position.id;
  store.run('create', [
    command({
      type: 'layer.create',
      compositionId: p.activeCompositionId,
      layer: l,
    }),
  ]);
  store.run(
    'frames',
    [0, 2].map((time) =>
      command({
        type: 'keyframe.add',
        propertyId: id,
        keyframe: {
          id: newId(),
          time,
          value: { x: time * 50, y: 30 },
          interpolation: { type: 'linear' },
        },
      }),
    ),
  );
  store.select(l.id);
  store.selectProperties([id]);
  render(<GraphEditor store={store} onClose={() => {}} embedded />);
  fireEvent.click(screen.getByRole('button', { name: '手绘速度' }));
  const svg = screen.getByRole('img', { name: '手绘相对速度曲线' });
  svg.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 680,
    height: 280,
    right: 680,
    bottom: 280,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const get = () => findProperty(store.commands.getSnapshot(), id).property;
  return { store, svg, get };
}
it('native Graph scope opens draw mode; preview stays outside Scene; one gesture one Command; Undo/Redo/reload', () => {
  const { store, svg, get } = setup(),
    before = store.save(),
    n = store.commands.undoStack.length;
  fireEvent.pointerDown(svg, {
    clientX: 50,
    clientY: 235,
    button: 0,
    pointerId: 3,
  });
  fireEvent.pointerMove(window, { clientX: 340, clientY: 132.5, pointerId: 3 });
  expect(store.save()).toBe(before);
  expect(store.getSnapshot().propertyPreviews?.length).toBe(1);
  fireEvent.pointerUp(window, { clientX: 630, clientY: 30, pointerId: 3 });
  expect(get().keyframes[0]!.interpolation.type).toBe('custom-speed');
  expect(evaluateProperty(get(), 1)).toEqual({ x: 25, y: 30 });
  expect(store.commands.undoStack.length).toBe(n + 1);
  const after = store.save();
  act(() => store.undo());
  expect(store.save()).toBe(before);
  act(() => store.redo());
  expect(store.save()).toBe(after);
  act(() => store.load(after));
  expect(store.save()).toBe(after);
});
it('Esc and pointercancel restore original; invalid all-zero stroke does not enter Scene', () => {
  const { store, svg } = setup(),
    before = store.save(),
    n = store.commands.undoStack.length;
  fireEvent.pointerDown(svg, {
    clientX: 50,
    clientY: 180,
    button: 0,
    pointerId: 1,
  });
  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.pointerUp(window, { clientX: 630, clientY: 30, pointerId: 1 });
  expect(store.save()).toBe(before);
  fireEvent.pointerDown(svg, {
    clientX: 50,
    clientY: 180,
    button: 0,
    pointerId: 1,
  });
  fireEvent.pointerCancel(window, { pointerId: 1 });
  expect(store.save()).toBe(before);
  fireEvent.pointerDown(svg, {
    clientX: 50,
    clientY: 235,
    button: 0,
    pointerId: 1,
  });
  fireEvent.pointerUp(window, { clientX: 630, clientY: 235, pointerId: 1 });
  expect(store.save()).toBe(before);
  expect(store.commands.undoStack.length).toBe(n);
});
it('project change refuses late release; wrong pointer cannot submit', () => {
  const { store, svg } = setup(),
    before = store.save();
  fireEvent.pointerDown(svg, {
    clientX: 50,
    clientY: 180,
    button: 0,
    pointerId: 4,
  });
  fireEvent.pointerUp(window, { clientX: 630, clientY: 30, pointerId: 5 });
  expect(store.save()).toBe(before);
  act(() => store.load(JSON.stringify(createDefaultProject())));
  const next = store.save();
  fireEvent.pointerUp(window, { clientX: 630, clientY: 30, pointerId: 4 });
  expect(store.save()).toBe(next);
  expect(store.getSnapshot().propertyPreviews).toBeUndefined();
});

it('same-project edit cancels a pending stroke; presets share one native transaction', () => {
  const { store, svg, get } = setup();
  fireEvent.pointerDown(svg, {
    clientX: 50,
    clientY: 200,
    button: 0,
    pointerId: 9,
    pointerType: 'pen',
  });
  act(() =>
    store.run('change', [
      command({
        type: 'keyframe.update',
        propertyId: get().id,
        keyframeId: get().keyframes[1]!.id,
        patch: { value: { x: 200, y: 30 } },
      }),
    ]),
  );
  const edited = store.save(),
    n = store.commands.undoStack.length;
  fireEvent.pointerUp(window, { clientX: 630, clientY: 30, pointerId: 9 });
  expect(store.save()).toBe(edited);
  fireEvent.click(screen.getByRole('button', { name: '中途停顿' }));
  expect(store.commands.undoStack.length).toBe(n + 1);
  const p = get();
  expect(evaluateProperty(p, 0.8)).toEqual(evaluateProperty(p, 1.2));
});

it('changing selection cancels pen/mouse draft even if property remains selected', () => {
  const { store, svg } = setup();
  const other = createLayer('rectangle');
  act(() =>
    store.run('other', [
      command({
        type: 'layer.create',
        compositionId: store.getSnapshot().project.activeCompositionId,
        layer: other,
      }),
    ]),
  );
  const before = store.save();
  fireEvent.pointerDown(svg, {
    clientX: 50,
    clientY: 180,
    button: 0,
    pointerId: 1,
  });
  act(() => store.select(other.id));
  fireEvent.pointerUp(window, { clientX: 630, clientY: 30, pointerId: 1 });
  expect(store.save()).toBe(before);
  expect(store.getSnapshot().propertyPreviews).toBeUndefined();
});
