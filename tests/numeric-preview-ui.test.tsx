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
import { Inspector } from '../src/ui/Inspector';
import { AnimatedField } from '../src/ui/AnimatedField';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
  createProperty,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { evaluateProperty } from '../src/core/animation-engine';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup(kind: 'rectangle' | 'text' = 'rectangle') {
  const store = new EditorStore(createDefaultProject());
  const layer = createLayer(kind);
  store.run('准备', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer,
    }),
  ]);
  store.select(layer.id);
  render(<Inspector store={store} />);
  return {
    store,
    layer,
    history: store.commands.undoStack.length,
    project: store.getSnapshot().project,
  };
}
function rendered(store: EditorStore) {
  return activeComposition(store.getRenderProject()).layers[0]!;
}
it('typing and repeated arrow adjustments preview immediately, Enter commits one undo without a blur duplicate', () => {
  const { store, layer, project, history } = setup();
  const input = screen.getByLabelText('位置 X');
  input.focus();
  fireEvent.change(input, { target: { value: '1000' } });
  expect(rendered(store).transform.position.baseValue).toEqual({
    x: 1000,
    y: 580,
  });
  expect(store.getSnapshot().project).toBe(project);
  expect(screen.getByLabelText('位置 Y')).toHaveValue(580);
  expect(store.commands.undoStack).toHaveLength(history);
  fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });
  fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
  expect(rendered(store).transform.position.baseValue.x).toBeCloseTo(1009.9);
  expect(rendered(store).transform.position.baseValue.y).toBeCloseTo(589.9);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(store.commands.undoStack).toHaveLength(history + 1);
  act(() => store.undo());
  expect(rendered(store).transform.position.baseValue).toEqual(
    layer.transform.position.baseValue,
  );
});
it('100 vertical value moves preview linked XY and release creates one animated keyframe transaction', () => {
  const { store, layer } = setup();
  act(() => {
    store.togglePropertyAnimation(layer.transform.position.id);
    store.setTime(1);
  });
  const input = screen.getByLabelText('位置 X'),
    history = store.commands.undoStack.length;
  fireEvent.pointerDown(input, { button: 0, clientY: 200 });
  for (let i = 1; i <= 100; i++)
    fireEvent.pointerMove(input, { clientY: 200 - i });
  expect(rendered(store).transform.position.baseValue).toEqual({
    x: 1060,
    y: 640,
  });
  expect(store.commands.undoStack).toHaveLength(history);
  fireEvent.pointerUp(input);
  const property = activeComposition(store.getSnapshot().project).layers[0]!
    .transform.position;
  expect(property.keyframes).toHaveLength(2);
  expect(evaluateProperty(property, 1)).toEqual({ x: 1060, y: 640 });
  expect(store.commands.undoStack).toHaveLength(history + 1);
  act(() => store.undo());
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.position
      .keyframes,
  ).toHaveLength(1);
});
it('downward drag decreases with modifiers and explicit cancellation never writes the project', () => {
  const { store, project, history } = setup();
  fireEvent.click(screen.getByRole('button', { name: '解除位置 X/Y 链接' }));
  const input = screen.getByLabelText('位置 X');
  fireEvent.pointerDown(input, { button: 0, clientY: 100 });
  fireEvent.pointerMove(input, { clientY: 130, altKey: true });
  expect(rendered(store).transform.position.baseValue).toEqual({
    x: 957,
    y: 540,
  });
  fireEvent.pointerCancel(input);
  fireEvent.pointerUp(input);
  expect(store.getRenderProject()).toBe(project);
  expect(store.commands.undoStack).toHaveLength(history);
  fireEvent.change(input, { target: { value: '999' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  fireEvent.blur(input);
  expect(store.getRenderProject()).toBe(project);
  expect(store.commands.undoStack).toHaveLength(history);
});
it('invalid intermediate input and stale playback time cancel previews rather than commit to another time', () => {
  const { store, project, history } = setup();
  const input = screen.getByLabelText('透明度（%）');
  fireEvent.change(input, { target: { value: '40' } });
  expect(rendered(store).transform.opacity.baseValue).toBe(0.4);
  fireEvent.change(input, { target: { value: '' } });
  expect(store.getRenderProject()).toBe(project);
  fireEvent.change(input, { target: { value: '60' } });
  act(() => store.setTime(1));
  fireEvent.blur(input);
  expect(store.getRenderProject()).toBe(project);
  expect(store.commands.undoStack).toHaveLength(history);
});
it('geometry and font size preview without touching persisted data, cancellation and commit use shared history', () => {
  const { store, project, history } = setup('text');
  const width = screen.getByLabelText('图层宽度');
  fireEvent.change(width, { target: { value: '700' } });
  expect(rendered(store).width).toBe(700);
  expect(store.getSnapshot().project).toBe(project);
  fireEvent.blur(width);
  expect(store.commands.undoStack).toHaveLength(history + 1);
  const font = screen.getByLabelText('字号');
  fireEvent.change(font, { target: { value: '90' } });
  expect(rendered(store).editor!.properties.fontSize!.baseValue).toBe(90);
  fireEvent.keyDown(font, { key: 'Escape' });
  expect(store.commands.undoStack).toHaveLength(history + 1);
});
it('link buttons exist only for XY vectors, never scalar, color or four component bounds', () => {
  const store = new EditorStore(createDefaultProject());
  render(
    <>
      <AnimatedField store={store} property={createProperty(1)} label="单值" />
      <AnimatedField
        store={store}
        property={createProperty([0, 0, 100, 100])}
        label="区域"
      />
      <AnimatedField
        store={store}
        property={createProperty([1, 1, 1, 1])}
        label="颜色"
        color
      />
      <AnimatedField
        store={store}
        property={createProperty({ x: 1, y: 2 })}
        label="二维"
      />
      <AnimatedField
        store={store}
        property={createProperty([1, 2, 3])}
        label="三维"
      />
    </>,
  );
  expect(screen.getAllByRole('button', { name: /X\/Y 链接/ })).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /区域 X\/Y/ })).toBeNull();
});

it('lost capture followed by window release commits once instead of rebounding', () => {
  const { store, history } = setup();
  const input = screen.getByLabelText('位置 X');
  fireEvent.pointerDown(input, { button: 0, clientY: 200 });
  fireEvent.pointerMove(input, { clientY: 150 });
  fireEvent.lostPointerCapture(input);
  fireEvent.pointerMove(window, { clientY: 125 });
  fireEvent.pointerUp(window, { clientY: 125 });
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.position
      .baseValue.x,
  ).toBe(1035);
  expect(store.commands.undoStack).toHaveLength(history + 1);
  fireEvent.pointerUp(input);
  expect(store.commands.undoStack).toHaveLength(history + 1);
});
