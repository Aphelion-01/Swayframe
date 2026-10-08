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
import { Canvas2DRenderer } from '../src/renderers/canvas2d';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it('camera optical drag renders the transient value before release and commits one undoable transaction', async () => {
  const p = createDefaultProject(),
    camera = createLayer('camera'),
    store = new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, layers: [camera] })),
    });
  store.select(camera.id);
  const paint = vi.spyOn(Canvas2DRenderer.prototype, 'render');
  render(<App store={store} />);
  await act(async () => {});
  paint.mockClear();
  const before = store.getSnapshot().project,
    input = screen.getByLabelText('曝光 EV');
  fireEvent.pointerDown(input, { button: 0, clientY: 100 });
  fireEvent.pointerMove(window, { clientY: 97 });
  expect(store.getSnapshot().project).toBe(before);
  expect(paint).toHaveBeenCalled();
  expect(paint.mock.calls.at(-1)![0].camera!.exposure).toBe(3);
  fireEvent.pointerUp(window, { clientY: 97 });
  expect(store.commands.undoStack).toHaveLength(1);
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.properties
      .cameraExposure!.baseValue,
  ).toBe(3);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
