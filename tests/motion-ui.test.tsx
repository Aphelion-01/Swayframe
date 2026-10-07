// @vitest-environment jsdom
import { it, expect, beforeAll, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  findProperty,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { newId } from '../src/core/core-types';
import { motionSegments } from '../src/core/motion-curve';
import { MotionCurveAPI } from '../src/core/motion-curve-commands';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('面板读取跨属性 Mixed，点击预设即时统一，指定区间模式隔离其他区间', () => {
  const store = new EditorStore(createDefaultProject()),
    layer = createLayer('rectangle'),
    props = [layer.transform.position, layer.transform.opacity];
  store.run('准备', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer,
    }),
    ...props.flatMap((p) =>
      [0, 1, 2].map((t) =>
        command({
          type: 'keyframe.add',
          propertyId: p.id,
          keyframe: {
            id: newId(),
            time: t,
            value:
              typeof p.baseValue === 'number' ? t / 2 : { x: t * 100, y: 0 },
            interpolation: { type: 'linear' },
          },
        }),
      ),
    ),
  ]);
  const api = new MotionCurveAPI(store.commands),
    a = motionSegments(
      findProperty(store.getSnapshot().project, props[0]!.id).property,
    )[0]!;
  api.applyMotionCurve([a.id], {
    type: 'cubic-bezier',
    x1: 0.4,
    y1: 0,
    x2: 1,
    y2: 1,
  });
  for (const p of props)
    for (const k of findProperty(store.getSnapshot().project, p.id).property
      .keyframes)
      store.selectFrame({ propertyId: p.id, keyframeId: k.id }, true);
  render(<App store={store} />);
  fireEvent.click(screen.getByText('关键帧 ▾', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: '动画缓动' }));
  expect(screen.getByText('混合（Mixed）')).toBeInTheDocument();
  const count = store.commands.undoStack.length;
  fireEvent.click(screen.getByRole('button', { name: '缓出' }));
  expect(store.commands.undoStack.length).toBe(count + 1);
  expect(screen.queryByText('混合（Mixed）')).not.toBeInTheDocument();
  for (const p of props)
    for (const segment of motionSegments(
      findProperty(store.getSnapshot().project, p.id).property,
    ))
      expect(segment.curve).toEqual({
        type: 'cubic-bezier',
        x1: 0,
        y1: 0,
        x2: 0.58,
        y2: 1,
      });
  fireEvent.change(screen.getByLabelText('缓动应用范围'), {
    target: { value: 'segment' },
  });
  fireEvent.click(screen.getByRole('button', { name: '线性' }));
  expect(api.getMotionCurve(a.id)).toEqual({ type: 'linear' });
  expect(
    motionSegments(
      findProperty(store.getSnapshot().project, props[1]!.id).property,
    )[0]!.curve?.type,
  ).toBe('cubic-bezier');
  act(() => store.undo());
  expect(api.getMotionCurve(a.id)?.type).toBe('cubic-bezier');
  act(() => store.redo());
  expect(api.getMotionCurve(a.id)?.type).toBe('linear');
});

it('真实手柄 200 次 pointermove 实时更新画布求值，窗口释放只提交一次事务', () => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId = 1;
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  Element.prototype.setPointerCapture = vi.fn();
  const store = new EditorStore(createDefaultProject()),
    layer = createLayer('rectangle');
  store.run('准备', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer,
    }),
    ...[0, 1].map((t) =>
      command({
        type: 'keyframe.add',
        propertyId: layer.transform.position.id,
        keyframe: {
          id: newId(),
          time: t,
          value: { x: t * 100, y: 0 },
          interpolation: { type: 'linear' },
        },
      }),
    ),
  ]);
  store.select(layer.id);
  store.setTime(0.5);
  render(<App store={store} />);
  fireEvent.click(screen.getByText('关键帧 ▾', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: '动画缓动' }));
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  const svg = screen.getByRole('img', { name: '标准化缓动曲线' });
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 360,
    bottom: 280,
    width: 360,
    height: 280,
    toJSON: () => ({}),
  });
  const handle = screen.getByRole('slider', { name: '缓动 P1 手柄' });
  fireEvent.pointerDown(handle, { button: 0, clientX: 40, clientY: 207 });
  for (let i = 0; i < 200; i++)
    fireEvent.pointerMove(window, {
      clientX: 100 + (80 * i) / 199,
      clientY: 180,
    });
  expect(store.getRenderProject()).not.toBe(before);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack.length).toBe(count);
  const preview = store.getRenderProject();
  expect(
    findProperty(preview, layer.transform.position.id).property.keyframes[0]!
      .outgoing?.x,
  ).toBeCloseTo(0.5);
  fireEvent.lostPointerCapture(handle);
  fireEvent.pointerUp(window);
  expect(store.commands.undoStack.length).toBe(count + 1);
  expect(store.getSnapshot().project).toEqual(preview);
  expect(store.getSnapshot().propertyPreviews).toBeUndefined();
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
