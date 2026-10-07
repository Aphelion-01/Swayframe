// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { command } from '../src/core/command-system';
import { newId } from '../src/core/core-types';
import { Timeline } from '../src/ui/Timeline';
import { GraphEditor } from '../src/ui/GraphEditor';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { evaluateProperty } from '../src/core/animation-engine';
import { saveProject, loadProject } from '../src/core/project-io';
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function fixture(values = [0, 100, 50]) {
  const project = createDefaultProject(),
    raw = createLayer('rectangle');
  const property = {
    ...raw.transform.position,
    keyframes: values.map((x, i) => ({
      id: newId(),
      time: i,
      value: { x, y: 540 },
      interpolation: { type: 'linear' as const },
    })),
  };
  const layer = { ...raw, transform: { ...raw.transform, position: property } };
  const store = new EditorStore({
    ...project,
    compositions: project.compositions.map((c) => ({ ...c, layers: [layer] })),
  });
  store.select(layer.id);
  const onClose = vi.fn();
  const ui = render(<GraphEditor embedded store={store} onClose={onClose} />);
  const current = () =>
    activeComposition(store.getSnapshot().project).layers[0]!.transform
      .position;
  return { store, ui, current, property, onClose };
}
function select(index: number) {
  fireEvent.click(screen.getByRole('button', { name: `关键帧 K${index}` }));
}
it('A/C: animated property auto-fits; ease requires selection, uses original data, mode preserves frame selection', () => {
  const { store, current } = fixture([0, 100]);
  const ease = screen.getByRole('button', { name: '缓出' });
  expect(ease).toBeDisabled();
  select(1);
  fireEvent.click(ease);
  expect(evaluateProperty(current(), 0.5).x).toBeGreaterThan(50);
  const refs = store.getSnapshot().frames;
  fireEvent.click(screen.getByRole('button', { name: '速度曲线' }));
  expect(screen.getByRole('img', { name: '动画速度曲线' })).toBeInTheDocument();
  expect(store.getSnapshot().frames).toEqual(refs);
  fireEvent.click(screen.getByRole('button', { name: '值曲线' }));
  expect(store.getSnapshot().frames).toEqual(refs);
  expect(screen.getByLabelText('曲线分量')).toHaveTextContent('X');
  expect(screen.getByLabelText('曲线分量')).not.toHaveTextContent('X / R');
  expect(screen.queryByLabelText('曲线关键帧区间')).not.toBeInTheDocument();
});
it('B: middle-key incoming edits previous segment, outgoing edits next; preview changes no project, commit and Undo restore', () => {
  const { store, current } = fixture();
  select(2);
  expect(screen.getByLabelText('关键帧时间（秒）')).toHaveValue(1);
  expect(screen.getByLabelText('关键帧数值')).toHaveValue(100);
  expect(screen.getByLabelText('入速度')).toHaveValue(100);
  expect(screen.getByLabelText('出速度')).toHaveValue(50);
  const before = store.getSnapshot().project;
  const out = screen.getByLabelText('出影响比例（%）');
  fireEvent.change(out, { target: { value: '60' } });
  expect(store.getSnapshot().project).toBe(before);
  expect(
    store.getSnapshot().propertyPreviews?.[0]?.keyframes[1]!.outgoing?.x,
  ).toBeCloseTo(0.6);
  fireEvent.blur(out);
  expect(current().keyframes[1]!.outgoing?.x).toBeCloseTo(0.6);
  expect(current().keyframes[0]).toEqual(
    activeComposition(before).layers[0]!.transform.position.keyframes[0],
  );
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  const incoming = screen.getByLabelText('入影响比例（%）');
  fireEvent.change(incoming, { target: { value: '45' } });
  fireEvent.blur(incoming);
  expect(current().keyframes[1]!.incoming?.x).toBeCloseTo(0.55);
  expect(current().keyframes[2]).toEqual(
    activeComposition(before).layers[0]!.transform.position.keyframes[2],
  );
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('D: one key is a selectable diamond with editable key inspector; zero keys and no animated selection give honest hints', () => {
  const { ui } = fixture([12]);
  expect(
    screen.getByRole('img', { name: '动画值曲线' }).querySelector('path'),
  ).toHaveAttribute('d', '');
  select(1);
  expect(screen.getByLabelText('关键帧数值')).toHaveValue(12);
  expect(screen.getByRole('button', { name: '缓出' })).toBeDisabled();
  expect(
    screen.queryByRole('slider', { name: '出切线手柄' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/添加第二个关键帧/)).toBeInTheDocument();
  ui.unmount();
  fixture([]);
  expect(screen.getByText('选择一个已动画属性以编辑曲线')).toBeInTheDocument();
});
it('E/F: inspector collapse/resize persists outside scene, cursor zoom, horizontal pan and all/selected/reset are view-only', () => {
  const { store, ui, onClose } = fixture();
  select(2);
  const before = store.getSnapshot().project;
  const svg = screen.getByRole('img', { name: '动画值曲线' });
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 680,
    height: 280,
  } as DOMRect);
  fireEvent.wheel(svg, { clientX: 630, clientY: 140, deltaY: -200 });
  const [x, , w] = svg.getAttribute('viewBox')!.split(' ').map(Number);
  expect(x! + (630 * w!) / 680).toBeCloseTo(630);
  const zoomed = svg.getAttribute('viewBox');
  fireEvent.wheel(svg, { shiftKey: true, deltaY: 20 });
  expect(svg.getAttribute('viewBox')).not.toBe(zoomed);
  fireEvent.click(screen.getByRole('button', { name: '适应选中关键帧' }));
  expect(svg.getAttribute('viewBox')).not.toBe('0 0 680 280');
  fireEvent.click(screen.getByRole('button', { name: '适应全部关键帧' }));
  expect(svg).toHaveAttribute('viewBox', '0 0 680 280');
  const divider = screen.getByRole('separator', { name: '曲线属性宽度' });
  fireEvent.keyDown(divider, { key: 'ArrowLeft' });
  expect(divider).toHaveAttribute('aria-valuenow', '260');
  fireEvent.click(screen.getByRole('button', { name: '折叠曲线属性' }));
  expect(
    screen.queryByRole('complementary', { name: '曲线属性' }),
  ).not.toBeInTheDocument();
  ui.unmount();
  render(<GraphEditor embedded store={store} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: '展开曲线属性' }));
  expect(
    screen.getByRole('separator', { name: '曲线属性宽度' }),
  ).toHaveAttribute('aria-valuenow', '260');
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
  expect(loadProject(saveProject(before))).toEqual(before);
});
it('G: 200 handle moves preview same property for Canvas, one transaction on release, Escape cancels, Undo restores', () => {
  const { store, current } = fixture([0, 100]);
  const svg = screen.getByRole('img', { name: '动画值曲线' });
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 680,
    height: 280,
  } as DOMRect);
  const before = store.getSnapshot().project,
    handle = screen.getByRole('slider', { name: '出切线手柄' });
  fireEvent.pointerDown(handle, { button: 0, clientX: 240, clientY: 160 });
  for (let i = 0; i < 200; i++)
    fireEvent.pointerMove(window, {
      clientX: 150 + i / 5,
      clientY: 180 - i / 10,
    });
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
  const preview = store.getSnapshot().propertyPreviews![0]!;
  expect(evaluateProperty(preview, 0.5)).not.toEqual(
    evaluateProperty(current(), 0.5),
  );
  expect(screen.getByLabelText('出影响比例（%）')).toHaveValue(
    Number((((189.8 - 50) / 580) * 100).toFixed(3)),
  );
  fireEvent.pointerUp(window);
  expect(store.commands.undoStack).toHaveLength(1);
  expect(current()).toEqual(preview);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  fireEvent.pointerDown(handle, { button: 0 });
  fireEvent.pointerMove(window, { clientX: 200, clientY: 150 });
  fireEvent.keyDown(svg, { key: 'Escape' });
  // Esc is dispatched by App in production; standalone invokes the shared cancellation event.
  act(() => window.dispatchEvent(new Event('motion:cancel')));
  fireEvent.pointerUp(window);
  expect(store.getSnapshot().project).toEqual(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('key time/value edits use Command System; key/segment context menus operate on same selection', () => {
  const { store, current } = fixture();
  select(2);
  act(() =>
    store.run('非标准字段顺序', [
      command({
        type: 'keyframe.update',
        propertyId: current().id,
        keyframeId: current().keyframes[1]!.id,
        patch: { value: { y: 540, x: 100 } },
      }),
    ]),
  );
  const value = screen.getByLabelText('关键帧数值');
  fireEvent.change(value, { target: { value: '130' } });
  fireEvent.blur(value);
  expect(current().keyframes[1]!.value).toEqual({ x: 130, y: 540 });
  act(() => store.undo());
  expect(current().keyframes[1]!.value).toEqual({ x: 100, y: 540 });
  const key = screen.getByRole('button', { name: '关键帧 K2' });
  fireEvent.contextMenu(key, { clientX: 200, clientY: 100 });
  fireEvent.click(screen.getByRole('menuitem', { name: '保持' }));
  expect(current().keyframes[1]!.interpolation.type).toBe('hold');
  act(() => store.undo());
});

it('RGBA component edits keep array topology and other channels; linear preset clears Bezier handles', () => {
  const { store, current } = fixture([0, 100]);
  const layer = activeComposition(store.getSnapshot().project).layers[0]!;
  const fill = layer.editor!.properties.fill!;
  act(() => {
    store.run(
      '颜色关键帧',
      [0, 1].map((time) =>
        command({
          type: 'keyframe.add',
          propertyId: fill.id,
          keyframe: {
            id: newId(),
            time,
            value: [time, 0.4, 0.8, 1],
            interpolation: { type: 'linear' },
          },
        }),
      ),
    );
    store.selectProperties([fill.id]);
  });
  expect(screen.getByLabelText('曲线分量')).toHaveTextContent('R');
  select(1);
  const value = screen.getByLabelText('关键帧数值');
  fireEvent.change(value, { target: { value: '.2' } });
  fireEvent.blur(value);
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.properties
      .fill!.keyframes[0]!.value,
  ).toEqual([0.2, 0.4, 0.8, 1]);
  act(() => store.selectProperties([current().id]));
  select(1);
  fireEvent.click(screen.getByRole('button', { name: '缓出' }));
  fireEvent.click(screen.getByRole('button', { name: '线性' }));
  expect(current().keyframes[0]!.interpolation.type).toBe('linear');
  expect(current().keyframes[0]!.outgoing).toBeUndefined();
});

it('segment context opens the exact Motion Curve segment; curve modes hide timeline filters', () => {
  const { store, current, ui } = fixture();
  ui.unmount();
  render(<Timeline store={store} />);
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  const svg = screen.getByRole('img', { name: '动画值曲线' });
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 680,
    height: 280,
  } as DOMRect);
  fireEvent.contextMenu(svg.querySelector(':scope > path')!, {
    clientX: 500,
    clientY: 100,
  });
  fireEvent.click(screen.getByRole('menuitem', { name: '编辑缓动' }));
  expect(screen.getByRole('tab', { name: '曲线编辑器' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByLabelText('缓动应用范围')).toHaveValue('segment');
  expect(screen.getByLabelText('缓动目标区间')).toHaveValue(
    `${current().id}/${current().keyframes[1]!.id}/${current().keyframes[2]!.id}`,
  );
  expect(
    screen.queryByRole('textbox', { name: '搜索时间轴属性' }),
  ).not.toBeInTheDocument();
});

it('auto-fit expands small fractional ranges instead of flattening opacity/scale curves', () => {
  fixture([1, 1.01]);
  const points = screen
    .getByRole('img', { name: '动画值曲线' })
    .querySelector(':scope > path')!
    .getAttribute('d')!
    .match(/[ML]([^ML]+)/g)!;
  const first = points[0]!.slice(1).split(',').map(Number),
    last = points.at(-1)!.slice(1).split(',').map(Number);
  expect(Math.abs(first[1]! - last[1]!)).toBeGreaterThan(150);
  const axisLabels = [
    ...screen.getByRole('img', { name: '动画值曲线' }).querySelectorAll('text'),
  ]
    .map((t) => t.textContent)
    .filter((t) => /^1\.\d+$/.test(t ?? ''));
  expect(new Set(axisLabels).size).toBeGreaterThan(3);
});
