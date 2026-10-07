import { layerEffects } from '../src/core/compositing-migration';
// @vitest-environment jsdom
import { openTimelineLayers } from './timeline-test-helpers';
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
import { command } from '../src/core/command-system';
import { evaluateProperty } from '../src/core/animation-engine';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup() {
  const store = new EditorStore(createDefaultProject()),
    layer = createLayer('rectangle');
  store.run('准备', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer,
    }),
  ]);
  store.select(layer.id);
  render(<App store={store} />);
  openTimelineLayers();
  return { store, layer };
}
it('scrub 在松手前只预览，单笔提交；Escape 恢复工程和历史', () => {
  const { store, layer } = setup(),
    before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  const label = screen.getByText('位置 X', { selector: '.scrub-label' });
  fireEvent.pointerDown(label, { button: 0, clientX: 10 });
  fireEvent.pointerMove(label, { clientX: 35 });
  expect(store.getSnapshot().project).toBe(before);
  expect(store.getRenderProject()).not.toBe(before);
  expect(store.commands.undoStack).toHaveLength(count);
  fireEvent.pointerUp(label);
  expect(store.commands.undoStack).toHaveLength(count + 1);
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.position
      .baseValue.x,
  ).toBe(layer.transform.position.baseValue.x + 25);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  fireEvent.pointerDown(label, { button: 0, clientX: 10 });
  fireEvent.pointerMove(label, { clientX: 50 });
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.pointerUp(label);
  expect(store.getSnapshot().project).toEqual(before);
  expect(store.getRenderProject()).toBe(store.getSnapshot().project);
  expect(store.commands.undoStack).toHaveLength(count);
});
it('scrub 时间变化取消过期编辑，动画修改只记录当前时间的一个关键帧', () => {
  const { store, layer } = setup();
  act(() => store.togglePropertyAnimation(layer.transform.position.id));
  act(() => store.setTime(1));
  const label = screen.getByText('位置 X', { selector: '.scrub-label' }),
    count = store.commands.undoStack.length;
  fireEvent.pointerDown(label, { button: 0, clientX: 10 });
  fireEvent.pointerMove(label, { clientX: 40 });
  fireEvent.pointerUp(label);
  const p = activeComposition(store.getSnapshot().project).layers[0]!.transform
    .position;
  expect(p.keyframes).toHaveLength(2);
  expect(evaluateProperty(p, 1).x).toBe(990);
  expect(store.commands.undoStack).toHaveLength(count + 1);
  fireEvent.pointerDown(label, { button: 0, clientX: 10 });
  fireEvent.pointerMove(label, { clientX: 40 });
  act(() => store.setTime(2));
  fireEvent.pointerUp(label);
  expect(store.commands.undoStack).toHaveLength(count + 1);
});
it('工具快捷键遵循画布/时间轴/文字焦点，并支持命令搜索', () => {
  const { store } = setup();
  const canvas = screen.getByRole('region', { name: '画布区域' }),
    timeline = screen.getByRole('region', { name: '时间轴' });
  canvas.focus();
  fireEvent.keyDown(canvas, { key: 'r' });
  expect(screen.getByRole('button', { name: '矩形工具' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  timeline.focus();
  fireEvent.keyDown(timeline, { key: 'p' });
  expect(screen.getByLabelText('时间轴属性筛选')).toHaveValue('position');
  const name = screen.getByLabelText('图层名称');
  name.focus();
  fireEvent.keyDown(name, { key: 'v' });
  expect(screen.getByRole('button', { name: '矩形工具' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.keyDown(name, { key: 'k', ctrlKey: true });
  expect(screen.getByRole('dialog', { name: '命令搜索' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '搜索命令' }), {
    target: { value: 'blur' },
  });
  fireEvent.keyDown(screen.getByRole('textbox', { name: '搜索命令' }), {
    key: 'Enter',
  });
  expect(screen.queryByRole('dialog', { name: '命令搜索' })).toBeNull();
  expect(
    layerEffects(activeComposition(store.getSnapshot().project).layers[0]!).at(
      -1,
    )?.kind,
  ).toBe('gaussianBlur');
});
it('画布拖动创建与取消均不产生过程中的正式工程修改', () => {
  const { store } = setup(),
    canvas = screen.getByTestId('canvas');
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
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  fireEvent.click(screen.getByRole('button', { name: '椭圆工具' }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { clientX: 400, clientY: 300 });
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(canvas);
  expect(activeComposition(store.getSnapshot().project).layers[1]!.width).toBe(
    300,
  );
  expect(store.commands.undoStack).toHaveLength(count + 1);
  fireEvent.click(screen.getByRole('button', { name: '矩形工具' }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas, { clientX: 400, clientY: 300 });
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.pointerUp(canvas);
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(2);
  expect(store.commands.undoStack).toHaveLength(count + 1);
});
it('多关键帧拖动保留选中集合，取消不修改；Graph 替代轨道', () => {
  const { store, layer } = setup();
  act(() => {
    store.togglePropertyAnimation(layer.transform.position.id);
    store.setTime(1);
    store.run('结束位置', [
      store.valueCommand(layer.transform.position.id, { x: 1200, y: 540 }),
    ]);
  });
  const first = screen.getByRole('button', {
      name: '关键帧 矩形 位置 0.000 秒',
    }),
    second = screen.getByRole('button', { name: '关键帧 矩形 位置 1.000 秒' });
  fireEvent.click(first);
  fireEvent.click(second, { shiftKey: true });
  expect(store.getSnapshot().frames).toHaveLength(2);
  vi.spyOn(first.parentElement!, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 500,
    bottom: 30,
    x: 0,
    y: 0,
    width: 500,
    height: 30,
    toJSON: () => ({}),
  });
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(first, { button: 0, clientX: 0 });
  expect(store.getSnapshot().frames).toHaveLength(2);
  fireEvent.pointerMove(first, { clientX: 50 });
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.pointerUp(first);
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  expect(screen.getByRole('img', { name: '动画值曲线' })).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '矩形 位置 轨道' })).toBeNull();
});
it('面板分隔线只修改独立布局，取消恢复且可持久化', () => {
  const { store } = setup(),
    separator = screen.getByRole('separator', { name: '调整左面板大小' }),
    before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  fireEvent.pointerDown(separator, { button: 0, clientX: 220 });
  fireEvent.pointerMove(separator, { clientX: 300 });
  expect(separator).toHaveAttribute('aria-valuenow', '300');
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.pointerUp(separator);
  expect(separator).toHaveAttribute('aria-valuenow', '220');
  fireEvent.keyDown(separator, { key: 'ArrowRight' });
  expect(JSON.parse(localStorage.getItem('motion.workspace.v1')!).left).toBe(
    230,
  );
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(count);
});
it('钢笔多点路径只在确认时提交，并提供可见描边', () => {
  const { store } = setup(),
    canvas = screen.getByTestId('canvas'),
    before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
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
  fireEvent.click(screen.getByRole('button', { name: '钢笔工具' }));
  for (const [clientX, clientY] of [
    [100, 100],
    [300, 200],
    [400, 100],
  ]) {
    fireEvent.pointerDown(canvas, { button: 0, clientX, clientY });
    fireEvent.pointerUp(canvas);
  }
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.keyDown(screen.getByRole('region', { name: '画布区域' }), {
    key: 'Enter',
  });
  const layer = activeComposition(store.getSnapshot().project).layers[1]!;
  expect(layer.type).toBe('shape');
  expect(layer.editor?.pathClosed).toBe(false);
  expect(layer.editor?.properties.path?.baseValue).toHaveLength(18);
  expect(layer.editor?.properties.strokeWidth?.baseValue).toBe(2);
  expect(store.commands.undoStack).toHaveLength(count + 1);
});
it('从末尾关键帧打开 Graph 时定位前一区间，保留可编辑速度输入', () => {
  const { store, layer } = setup();
  act(() => {
    store.togglePropertyAnimation(layer.transform.position.id);
    store.setTime(1);
    store.run('结束位置', [
      store.valueCommand(layer.transform.position.id, { x: 1200, y: 540 }),
    ]);
  });
  fireEvent.click(
    screen.getByRole('button', { name: '关键帧 矩形 位置 1.000 秒' }),
  );
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  expect(screen.getByRole('button', { name: '缓入缓出' })).toBeEnabled();
  expect(screen.getByLabelText('出影响比例（%）')).toBeInTheDocument();
});
