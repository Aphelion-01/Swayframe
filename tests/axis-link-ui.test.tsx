// @vitest-environment jsdom
import { afterEach, beforeAll, it, expect, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Inspector } from '../src/ui/Inspector';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { evaluateProperty } from '../src/core/animation-engine';
import { linkedAxisValues } from '../src/ui/axis-link';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup() {
  const store = new EditorStore(createDefaultProject());
  const original = createLayer('rectangle');
  const layer = {
    ...original,
    transform: {
      ...original.transform,
      scale: { ...original.transform.scale, baseValue: { x: 1, y: 2 } },
    },
  };
  store.run('准备', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer,
    }),
  ]);
  store.select(layer.id);
  render(<Inspector store={store} />);
  return { store, layer };
}
function change(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}
function layerOf(store: EditorStore) {
  return activeComposition(store.getSnapshot().project).layers[0]!;
}
it('默认链接：缩放保持比例，单笔提交，两轴一起撤销；解除后独立编辑', () => {
  const { store } = setup();
  const count = store.commands.undoStack.length;
  expect(
    screen.getByRole('button', { name: '解除缩放 X/Y 链接' }),
  ).toHaveAttribute('aria-pressed', 'true');
  change('缩放 X（%）', '150');
  expect(layerOf(store).transform.scale.baseValue).toEqual({ x: 1.5, y: 3 });
  expect(store.commands.undoStack).toHaveLength(count + 1);
  act(() => store.undo());
  expect(layerOf(store).transform.scale.baseValue).toEqual({ x: 1, y: 2 });
  const before = store.save();
  fireEvent.click(screen.getByRole('button', { name: '解除缩放 X/Y 链接' }));
  expect(store.save()).toBe(before);
  expect(store.commands.undoStack).toHaveLength(count);
  change('缩放 Y（%）', '300');
  expect(layerOf(store).transform.scale.baseValue).toEqual({ x: 1, y: 3 });
  cleanup();
  render(<Inspector store={store} />);
  expect(
    screen.getByRole('button', { name: '启用缩放 X/Y 链接' }),
  ).toHaveAttribute('aria-pressed', 'false');
});
it('位置联动保留轴间差值，动画只提交当前时间一个向量关键帧', () => {
  const { store, layer } = setup();
  act(() => {
    store.togglePropertyAnimation(layer.transform.position.id);
    store.setTime(1);
  });
  const count = store.commands.undoStack.length;
  change('位置 Y', '560');
  const position = layerOf(store).transform.position;
  expect(evaluateProperty(position, 1)).toEqual({ x: 980, y: 560 });
  expect(position.keyframes).toHaveLength(2);
  expect(store.commands.undoStack).toHaveLength(count + 1);
  act(() => store.undo());
  expect(layerOf(store).transform.position.keyframes).toHaveLength(1);
});
it('联动 scrub 只预览两轴，Escape 取消不写工程，链接偏好不串到另一个属性', () => {
  const { store } = setup();
  const before = store.getSnapshot().project;
  const count = store.commands.undoStack.length;
  const label = screen.getByText('位置 X', { selector: '.scrub-label' });
  fireEvent.pointerDown(label, { button: 0, clientX: 10 });
  fireEvent.pointerMove(label, { clientX: 30 });
  expect(store.getSnapshot().project).toBe(before);
  expect(
    activeComposition(store.getRenderProject()).layers[0]!.transform.position
      .baseValue,
  ).toEqual({ x: 980, y: 560 });
  fireEvent.pointerCancel(label);
  fireEvent.pointerUp(label);
  expect(store.getRenderProject()).toBe(before);
  expect(store.commands.undoStack).toHaveLength(count);
  fireEvent.click(screen.getByRole('button', { name: '解除位置 X/Y 链接' }));
  expect(
    screen.getByRole('button', { name: '解除锚点 X/Y 链接' }),
  ).toHaveAttribute('aria-pressed', 'true');
});
it('零缩放可编辑，3D 联动只影响 XY，Z 和解链数值保持独立', () => {
  expect(linkedAxisValues([0, 0], 0, 2, true, 'ratio')).toEqual([2, 2]);
  expect(linkedAxisValues([2, 4, 7], 1, 8, true, 'ratio')).toEqual([4, 8, 7]);
  expect(linkedAxisValues([2, 4, 7], 2, 9, true, 'offset')).toEqual([2, 4, 9]);
  expect(linkedAxisValues([2, 4, 7], 0, 9, false, 'offset')).toEqual([9, 4, 7]);
});
