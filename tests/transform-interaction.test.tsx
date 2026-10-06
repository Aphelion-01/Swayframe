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
import { guidanceFor } from '../src/ui/transform-guidance-controller';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import type { Layer } from '../src/core/project-model';
import { boundsCenter, getWorldBounds } from '../src/core/layer-bounds';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { loadProject, saveProject } from '../src/core/project-io';
import { createTransformContext } from '../src/core/transform-resolvers';
import { transformItems } from '../src/core/transform-operations';
import { transformEditCommands } from '../src/core/transform-editing';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  SVGElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const rectangle = (x = 400, y = 200) =>
  createLayer('rectangle', { position: { x, y }, width: 100, height: 100 });
function setup(layers: readonly Layer[]) {
  const p = createDefaultProject(),
    store = new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, layers })),
    });
  store.setAutoKeyframes(false);
  for (const l of layers) store.select(l.id, true);
  render(<App store={store} />);
  const canvas = screen.getByTestId('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    right: 1920,
    bottom: 1080,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return { store, canvas };
}
const current = (store: EditorStore) =>
  activeComposition(store.getSnapshot().project).layers;
const frame = (store: EditorStore) =>
  createRenderSnapshot(
    activeComposition(store.getSnapshot().project),
    store.getSnapshot().time,
    [],
  );
function numeric(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value } });
  return field;
}
it('A1/A2/A9：属性200%执行真实支点补偿，预览不写Scene，提交一次历史，Undo恢复Anchor', () => {
  const raw = rectangle(),
    layer = {
      ...raw,
      editor: {
        ...raw.editor!,
        properties: {
          ...raw.editor!.properties,
          anchor: {
            ...raw.editor!.properties.anchor!,
            baseValue: { x: -50, y: -50 },
          },
        },
      },
    };
  const { store } = setup([layer]),
    before = store.getSnapshot().project;
  let field = numeric('缩放 X（%）', '200');
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(current(store)[0]!.transform.position.baseValue).toEqual({
    x: 400,
    y: 200,
  });
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(1);
  act(() => store.undo());
  fireEvent.change(screen.getByLabelText('变换支点'), {
    target: { value: 'object-center' },
  });
  field = numeric('缩放 X（%）', '200');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(current(store)[0]!.transform.position.baseValue).toEqual({
    x: 350,
    y: 150,
  });
  expect(current(store)[0]!.editor!.properties.anchor!.baseValue).toEqual({
    x: -50,
    y: -50,
  });
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('A3/A4：两层旋转/缩放在Selection Center和Individual Origins下布局不同，整个事务一次Undo', () => {
  const { store } = setup([rectangle(200, 200), rectangle(600, 200)]);
  fireEvent.change(screen.getByLabelText('变换支点'), {
    target: { value: 'selection-center' },
  });
  let field = numeric('旋转（°）', '90');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(current(store).map((l) => l.transform.position.baseValue)).toEqual([
    { x: 400, y: 0 },
    { x: 400, y: 400 },
  ]);
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(1);
  act(() => store.undo());
  field = numeric('缩放 X（%）', '200');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(current(store).map((l) => l.transform.position.baseValue.x)).toEqual([
    0, 800,
  ]);
  act(() => store.undo());
  fireEvent.change(screen.getByLabelText('变换支点'), {
    target: { value: 'individual-origins' },
  });
  const centers = frame(store).layers.map((l) =>
    boundsCenter(getWorldBounds(l, 0)),
  );
  field = numeric('旋转（°）', '90');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(
    frame(store).layers.map((l) => boundsCenter(getWorldBounds(l, 0))),
  ).toEqual(centers);
  act(() => store.undo());
  field = numeric('缩放 X（%）', '200');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(
    frame(store).layers.map((l) => boundsCenter(getWorldBounds(l, 0))),
  ).toEqual(centers);
});
it('A5/A6：45°对象的Global/Local X轴拖动真实进入不同方向，100次move只提交一次', () => {
  const raw = rectangle(),
    l = {
      ...raw,
      transform: {
        ...raw.transform,
        rotation: { ...raw.transform.rotation, baseValue: 45 },
      },
    };
  const { store, canvas } = setup([l]);
  fireEvent.click(screen.getByLabelText('画布吸附'));
  fireEvent.change(screen.getByLabelText('变换轴向'), {
    target: { value: 'global' },
  });
  fireEvent.pointerDown(canvas, { button: 0, clientX: 440, clientY: 200 });
  fireEvent.pointerMove(canvas, { clientX: 540, clientY: 300 });
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.position.baseValue).toEqual({
    x: 500,
    y: 200,
  });
  act(() => store.undo());
  fireEvent.change(screen.getByLabelText('变换轴向'), {
    target: { value: 'local' },
  });
  fireEvent.pointerDown(canvas, {
    button: 0,
    clientX: 400 + 40 * Math.SQRT1_2,
    clientY: 200 + 40 * Math.SQRT1_2,
  });
  for (let i = 1; i <= 100; i++)
    fireEvent.pointerMove(canvas, {
      clientX: 400 + 40 * Math.SQRT1_2 + i,
      clientY: 200 + 40 * Math.SQRT1_2,
    });
  fireEvent.pointerUp(canvas);
  expect(current(store)[0]!.transform.position.baseValue.x).toBeCloseTo(450);
  expect(current(store)[0]!.transform.position.baseValue.y).toBeCloseTo(250);
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(1);
});
it('A8/A10：Custom Pivot拖动/键盘/Escape仅改变偏好，保存重开不污染Scene', () => {
  const { store } = setup([rectangle()]),
    before = saveProject(store.getSnapshot().project);
  fireEvent.change(screen.getByLabelText('变换支点'), {
    target: { value: 'custom' },
  });
  let handle = screen.getByRole('slider', { name: '拖动自定义支点' });
  fireEvent.pointerDown(handle, {
    button: 0,
    clientX: 400,
    clientY: 200,
    pointerId: 1,
  });
  fireEvent.pointerMove(handle, { clientX: 300, clientY: 250, pointerId: 1 });
  expect(
    guidanceFor(store).getSnapshot().referencePreview?.customPivot,
  ).toEqual({
    x: 300,
    y: 250,
  });
  fireEvent.keyDown(handle, { key: 'Escape' });
  expect(store.getSnapshot().transformSettings.customPivot).toBeUndefined();
  handle = screen.getByRole('slider', { name: '拖动自定义支点' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
  expect(store.getSnapshot().transformSettings.customPivot).toEqual({
    x: 390,
    y: 200,
  });
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(0);
  expect(saveProject(store.getSnapshot().project)).toBe(before);
  const reloaded = new EditorStore(loadProject(before));
  expect(reloaded.getSnapshot().transformSettings).toEqual(
    store.getSnapshot().transformSettings,
  );
});
it('手势期间修改轴向/时间会取消，旋转父级非等比缩放下可表示的90°变换提交全部必要通道', () => {
  const { store, canvas } = setup([rectangle()]),
    before = store.getSnapshot().project;
  fireEvent.pointerDown(canvas, { button: 0, clientX: 450, clientY: 250 });
  fireEvent.pointerMove(canvas, { clientX: 500, clientY: 300 });
  act(() => store.setTransformSettings({ orientation: 'global' }));
  fireEvent.pointerUp(canvas);
  expect(store.getSnapshot().project).toBe(before);
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(0);
  const p = createLayer('null', { position: { x: 100, y: 100 } }),
    parent = {
      ...p,
      transform: {
        ...p.transform,
        scale: { ...p.transform.scale, baseValue: { x: 2, y: 1 } },
      },
    },
    raw = rectangle(50, 0),
    child = { ...raw, editor: { ...raw.editor!, parentId: parent.id } },
    project = {
      ...before,
      compositions: [{ ...activeComposition(before), layers: [parent, child] }],
    };
  const nested = new EditorStore(project),
    s = frame(nested),
    ctx = createTransformContext(s, [child.id], {
      orientation: 'global',
      pivotMode: 'anchor',
    }),
    items = transformItems(ctx, { kind: 'rotate', angle: 90 });
  expect(
    nested.run(
      '旋转',
      transformEditCommands(project, s, items, 'rotate', 0, false),
    ).ok,
  ).toBe(true);
  expect(current(nested)[1]!.transform.scale.baseValue).toEqual({
    x: 2,
    y: 0.5,
  });
  expect(frame(nested).layers[1]!.matrix![1]).toBeCloseTo(2);
});

it('键盘nudge也共享Local/Global轴向；数值取消不留预览', () => {
  const raw = rectangle(),
    layer = {
      ...raw,
      transform: {
        ...raw.transform,
        rotation: { ...raw.transform.rotation, baseValue: 45 },
      },
    };
  const { store } = setup([layer]);
  act(() => store.nudge(10, 0));
  expect(current(store)[0]!.transform.position.baseValue.x).toBeCloseTo(
    400 + 10 * Math.SQRT1_2,
  );
  expect(current(store)[0]!.transform.position.baseValue.y).toBeCloseTo(
    200 + 10 * Math.SQRT1_2,
  );
  act(() => store.undo());
  act(() => store.setTransformSettings({ orientation: 'global' }));
  act(() => store.nudge(10, 0));
  expect(current(store)[0]!.transform.position.baseValue).toEqual({
    x: 410,
    y: 200,
  });
  const field = numeric('旋转（°）', '90');
  fireEvent.keyDown(field, { key: 'Escape' });
  expect(store.getSnapshot().propertyPreviews).toBeUndefined();
});

it('模式切换显示真实控制轴和支点，多选各自中心保留独立标记且不写工程', () => {
  const { store } = setup([rectangle(200, 200), rectangle(600, 200)]);
  const before = store.getSnapshot().project;
  fireEvent.change(screen.getByLabelText('变换轴向'), {
    target: { value: 'local' },
  });
  fireEvent.change(screen.getByLabelText('变换支点'), {
    target: { value: 'individual-origins' },
  });
  const overlay = screen.getByLabelText('变换控制器');
  expect(overlay).toHaveAttribute('data-orientation', 'local');
  expect(overlay.querySelectorAll('.pivot-marker')).toHaveLength(2);
  expect(overlay).toHaveAttribute('data-pivot', 'individual-origins');
  fireEvent.change(screen.getByLabelText('变换支点'), {
    target: { value: 'custom' },
  });
  expect(overlay.querySelectorAll('.pivot-marker')).toHaveLength(1);
  expect(overlay.querySelector('.custom-pivot-handle')).toBeTruthy();
  expect(overlay).toHaveAttribute('data-pivot', 'custom');
  fireEvent.click(screen.getByRole('button', { name: '锚点' }));
  expect(screen.getAllByLabelText('可拖动图层锚点')).toHaveLength(2);
  expect(overlay.querySelectorAll('.guide-anchor')).toHaveLength(2);
  expect(store.getSnapshot().project).toBe(before);
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(0);
});

it('CASE 6: 悬停九宫格预览真实右下支点和Ghost，离开恢复且不写Project或Undo', () => {
  const { store } = setup([rectangle(400, 200)]);
  const before = store.getSnapshot().project;
  const settings = store.getSnapshot().transformSettings;
  const button = screen.getByRole('button', { name: '支点：右下' });
  fireEvent.mouseEnter(button);
  const overlay = screen.getByLabelText('变换控制器');
  expect(overlay).toHaveAttribute('data-pivot', 'bottom-right');
  expect(overlay.querySelector('.guide-fixed circle')).toHaveAttribute(
    'cx',
    '450',
  );
  expect(overlay.querySelector('.guide-fixed circle')).toHaveAttribute(
    'cy',
    '250',
  );
  expect(overlay.querySelectorAll('.guide-ghost polygon')).toHaveLength(1);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.getSnapshot().transformSettings).toBe(settings);
  expect(store.commands.undoStack).toHaveLength(0);
  fireEvent.keyDown(button, { key: 'ArrowLeft' });
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  fireEvent.mouseLeave(button);
  expect(overlay).toHaveAttribute('data-pivot', settings.pivotMode);
  expect(overlay.querySelectorAll('.guide-ghost polygon')).toHaveLength(0);
  fireEvent.click(button);
  expect(store.getSnapshot().transformSettings.pivotMode).toBe('bottom-right');
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().transformSettings).toEqual(settings);
});
it('CASE 8: 数值实时缩放时底部支点固定，旋转显示角度和弧线，提交一次Scene Undo', () => {
  const { store } = setup([rectangle(400, 200)]);
  fireEvent.click(screen.getByRole('button', { name: '支点：下中' }));
  const before = store.getSnapshot().project;
  const scale = screen.getByLabelText('缩放 X（%）');
  fireEvent.focus(scale);
  fireEvent.change(scale, { target: { value: '180' } });
  const overlay = screen.getByLabelText('变换控制器');
  expect(overlay).toHaveAttribute('data-property', 'scale');
  expect(overlay.querySelector('.guide-fixed circle')).toHaveAttribute(
    'cy',
    '250',
  );
  expect(overlay.querySelectorAll('.guide-expansion').length).toBeGreaterThan(
    0,
  );
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.keyDown(scale, { key: 'Enter' });
  expect(
    store.commands.undoStack.filter((entry) => !entry.workspace),
  ).toHaveLength(1);
  act(() => store.undo());
  const rotation = screen.getByLabelText('旋转（°）');
  fireEvent.focus(rotation);
  fireEvent.change(rotation, { target: { value: '32.4' } });
  expect(overlay.querySelector('.guide-rotation text')?.textContent).toBe(
    '32.4°',
  );
  expect(overlay.querySelector('.guide-rotation path')).toHaveAttribute(
    'data-direction',
    'clockwise',
  );
  fireEvent.change(rotation, { target: { value: '-32.4' } });
  expect(overlay.querySelector('.guide-rotation path')).toHaveAttribute(
    'data-direction',
    'counterclockwise',
  );
  expect(overlay.querySelector('.guide-rotation text')?.textContent).toBe(
    '-32.4°',
  );
  fireEvent.keyDown(rotation, { key: 'Escape' });
  expect(store.getSnapshot().project).toEqual(before);
});

it('Custom Pivot: 100次移动仅更新引导预览，松开一次可撤销，Scene与原关键帧不变', () => {
  const { store } = setup([rectangle(400, 200)]);
  act(() =>
    store.setTransformSettings({
      pivotMode: 'custom',
      customPivot: { x: 400, y: 200 },
    }),
  );
  const before = store.getSnapshot().project;
  const handle = screen.getByRole('slider', { name: '拖动自定义支点' });
  fireEvent.pointerDown(handle, {
    button: 0,
    clientX: 400,
    clientY: 200,
    pointerId: 1,
  });
  for (let i = 1; i <= 100; i++)
    fireEvent.pointerMove(handle, {
      clientX: 400 - i,
      clientY: 200 + i,
      pointerId: 1,
    });
  expect(store.getSnapshot().transformSettings.customPivot).toEqual({
    x: 400,
    y: 200,
  });
  expect(store.commands.undoStack).toHaveLength(0);
  expect(
    guidanceFor(store).getSnapshot().referencePreview?.customPivot,
  ).toEqual({ x: 300, y: 300 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(store.getSnapshot().transformSettings.customPivot).toEqual({
    x: 300,
    y: 300,
  });
  expect(store.commands.undoStack).toHaveLength(1);
  expect(store.getSnapshot().project).toBe(before);
  act(() => store.undo());
  expect(store.getSnapshot().transformSettings.customPivot).toEqual({
    x: 400,
    y: 200,
  });
  act(() => store.redo());
  expect(store.getSnapshot().transformSettings.customPivot).toEqual({
    x: 300,
    y: 300,
  });
});

it('Custom Pivot: 播放时间改变时丢弃未提交拖动', () => {
  const { store } = setup([rectangle(400, 200)]);
  act(() =>
    store.setTransformSettings({
      pivotMode: 'custom',
      customPivot: { x: 400, y: 200 },
    }),
  );
  const handle = screen.getByRole('slider', { name: '拖动自定义支点' });
  fireEvent.pointerDown(handle, {
    button: 0,
    clientX: 400,
    clientY: 200,
    pointerId: 1,
  });
  fireEvent.pointerMove(handle, { clientX: 300, clientY: 300, pointerId: 1 });
  act(() => store.setTime(1));
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(store.getSnapshot().transformSettings.customPivot).toEqual({
    x: 400,
    y: 200,
  });
  expect(store.commands.undoStack).toHaveLength(0);
  expect(guidanceFor(store).getSnapshot().referencePreview).toBeUndefined();
});
