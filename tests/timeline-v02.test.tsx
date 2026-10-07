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
import { App } from '../src/ui/App';
import { Timeline } from '../src/ui/Timeline';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createComposition,
  createLayer,
} from '../src/core/project-model';
import { newId } from '../src/core/core-types';
import { evaluateProperty } from '../src/core/animation-engine';
import { copyFrames, pasteFrames } from '../src/core/editing-commands';
import { timelineReorderCommands } from '../src/core/timeline-reorder';
import {
  formatTimecode,
  frameToTime,
  timeToFrame,
  timelineTicks,
} from '../src/core/timeline-time';
import { loadProject, saveProject } from '../src/core/project-io';
import { openTimelineLayers } from './timeline-test-helpers';

beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function fixture(count = 1, times = [0, 1, 2]) {
  const p = createDefaultProject();
  const layers = Array.from({ length: count }, (_, i) => {
    const l = createLayer('rectangle', { name: `图层 ${i + 1}` });
    return {
      ...l,
      editor: { ...l.editor!, outPoint: 5 },
      transform: {
        ...l.transform,
        position: {
          ...l.transform.position,
          keyframes: times.map((time) => ({
            id: newId(),
            time,
            value: { x: time * 100, y: 100 },
            interpolation: { type: 'linear' as const },
          })),
        },
      },
    };
  });
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, duration: 5, layers })),
  });
  const layer = layers[0]!,
    property = layer.transform.position;
  return {
    store,
    layers,
    layer,
    property,
    current: () => activeComposition(store.getSnapshot().project),
  };
}
function bounds(el: Element, left = 0, top = 0, width = 500, height = 28) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  });
}
it('帧时间往返、时间码进位和缩放刻度密度保持一致', () => {
  for (const fps of [24, 25, 30, 60]) {
    for (let frame = 0; frame < 10000; frame += 13)
      expect(timeToFrame(frameToTime(frame, fps), fps)).toBe(frame);
    expect(formatTimecode(60 - 0.1 / fps, fps)).toBe('00:01:00:00');
    for (const width of [400, 1000, 8000]) {
      const ticks = timelineTicks(5, fps, width),
        majors = ticks.filter((t) => t.major);
      expect(majors.length).toBeLessThanOrEqual(width / 70 + 2);
      expect(
        ticks.every(
          (t) => Math.abs(t.time * fps - Math.round(t.time * fps)) < 1e-8,
        ),
      ).toBe(true);
    }
  }
});
it('多图层排序保留内部顺序，一次撤销/重做，不改输入工程', () => {
  const { store, layers, current } = fixture(4),
    before = store.getSnapshot().project;
  store.run(
    '排序',
    timelineReorderCommands(
      current(),
      [layers[1]!.id, layers[2]!.id],
      layers[3]!.id,
      false,
    ),
  );
  expect([...current().layers].reverse().map((l) => l.id)).toEqual([
    layers[2]!.id,
    layers[1]!.id,
    layers[3]!.id,
    layers[0]!.id,
  ]);
  expect(before.compositions[0]!.layers.map((l) => l.id)).toEqual(
    layers.map((l) => l.id),
  );
  expect(store.commands.undoStack).toHaveLength(1);
  store.undo();
  expect(store.getSnapshot().project).toEqual(before);
  store.redo();
  expect(current().layers[1]!.id).toBe(layers[3]!.id);
});
it('跨属性粘贴保持相对时间与插值，并拒绝不兼容、超时长或锁定目标', () => {
  const { store, property, layer, current } = fixture(1, [0, 1]);
  const copied = copyFrames(
    store.getSnapshot().project,
    property.keyframes.map((k) => ({
      propertyId: property.id,
      keyframeId: k.id,
    })),
  );
  const before = store.getSnapshot().project;
  store.run(
    '粘贴',
    pasteFrames(before, copied, 3, [], [layer.transform.scale.id]),
  );
  expect(
    current().layers[0]!.transform.scale.keyframes.map((k) => k.time),
  ).toEqual([3, 4]);
  expect(
    current().layers[0]!.transform.scale.keyframes.map((k) => k.value),
  ).toEqual(property.keyframes.map((k) => k.value));
  expect(store.commands.undoStack).toHaveLength(1);
  store.undo();
  expect(store.getSnapshot().project).toEqual(before);
  expect(() =>
    pasteFrames(before, copied, 3, [], [layer.transform.opacity.id]),
  ).toThrow('不兼容');
  expect(() => pasteFrames(before, copied, 5, [], [property.id])).toThrow(
    '超出',
  );
  const locked = {
    ...before,
    compositions: before.compositions.map((c) => ({
      ...c,
      layers: c.layers.map((l) => ({ ...l, locked: true })),
    })),
  };
  expect(() => pasteFrames(locked, copied, 3, [], [property.id])).toThrow(
    '锁定',
  );
});
it('A/I：框选0/1/2秒，200次move预览不写Scene，整体移动一步Undo/Redo', () => {
  const { store, property, current } = fixture();
  render(<Timeline store={store} />);
  openTimelineLayers();
  const track = document.querySelector('.keyframe-track')!,
    scroll = document.querySelector('.timeline-scroll')!;
  bounds(track);
  const buttons = [...track.querySelectorAll('button[data-frame]')];
  buttons.forEach((button, i) => bounds(button, i * 100, 30, 16, 16));
  fireEvent.pointerDown(track, { button: 0, clientX: 0, clientY: 28 });
  fireEvent.pointerMove(scroll, { clientX: 220, clientY: 50 });
  fireEvent.pointerUp(scroll, { clientX: 220, clientY: 50 });
  expect(store.getSnapshot().frames).toHaveLength(3);
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(buttons[0]!, { button: 0, clientX: 0 });
  for (let i = 1; i <= 200; i++)
    fireEvent.pointerMove(window, { clientX: i / 2 });
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(window, { clientX: 100 });
  expect(
    current().layers[0]!.transform.position.keyframes.map((k) => k.time),
  ).toEqual([1, 2, 3]);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  act(() => store.redo());
  expect(current().layers[0]!.transform.position.keyframes[2]!.time).toBe(3);
  expect(store.getSnapshot().frames.map((ref) => ref.keyframeId)).toEqual(
    property.keyframes.map((k) => k.id),
  );
});
it('Shift点击移除关键帧不拖动剩余帧；空白点击清空关键帧但保留图层', () => {
  const { store, layer, property } = fixture();
  store.select(layer.id);
  store.selectFrames(
    property.keyframes.map((k) => ({
      propertyId: property.id,
      keyframeId: k.id,
    })),
  );
  render(<Timeline store={store} />);
  openTimelineLayers();
  const button = screen.getByRole('button', {
    name: '关键帧 图层 1 位置 1.000 秒',
  });
  fireEvent.pointerDown(button, { button: 0, shiftKey: true, clientX: 100 });
  fireEvent.pointerUp(window, { clientX: 300 });
  expect(store.getSnapshot().frames).toHaveLength(2);
  expect(store.commands.undoStack).toHaveLength(0);
  const track = document.querySelector('.keyframe-track')!;
  bounds(track);
  fireEvent.click(track, { clientX: 50 });
  expect(store.getSnapshot().frames).toHaveLength(0);
  expect(store.getSnapshot().selection).toEqual([layer.id]);
});
it('Alt拖动预览不写Scene，复制后选中新帧，一步撤销', () => {
  const { store, layer, property, current } = fixture(1, [0, 1]);
  store.select(layer.id);
  store.selectFrames(
    property.keyframes.map((k) => ({
      propertyId: property.id,
      keyframeId: k.id,
    })),
  );
  render(<Timeline store={store} />);
  openTimelineLayers();
  const button = screen.getByRole('button', {
    name: '关键帧 图层 1 位置 0.000 秒',
  });
  bounds(button.parentElement!);
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(button, { button: 0, altKey: true, clientX: 0 });
  fireEvent.pointerMove(window, { clientX: 200 });
  expect(document.querySelectorAll('.duplicate-keyframe-ghost')).toHaveLength(
    2,
  );
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(window, { clientX: 200 });
  expect(
    current().layers[0]!.transform.position.keyframes.map((k) => k.time),
  ).toEqual([0, 1, 2, 3]);
  expect(
    store
      .getSnapshot()
      .frames.every(
        (ref) => !property.keyframes.some((k) => k.id === ref.keyframeId),
      ),
  ).toBe(true);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('D：快速拖动播放头实时求值且不写工程或历史，DOM关键帧保持身份', () => {
  const { store, current } = fixture(1, [0, 5]);
  render(<Timeline store={store} />);
  openTimelineLayers();
  const ruler = screen.getByRole('slider', { name: '播放头' });
  bounds(ruler);
  const before = store.getSnapshot().project,
    key = document.querySelector('[data-frame]');
  fireEvent.pointerDown(ruler, { button: 0, clientX: 0 });
  for (let x = 1; x <= 500; x += 7)
    fireEvent.pointerMove(ruler, { clientX: x });
  fireEvent.pointerMove(ruler, { clientX: 500 });
  fireEvent.pointerUp(ruler, { clientX: 500 });
  expect(store.getSnapshot().time).toBe(5);
  expect(evaluateProperty(current().layers[0]!.transform.position, 5)).toEqual({
    x: 500,
    y: 100,
  });
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
  expect(document.querySelector('[data-frame]')).toBe(key);
});
it('F/G：上下文EaseOut只作用实际选中段，Graph返回共享插值、Undo恢复', () => {
  const { store, layer, property, current } = fixture();
  store.select(layer.id);
  store.selectFrames(
    property.keyframes
      .slice(0, 2)
      .map((k) => ({ propertyId: property.id, keyframeId: k.id })),
  );
  render(<Timeline store={store} />);
  openTimelineLayers();
  const before = store.getSnapshot().project;
  fireEvent.contextMenu(
    screen.getByRole('button', { name: '关键帧 图层 1 位置 0.000 秒' }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: '缓出' }));
  let p = current().layers[0]!.transform.position;
  expect(evaluateProperty(p, 0.5).x).toBeGreaterThan(50);
  expect(evaluateProperty(p, 1.5).x).toBeCloseTo(150);
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  expect(document.querySelector('.timeline-scroll')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '缓入' }));
  fireEvent.click(screen.getByRole('tab', { name: '时间轴' }));
  p = current().layers[0]!.transform.position;
  expect(evaluateProperty(p, 0.5).x).toBeLessThan(50);
  expect(
    screen.getByRole('button', { name: '关键帧 图层 1 位置 0.000 秒' }),
  ).toHaveAttribute('data-easing', 'bezier');
  act(() => {
    store.undo();
    store.undo();
  });
  expect(store.getSnapshot().project).toEqual(before);
});
it('H/J：独立裁入1秒裁出4秒，关键帧不变；保存重开仅持久化Scene', () => {
  const { store, layer, property, current } = fixture();
  render(<Timeline store={store} />);
  openTimelineLayers();
  const bar = screen.getByLabelText(`${layer.name}时间范围`);
  bounds(bar.parentElement!);
  fireEvent.pointerDown(bar.querySelector('[data-edge=start]')!, {
    button: 0,
    clientX: 0,
  });
  fireEvent.pointerUp(window, { clientX: 100 });
  fireEvent.pointerDown(bar.querySelector('[data-edge=end]')!, {
    button: 0,
    clientX: 500,
  });
  fireEvent.pointerUp(window, { clientX: 400 });
  expect(current().layers[0]!.editor).toMatchObject({
    inPoint: 1,
    outPoint: 4,
  });
  expect(current().layers[0]!.transform.position.keyframes).toEqual(
    property.keyframes,
  );
  expect(store.commands.undoStack).toHaveLength(2);
  const json = saveProject(store.getSnapshot().project),
    reopened = loadProject(json);
  expect(reopened).toEqual(store.getSnapshot().project);
  expect(json).not.toMatch(
    /selectedProperties|timelineZoom|treeWidth|expanded/,
  );
  act(() => store.undo());
  expect(current().layers[0]!.editor!.outPoint).toBe(5);
  act(() => store.undo());
  expect(current().layers[0]!.editor!.inPoint).toBe(0);
});
it('所选属性归属正确，Graph不误编辑多选中的首个图层', () => {
  const { store, layers, current } = fixture(2);
  store.select(layers[0]!.id);
  store.selectProperties([layers[1]!.transform.position.id]);
  render(<Timeline store={store} />);
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  fireEvent.click(screen.getByRole('button', { name: '关键帧 K1' }));
  fireEvent.click(screen.getByRole('button', { name: '缓出' }));
  expect(
    evaluateProperty(current().layers[0]!.transform.position, 0.5).x,
  ).toBeCloseTo(50);
  expect(
    evaluateProperty(current().layers[1]!.transform.position, 0.5).x,
  ).toBeGreaterThan(50);
});
it('Timeline搜索输入屏蔽P/S/R/T/Delete，快捷过滤只在Timeline焦点内触发', () => {
  const { store, layer } = fixture();
  store.select(layer.id);
  render(<App store={store} />);
  const search = screen.getByLabelText('搜索时间轴属性');
  fireEvent.keyDown(search, { key: 'p' });
  fireEvent.keyDown(search, { key: 'Delete' });
  expect(store.getSnapshot().propertyFilter).toBe('all');
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(1);
  fireEvent.keyDown(window, { key: 's' });
  expect(store.getSnapshot().propertyFilter).toBe('all');
  fireEvent.keyDown(screen.getByRole('region', { name: '时间轴' }), {
    key: 'p',
  });
  expect(store.getSnapshot().propertyFilter).toBe('position');
});
it('列宽工作区持久化，Cursor zoom保持鼠标处时间，Fit复原且不写历史', () => {
  const { store } = fixture();
  render(<Timeline store={store} />);
  const scroll = document.querySelector('.timeline-scroll') as HTMLElement;
  bounds(scroll, 0, 0, 1000, 300);
  Object.defineProperty(scroll, 'clientWidth', { value: 1000 });
  fireEvent.wheel(scroll, {
    ctrlKey: true,
    clientX: 402.4,
    deltaY: -346.5735902799726,
  });
  expect(store.getSnapshot().timelineZoom).toBeCloseTo(2);
  expect(scroll.scrollLeft).toBeCloseTo(142.4);
  fireEvent.click(screen.getByRole('button', { name: '适合合成时长' }));
  expect(scroll.scrollLeft).toBe(0);
  expect(store.getSnapshot().timelineZoom).toBe(1);
  fireEvent.keyDown(screen.getByRole('separator', { name: '时间轴属性列宽' }), {
    key: 'ArrowRight',
  });
  expect(localStorage.getItem('motion.timeline-tree-width')).toBe('270');
  expect(store.commands.undoStack).toHaveLength(0);
});

it('B：Rectangle/Text/Image都有位置缩放透明度动画，切换Animated Only恢复全部属性', () => {
  const p = createDefaultProject(),
    assetId = newId();
  const layers = [
    createLayer('rectangle'),
    createLayer('text'),
    createLayer('image', { assetId }),
  ];
  const store = new EditorStore({
    ...p,
    assets: [
      {
        id: assetId,
        name: 'test.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,AQIDBA==',
      },
    ],
    compositions: p.compositions.map((c) => ({ ...c, duration: 5, layers })),
  });
  for (const layer of layers)
    for (const prop of [
      layer.transform.position,
      layer.transform.scale,
      layer.transform.opacity,
    ]) {
      store.setTime(0);
      store.recordPropertyKeyframe(prop.id);
      store.setTime(1);
      store.recordPropertyKeyframe(prop.id);
    }
  render(<Timeline store={store} />);
  openTimelineLayers();
  const all = document.querySelectorAll('.timeline-row').length;
  fireEvent.change(screen.getByLabelText('时间轴属性筛选'), {
    target: { value: 'animated' },
  });
  expect(document.querySelectorAll('.timeline-row')).toHaveLength(9);
  expect(document.querySelectorAll('[data-frame]')).toHaveLength(18);
  fireEvent.change(screen.getByLabelText('时间轴属性筛选'), {
    target: { value: 'all' },
  });
  expect(document.querySelectorAll('.timeline-row')).toHaveLength(all);
});
it('Inspector/Timeline共用记录命令，非整帧播放时间不会生成重复帧；删除最后一帧恢复baseValue', () => {
  const { store, property, current } = fixture(1, [0]);
  store.setTime(0.012);
  store.recordPropertyKeyframe(property.id);
  expect(current().layers[0]!.transform.position.keyframes).toHaveLength(1);
  expect(current().layers[0]!.transform.position.keyframes[0]!.time).toBe(0);
  store.setTime(0.051);
  store.run('Inspector编辑', [
    store.valueCommand(property.id, { x: 42, y: 99 }),
  ]);
  expect(current().layers[0]!.transform.position.keyframes[1]!.time).toBe(
    2 / 30,
  );
  store.selectFrames(
    current().layers[0]!.transform.position.keyframes.map((k) => ({
      propertyId: property.id,
      keyframeId: k.id,
    })),
  );
  store.deleteSelected();
  expect(current().layers[0]!.transform.position.keyframes).toHaveLength(0);
  expect(evaluateProperty(current().layers[0]!.transform.position, 3)).toEqual(
    property.baseValue,
  );
  store.undo();
  expect(current().layers[0]!.transform.position.keyframes).toHaveLength(2);
});
it('Graph返回后滚轮仍保持时间锚点，中键平移不跳时间，预览取消恢复', () => {
  const { store, layer } = fixture();
  store.select(layer.id);
  render(<Timeline store={store} />);
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  fireEvent.click(screen.getByRole('tab', { name: '时间轴' }));
  const scroll = document.querySelector('.timeline-scroll') as HTMLElement;
  bounds(scroll, 0, 0, 1000, 300);
  Object.defineProperty(scroll, 'clientWidth', { value: 1000 });
  fireEvent.wheel(scroll, {
    ctrlKey: true,
    clientX: 402.4,
    deltaY: -346.5735902799726,
  });
  expect(scroll.scrollLeft).toBeCloseTo(142.4);
  fireEvent.pointerDown(scroll, { button: 1, clientX: 500 });
  fireEvent.pointerMove(scroll, { clientX: 400 });
  fireEvent.pointerUp(scroll, { clientX: 400 });
  expect(scroll.scrollLeft).toBeCloseTo(242.4);
  expect(store.getSnapshot().time).toBe(0);
  const ruler = screen.getByRole('slider', { name: '播放头' });
  bounds(ruler);
  fireEvent.pointerDown(ruler, { button: 0, clientX: 100 });
  fireEvent.lostPointerCapture(ruler);
  fireEvent.pointerUp(window, { clientX: 400 });
  expect(store.getSnapshot().time).toBe(4);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('键盘前后关键帧优先所选属性，未指定时只跳可见轨道', () => {
  const { store, property } = fixture();
  render(<App store={store} />);
  const panel = screen.getByRole('region', { name: '时间轴' });
  fireEvent.keyDown(panel, { key: 'k' });
  expect(store.getSnapshot().time).toBe(0);
  act(() => store.selectProperties([property.id]));
  fireEvent.keyDown(panel, { key: 'k' });
  expect(store.getSnapshot().time).toBe(1);
  fireEvent.keyDown(panel, { key: 'j' });
  expect(store.getSnapshot().time).toBe(0);
});
it('图层排序使用Pointer捕获，保留多选顺序，200次预览无写入，释放一笔事务', () => {
  const { store, layers, current } = fixture(4);
  store.select(layers[1]!.id);
  store.select(layers[2]!.id, true);
  render(<Timeline store={store} />);
  const headings = [...document.querySelectorAll('.timeline-layer-heading')];
  headings.forEach((h, i) => bounds(h, 0, i * 28, 1000, 28));
  const selectedName = document.querySelector(
    `[data-layer="${layers[2]!.id}"] .timeline-layer-name`,
  )!;
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(selectedName, { button: 0, clientX: 100, clientY: 42 });
  for (let i = 0; i < 200; i++)
    fireEvent.pointerMove(window, { clientX: 100, clientY: 5 });
  expect(store.getSnapshot().project).toBe(before);
  expect(headings[0]).toHaveAttribute('data-insertion', 'before');
  fireEvent.pointerUp(window, { clientX: 100, clientY: 5 });
  expect([...current().layers].reverse().map((l) => l.id)).toEqual([
    layers[2]!.id,
    layers[1]!.id,
    layers[3]!.id,
    layers[0]!.id,
  ]);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('Pointer捕获后双击label仍重命名，Enter一笔提交，Esc不提交；预合成双击与Canvas面包屑同步', () => {
  const p = createDefaultProject(),
    child = createComposition({ name: '嵌套动画', duration: 5 });
  const layer = createLayer('rectangle', { name: '原名称' }),
    nested = createLayer('precomp', {
      name: '子合成层',
      compositionId: child.id,
    });
  const store = new EditorStore({
    ...p,
    compositions: [
      ...p.compositions.map((c) => ({ ...c, layers: [layer, nested] })),
      child,
    ],
  });
  render(<App store={store} />);
  const label = document.querySelector(
    `[data-layer="${layer.id}"] .timeline-layer-label`,
  )!;
  fireEvent.doubleClick(label);
  fireEvent.change(screen.getByLabelText('时间轴图层名称'), {
    target: { value: '新名称' },
  });
  fireEvent.keyDown(screen.getByLabelText('时间轴图层名称'), { key: 'Enter' });
  expect(activeComposition(store.getSnapshot().project).layers[0]!.name).toBe(
    '新名称',
  );
  expect(store.commands.undoStack).toHaveLength(1);
  fireEvent.doubleClick(label);
  fireEvent.change(screen.getByLabelText('时间轴图层名称'), {
    target: { value: '丢弃名称' },
  });
  fireEvent.keyDown(screen.getByLabelText('时间轴图层名称'), { key: 'Escape' });
  expect(activeComposition(store.getSnapshot().project).layers[0]!.name).toBe(
    '新名称',
  );
  expect(store.commands.undoStack).toHaveLength(1);
  fireEvent.doubleClick(
    document.querySelector(
      `[data-layer="${nested.id}"] .timeline-layer-label`,
    )!,
  );
  expect(store.getSnapshot().project.activeCompositionId).toBe(child.id);
  expect(
    screen.getByRole('button', { name: '返回合成 合成 01' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回合成 合成 01' }));
  expect(store.getSnapshot().project.activeCompositionId).toBe(
    p.activeCompositionId,
  );
});
