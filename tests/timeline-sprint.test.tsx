// @vitest-environment jsdom
import { expect, it, vi, beforeAll, afterEach } from 'vitest';
import {
  act,
  render,
  screen,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { newId } from '../src/core/core-types';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function rect(el: Element) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 500,
    bottom: 30,
    width: 500,
    height: 30,
    toJSON: () => ({}),
  });
}
function setup() {
  const p = createDefaultProject(),
    raw = createLayer('rectangle');
  const position = {
    ...raw.transform.position,
    keyframes: [1, 2].map((time) => ({
      id: newId(),
      time,
      value: { x: 400 + time * 10, y: 200 },
      interpolation: { type: 'linear' as const },
    })),
  };
  const layer = { ...raw, transform: { ...raw.transform, position } };
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({
      ...c,
      duration: 5,
      layers: [layer],
    })),
  });
  store.select(layer.id);
  render(<App store={store} />);
  return { store, layer, position };
}
it('多选关键帧100次拖动只提交一次，预览与实际提交均夹到边界并可撤销', () => {
  const { store, position } = setup();
  act(() =>
    store.selectFrames(
      position.keyframes.map((k) => ({
        propertyId: position.id,
        keyframeId: k.id,
      })),
    ),
  );
  const frame = screen.getByRole('button', {
    name: '关键帧 矩形 位置 1.000 秒',
  });
  rect(frame.parentElement!);
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(frame, { button: 0, clientX: 100 });
  for (let i = 0; i < 100; i++)
    fireEvent.pointerMove(frame, { clientX: 1000 + i });
  expect(store.getSnapshot().project).toBe(before);
  expect(frame.style.left).toBe('80%');
  fireEvent.pointerUp(frame, { clientX: 1099 });
  expect(
    activeComposition(
      store.getSnapshot().project,
    ).layers[0]!.transform.position.keyframes.map((k) => k.time),
  ).toEqual([4, 5]);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('关键帧吸附播放头；Escape取消，丢失按钮捕获仍由窗口完成；播放头取消恢复时间', () => {
  const { store } = setup();
  act(() => store.setTime(3.05));
  const frame = screen.getByRole('button', {
    name: '关键帧 矩形 位置 1.000 秒',
  });
  rect(frame.parentElement!);
  fireEvent.pointerDown(frame, { button: 0, clientX: 100 });
  fireEvent.pointerMove(frame, { clientX: 300 });
  expect(screen.getByLabelText('关键帧吸附参考线')).toBeInTheDocument();
  fireEvent.keyDown(frame, { key: 'Escape' });
  fireEvent.pointerUp(frame);
  expect(store.commands.undoStack).toHaveLength(0);
  fireEvent.pointerDown(frame, { button: 0, clientX: 100 });
  fireEvent.pointerMove(frame, { clientX: 300 });
  fireEvent.lostPointerCapture(frame);
  fireEvent.pointerUp(window, { clientX: 300 });
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  const ruler = screen.getByRole('slider', { name: '播放头' });
  rect(ruler);
  fireEvent.pointerDown(ruler, { button: 0, clientX: 50 });
  fireEvent.pointerMove(ruler, { clientX: 200 });
  expect(store.getSnapshot().time).toBe(2);
  fireEvent.keyDown(ruler, { key: 'Escape' });
  fireEvent.pointerUp(ruler);
  expect(store.getSnapshot().time).toBe(3.05);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('首次选择关键帧并在窗口释放，使用最终坐标而非缺失的中间移动，一次Undo', () => {
  const { store, position } = setup();
  const frame = screen.getByRole('button', {
    name: '关键帧 矩形 位置 1.000 秒',
  });
  rect(frame.parentElement!);
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(frame, { button: 0, clientX: 100 });
  fireEvent.pointerUp(window, { clientX: 150 });
  expect(
    activeComposition(
      store.getSnapshot().project,
    ).layers[0]!.transform.position.keyframes.find(
      (k) => k.id === position.keyframes[0]!.id,
    )!.time,
  ).toBe(1.5);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('图层时间条越界拖动保持有效范围；右键不会启动移动', () => {
  const { store, layer } = setup();
  const bar = screen.getByLabelText(`${layer.name}时间范围`);
  rect(bar.parentElement!);
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(bar, { button: 2, clientX: 100 });
  fireEvent.pointerMove(bar, { clientX: 200 });
  fireEvent.pointerUp(bar);
  expect(store.getSnapshot().project).toBe(before);
  const start = bar.querySelector('[data-edge="start"]')!;
  fireEvent.pointerDown(start, { button: 0, clientX: 0 });
  fireEvent.pointerMove(bar, { clientX: 1000 });
  expect(parseFloat(bar.style.width)).toBeGreaterThan(0);
  fireEvent.pointerUp(bar);
  const edited = activeComposition(store.getSnapshot().project).layers[0]!
    .editor!;
  expect(edited.inPoint).toBeCloseTo(5 - 1 / 30);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('播放头更新不重建轨道，新增关键帧仍读取实时播放头；命中关键帧时刷新控件', () => {
  const { store, position } = setup();
  const track = document.querySelector('.keyframe-track')!;
  const key = track.querySelector('[data-frame]');
  act(() => store.setTime(0.3));
  act(() => store.setTime(0.6));
  expect(track.querySelector('[data-frame]')).toBe(key);
  expect(document.querySelector('.timeline-panel')).toHaveStyle(
    '--timeline-playhead: 12%',
  );
  fireEvent.click(screen.getByRole('button', { name: /添加 .* 位置 关键帧/ }));
  expect(
    activeComposition(
      store.getSnapshot().project,
    ).layers[0]!.transform.position.keyframes.some((f) => f.time === 0.6),
  ).toBe(true);
  act(() => store.setTime(1));
  expect(
    screen.getByRole('button', { name: /添加 .* 位置 关键帧/ }),
  ).toBeDisabled();
  expect(
    document.querySelector(`[data-frame="${position.keyframes[0]!.id}"]`),
  ).toHaveClass('current');
});
