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
import { newId } from '../src/core/core-types';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup() {
  const p = createDefaultProject(),
    raw = createLayer('rectangle');
  const layer = {
    ...raw,
    transform: {
      ...raw.transform,
      rotation: {
        ...raw.transform.rotation,
        keyframes: [0, 1].map((time) => ({
          id: newId(),
          time,
          value: time * 100,
          interpolation: { type: 'linear' as const },
        })),
      },
    },
  };
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers: [layer] })),
  });
  store.select(layer.id);
  render(<App store={store} />);
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  const svg = screen.getByRole('img', { name: '动画值曲线' });
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 680,
    bottom: 280,
    width: 680,
    height: 280,
    toJSON: () => ({}),
  });
  return { store, svg };
}
it('值/速度曲线滚轮以鼠标为中心缩放，Space/中键平移和取消只改变视口', () => {
  const { store, svg } = setup(),
    before = store.getSnapshot().project;
  fireEvent.wheel(svg, { clientX: 100, clientY: 60, deltaY: -200 });
  const [x, y, width] = svg.getAttribute('viewBox')!.split(' ').map(Number);
  expect(x! + (100 * width!) / 680).toBeCloseTo(100);
  expect(y! + (60 * width!) / 680).toBeCloseTo(60);
  const zoomed = svg.getAttribute('viewBox');
  fireEvent.keyDown(svg, { key: ' ', code: 'Space' });
  fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(svg, { clientX: 160, clientY: 140 });
  expect(svg.getAttribute('viewBox')).not.toBe(zoomed);
  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.pointerUp(svg);
  expect(svg.getAttribute('viewBox')).toBe(zoomed);
  expect(store.getSnapshot().playing).toBe(false);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
  fireEvent.keyDown(svg, { key: 'f' });
  expect(svg).toHaveAttribute('viewBox', '0 0 680 280');
  fireEvent.click(screen.getByRole('button', { name: '速度曲线' }));
  expect(screen.getByRole('img', { name: '动画速度曲线' })).toBeInTheDocument();
  expect(store.getSnapshot().project).toBe(before);
});
it('缩放后的切线拖动正确换算坐标，100次预览一条事务，Undo恢复真实动画', () => {
  const { store, svg } = setup(),
    before = store.getSnapshot().project;
  fireEvent.wheel(svg, { clientX: 340, clientY: 140, deltaY: -300 });
  const [x, y, width] = svg.getAttribute('viewBox')!.split(' ').map(Number),
    zoom = 680 / width!;
  const handle = screen.getByRole('slider', { name: '出切线手柄' });
  const screenX = (50 + 580 * 0.2 - x!) * zoom;
  const screenY = (235 - ((60 + 15) / 130) * 205 - y!) * zoom;
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
  for (let i = 0; i < 100; i++)
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: screenX,
      clientY: screenY,
    });
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.pointerUp(handle, { pointerId: 1 });
  const curve = activeComposition(store.getSnapshot().project).layers[0]!
    .transform.rotation.keyframes[0]!.outgoing!;
  expect(curve.x).toBeCloseTo(0.2);
  expect(curve.y).toBeCloseTo(0.6);
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('capture loss and release outside the curve retain the edited controls and axis domain; edge handles stay selectable', () => {
  const { store, svg } = setup(),
    before = store.getSnapshot().project;
  fireEvent.click(screen.getByRole('button', { name: '速度曲线' }));
  const handle = screen.getByRole('slider', { name: '出切线手柄' });
  const grid = () =>
    [...svg.querySelectorAll('text')].map((n) => n.textContent);
  const domain = grid();
  fireEvent.pointerDown(handle, { button: 0, clientX: 200, clientY: 120 });
  fireEvent.pointerMove(handle, { clientX: 250, clientY: -400 });
  fireEvent.lostPointerCapture(handle);
  fireEvent.pointerMove(window, { clientX: 290, clientY: -500 });
  expect(store.getSnapshot().project).toBe(before);
  expect(handle).toHaveAttribute('data-offscreen', 'true');
  expect(Number(handle.getAttribute('cy'))).toBeGreaterThanOrEqual(0);
  fireEvent.pointerUp(window, { clientX: 290, clientY: -500 });
  expect(store.getSnapshot().project).not.toBe(before);
  expect(store.commands.undoStack).toHaveLength(1);
  expect(grid()).toEqual(domain);
  const after = store.getSnapshot().project;
  fireEvent.pointerUp(handle);
  expect(store.getSnapshot().project).toBe(after);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('graph playback and tap Space work without switching panels; holding Space for pan does not start playback', () => {
  const { store, svg } = setup();
  fireEvent.click(screen.getByRole('button', { name: '播放曲线预览' }));
  expect(store.getSnapshot().playing).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '暂停曲线预览' }));
  fireEvent.keyDown(svg, { key: ' ', code: 'Space' });
  fireEvent.keyUp(svg, { key: ' ', code: 'Space' });
  expect(store.getSnapshot().playing).toBe(true);
  act(() => store.setPlaying(false));
  fireEvent.keyDown(svg, { key: ' ', code: 'Space' });
  fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(svg, { clientX: 140, clientY: 120 });
  fireEvent.pointerUp(svg);
  fireEvent.keyUp(svg, { key: ' ', code: 'Space' });
  expect(store.getSnapshot().playing).toBe(false);
});
it('editing outgoing influence preserves the incoming endpoint including its zero influence', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '关键帧 K1' }));
  fireEvent.click(screen.getByRole('button', { name: '缓入' }));
  fireEvent.click(
    screen.getByRole('img', { name: '动画值曲线' }).querySelector('path')!,
  );
  expect(screen.getByLabelText('入影响比例（%）')).toHaveValue(0);
  const field = screen.getByLabelText('出影响比例（%）');
  fireEvent.change(field, { target: { value: '30' } });
  fireEvent.blur(field);
  expect(field).toHaveValue(30);
  expect(screen.getByLabelText('入影响比例（%）')).toHaveValue(0);
});
