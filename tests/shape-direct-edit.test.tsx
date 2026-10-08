// @vitest-environment jsdom
import { expect, it, vi, afterEach, beforeAll } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { ShapePathOverlay } from '../src/ui/ShapePathOverlay';
import { ThreeDGizmo } from '../src/ui/ThreeDGizmo';
import { EditorStore } from '../src/ui/editor-store';
import { toggleLayer3D } from '../src/ui/workspace/layer-3d';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  SVGElement.prototype.setPointerCapture = vi.fn();
});
afterEach(cleanup);
function setup() {
  const p = createDefaultProject(),
    layer = createLayer('path'),
    store = new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, layers: [layer] })),
    });
  store.select(layer.id);
  store.setAutoKeyframes(false);
  return {
    store,
    layer,
    snapshot: () =>
      createRenderSnapshot(
        activeComposition(store.getSnapshot().project),
        0,
        [layer.id],
        undefined,
        store.getSnapshot().project,
      ),
  };
}
it('direct path handles preview only, commit one command, support undo and cancel', () => {
  const { store, layer, snapshot } = setup(),
    before = store.getSnapshot().project;
  render(
    <ShapePathOverlay
      store={store}
      snapshot={snapshot()}
      width={1920}
      height={1080}
    />,
  );
  const svg = screen.getByLabelText('直接编辑贝塞尔路径');
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
  } as DOMRect);
  const handle = screen.getByLabelText(`${layer.name}路径点 1 出切线`);
  fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(window, { clientX: 130, clientY: 110 });
  expect(store.getSnapshot().project).toBe(before);
  expect(store.getSnapshot().propertyPreview).toBeDefined();
  fireEvent.pointerUp(window, { clientX: 140, clientY: 120 });
  expect(store.commands.undoStack).toHaveLength(1);
  expect(store.getSnapshot().propertyPreview).toBeUndefined();
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(window, { clientX: 130, clientY: 110 });
  fireEvent.pointerCancel(window);
  expect(store.getSnapshot().propertyPreview).toBeUndefined();
  expect(store.getSnapshot().project).toEqual(before);
});
it('near point-on Z projection remains continuous instead of flipping to a fixed diagonal', () => {
  const { store, layer, snapshot } = setup();
  toggleLayer3D(store, [layer.id]);
  const props = { store, snapshot: snapshot(), width: 800, height: 600 };
  const ui = render(
    <ThreeDGizmo
      {...props}
      project={(p) => ({
        x: 400 + p[0] + p[2] * 0.001,
        y: 300 + p[1],
        z: 1000,
      })}
    />,
  );
  const before = Number(
    screen.getByLabelText('移动三维 Z 轴').getAttribute('x2'),
  );
  ui.rerender(
    <ThreeDGizmo
      {...props}
      project={(p) => ({
        x: 400 + p[0] - p[2] * 0.001,
        y: 300 + p[1],
        z: 1000,
      })}
    />,
  );
  const after = Number(
    screen.getByLabelText('移动三维 Z 轴').getAttribute('x2'),
  );
  expect(Math.abs(after - before)).toBeLessThan(1);
  expect(
    screen.getByLabelText('移动三维 Z 轴').getAttribute('stroke-width'),
  ).toBe('28');
});
