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
  expect(store.commands.undoStack).toHaveLength(1);
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
  expect(store.commands.undoStack).toHaveLength(1);
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
  expect(store.commands.undoStack).toHaveLength(1);
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
  expect(store.commands.undoStack).toHaveLength(1);
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
  expect(store.getSnapshot().transformSettings.customPivot).toEqual({
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
  expect(store.commands.undoStack).toHaveLength(0);
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
  expect(store.commands.undoStack).toHaveLength(0);
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
