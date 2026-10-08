// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { projectPoint } from '../src/core/perspective';
import { createRenderSnapshot } from '../src/core/renderer-core';
import {
  defaultSpatialView,
  spatialProject,
  spatialBasis,
  spatialCamera,
  spatialSegment,
  navigateSpatialWheel,
  orbitSpatialView,
  unwrapAngle,
  axisDragAmount,
  rulerStep,
} from '../src/core/spatial-view';
import { Timeline } from '../src/ui/Timeline';
import { LayerPanel } from '../src/ui/LayerPanel';
import { ThreeDGizmo } from '../src/ui/ThreeDGizmo';
import { SpatialViewport } from '../src/ui/SpatialViewport';
import { CanvasAids } from '../src/ui/CanvasAids';
import { Canvas } from '../src/ui/Canvas';
import { Inspector } from '../src/ui/Inspector';
import { toggleLayer3D } from '../src/ui/workspace/layer-3d';
import { buildEditorActions } from '../src/ui/workspace/editor-actions';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
function fixture() {
  const p = createDefaultProject(),
    layers = [
      createLayer('rectangle', { name: '子图层' }),
      createLayer('null', { name: '父图层' }),
    ];
  const store = new EditorStore({
    ...p,
    compositions: [{ ...p.compositions[0]!, layers }],
  });
  store.select(layers[0]!.id);
  return {
    store,
    layers,
    current: () => activeComposition(store.getSnapshot().project).layers[0]!,
  };
}
function rect(element: Element, width = 600, height = 400) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}
it('时间轴、曲线、节点始终保留刻度和单一播放控件；缓动归属曲线功能', () => {
  const { store } = fixture();
  render(<Timeline store={store} />);
  act(() => store.setTime(1));
  expect(screen.getByLabelText('播放头')).toHaveAttribute('aria-valuenow', '1');
  for (const tab of ['曲线编辑器', '合成节点']) {
    fireEvent.click(screen.getByRole('tab', { name: tab }));
    expect(
      screen.getByRole('slider', { name: '合成时间标尺' }),
    ).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getAllByRole('button', { name: '播放' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '播放' }));
    expect(store.getSnapshot().playing).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
  }
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  expect(screen.queryByRole('tab', { name: '缓动曲线' })).toBeNull();
  fireEvent.click(
    within(screen.getByRole('group', { name: '曲线编辑功能' })).getByRole(
      'button',
      { name: '缓动' },
    ),
  );
  expect(screen.getByRole('tab', { name: '曲线编辑器' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.queryByRole('button', { name: '播放缓动预览' })).toBeNull();
});
it('常驻时间标尺窗口松手采用最后坐标；取消恢复起点且不写工程', () => {
  const { store } = fixture();
  render(<Timeline store={store} />);
  fireEvent.click(screen.getByRole('tab', { name: '合成节点' }));
  const ruler = screen.getByLabelText('合成时间标尺');
  rect(ruler, 1016, 32);
  const before = store.getSnapshot().project;
  fireEvent.pointerDown(ruler, { button: 0, clientX: 8 });
  fireEvent.pointerMove(window, { clientX: 208 });
  fireEvent.pointerUp(window, { clientX: 608 });
  expect(store.getSnapshot().time).toBe(3);
  fireEvent.pointerDown(ruler, { button: 0, clientX: 808 });
  fireEvent.keyDown(ruler, { key: 'Escape' });
  expect(store.getSnapshot().time).toBe(3);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('图层面板标题、列表空白及下半空白反复右键均能创建，菜单每项有图标', () => {
  const { store } = fixture();
  render(<LayerPanel store={store} />);
  const panel = screen.getByLabelText('图层面板');
  const targets = [
    panel,
    document.querySelector('.panel-heading')!,
    document.querySelector('.layer-list')!,
  ];
  for (let i = 0; i < 6; i++) {
    fireEvent.contextMenu(targets[i % 3]!, {
      clientX: 100,
      clientY: i % 2 ? 700 : 100,
    });
    const menu = screen.getByRole('menu', { name: '创建对象' });
    expect(menu.closest('aside')).toBeNull();
    const choices = within(menu).getAllByRole('menuitem');
    expect(choices).toHaveLength(10);
    choices.forEach((item) => expect(item.querySelector('svg')).not.toBeNull());
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: '创建对象' })).toBeNull();
  }
  fireEvent.contextMenu(panel, { clientX: 10, clientY: 700 });
  fireEvent.click(screen.getByRole('menuitem', { name: '创建 星形' }));
  expect(
    activeComposition(store.getSnapshot().project).layers.at(-1),
  ).toMatchObject({ shapeKind: 'star' });
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(2);
});
it('图层菜单父子级直接选择父级，操作进入同一撤销历史', () => {
  const { store, layers, current } = fixture();
  const entry = buildEditorActions(store, {}).find(
    (a) => a.id === 'parent-select',
  )!;
  expect(entry.children?.map((c) => c.label)).toContain('父图层');
  entry.children!.find((c) => c.label === '父图层')!.action();
  expect(current().editor!.parentId).toBe(layers[1]!.id);
  expect(store.commands.undoStack).toHaveLength(1);
  store.undo();
  expect(current().editor!.parentId).toBeNull();
});
it('快速 3D 开关可撤销，2D/3D位置默认链接各自符合维度', () => {
  const { store, current } = fixture();
  render(
    <>
      <LayerPanel store={store} />
      <Inspector store={store} />
    </>,
  );
  expect(screen.getByLabelText('解除位置 X/Y 链接')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByLabelText('开启 子图层 三维图层'));
  expect(current().editor!.is3D).toBe(true);
  expect(screen.getByLabelText('启用位置 X/Y 链接')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(screen.getByLabelText('启用三维位置 X/Y 链接')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  act(() => store.undo());
  expect(current().editor!.is3D).toBe(false);
});
it('XYZ 拖动只预览，窗口最终松手写一次事务，取消和卸载清理预览', () => {
  const { store, current, layers } = fixture();
  toggleLayer3D(store, [layers[0]!.id]);
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  const snapshot = createRenderSnapshot(
    activeComposition(before),
    0,
    [layers[0]!.id],
    undefined,
    before,
  );
  const ui = render(
    <ThreeDGizmo
      store={store}
      snapshot={snapshot}
      project={(p) => ({ x: 300 + p[0], y: 200 + p[1], z: 1000 + p[2] })}
      width={600}
      height={400}
    />,
  );
  rect(screen.getByLabelText('三维 XYZ 操控手柄'));
  const x = screen.getByLabelText('移动三维 X 轴');
  fireEvent.pointerDown(x, { button: 0, clientX: 300, clientY: 200 });
  fireEvent.pointerMove(window, { clientX: 320, clientY: 200 });
  expect(store.getSnapshot().project).toBe(before);
  expect(store.getSnapshot().propertyPreview).toBeDefined();
  fireEvent.pointerUp(window, { clientX: 350, clientY: 200 });
  expect(current().editor!.properties.position3D!.baseValue).toEqual([
    50, 0, 0,
  ]);
  expect(store.commands.undoStack).toHaveLength(count + 1);
  expect(store.getSnapshot().propertyPreview).toBeUndefined();
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  fireEvent.pointerDown(x, { button: 0, clientX: 300, clientY: 200 });
  fireEvent.pointerMove(window, { clientX: 320, clientY: 200 });
  fireEvent.pointerCancel(window);
  expect(store.getSnapshot().project).toEqual(before);
  expect(store.getSnapshot().propertyPreview).toBeUndefined();
  fireEvent.pointerDown(x, { button: 0, clientX: 300, clientY: 200 });
  fireEvent.pointerMove(window, { clientX: 330, clientY: 200 });
  ui.unmount();
  expect(store.getSnapshot().propertyPreview).toBeUndefined();
});
it('空间视角绕转、缩放、聚焦、正顶视切换仅改变UI，持续显示坐标网格和XYZ', () => {
  const { store, layers } = fixture();
  toggleLayer3D(store, [layers[0]!.id]);
  render(<SpatialViewport store={store} onClose={() => {}} />);
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  const stage = document.querySelector('.spatial-viewport-stage')!;
  const initial = document
    .querySelector('.spatial-scene polygon')!
    .getAttribute('points');
  fireEvent.pointerDown(stage, { button: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(window, { clientX: 160, clientY: 140 });
  fireEvent.pointerUp(window, { clientX: 160, clientY: 140 });
  expect(
    document.querySelector('.spatial-scene polygon')!.getAttribute('points'),
  ).not.toBe(initial);
  fireEvent.wheel(stage, { deltaY: 100 });
  fireEvent.keyDown(stage, { key: 'F' });
  fireEvent.change(screen.getByLabelText('空间查看方向'), {
    target: { value: 'top' },
  });
  expect(
    screen.getByLabelText('三维坐标轴网格').querySelectorAll('line').length,
  ).toBeGreaterThan(100);
  expect(
    screen.getAllByRole('slider', { name: /移动三维 [XYZ] 轴/ }),
  ).toHaveLength(3);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(count);
});
it('标尺拖出参考线使用合成像素坐标，窗口释放保留最后位置，移出删除', () => {
  render(
    <CanvasAids
      width={600}
      height={400}
      scale={1}
      compositionId="test"
      settings={{ grid: true, rulers: true, guides: true }}
    />,
  );
  rect(screen.getByLabelText('画布作图辅助'));
  const ruler = screen.getByLabelText('拖出水平参考线');
  fireEvent.pointerDown(ruler, { button: 0, clientX: 100, clientY: 10 });
  fireEvent.pointerMove(window, { clientX: 100, clientY: 80 });
  fireEvent.pointerUp(window, { clientX: 100, clientY: 120 });
  const guide = screen.getByLabelText('参考线 Y 120 px');
  expect(
    JSON.parse(localStorage.getItem('swayframe.guides.test')!)[0].value,
  ).toBe(120);
  fireEvent.pointerDown(guide, { button: 0, clientX: 100, clientY: 120 });
  fireEvent.pointerUp(window, { clientX: 100, clientY: 500 });
  expect(screen.queryByLabelText(/参考线 Y/)).toBeNull();
});
it('自由视图投影方向、轴向拖动换算和像素标尺步进稳定', () => {
  const v = { ...defaultSpatialView, yaw: 0, pitch: 0, orthographic: true };
  expect(spatialProject([0, 0, 0], v, 800, 600)).toMatchObject({
    x: 400,
    y: 300,
  });
  expect(spatialProject([100, 0, 0], v, 800, 600)!.x).toBeGreaterThan(400);
  expect(spatialProject([0, 100, 0], v, 800, 600)!.y).toBeGreaterThan(300);
  expect(spatialProject([0, 0, -3000], v, 800, 600)).toBeNull();
  const b = spatialBasis(defaultSpatialView);
  expect(b.right.reduce((sum, n, i) => sum + n * b.down[i]!, 0)).toBeCloseTo(0);
  expect(axisDragAmount(20, 20, 40, 40, 100)).toBe(50);
  expect(axisDragAmount(20, 20, 0, 0, 100)).toBe(0);
  expect(rulerStep(1)).toBe(100);
  expect(rulerStep(0.25)).toBe(20);
});

it('空间视图网格、手柄与真实图层渲染使用一致的透视和正交投影', () => {
  for (const orthographic of [false, true]) {
    const view = { ...defaultSpatialView, orthographic };
    for (const p of [
      [0, 0, 0],
      [250, -100, 400],
      [-200, 50, -300],
    ] as const) {
      const expected = spatialProject(p, view, 800, 600)!;
      const actual = projectPoint(p, spatialCamera(view, 800, 600))!;
      expect(actual.x).toBeCloseTo(expected.x, 6);
      expect(actual.y).toBeCloseTo(expected.y, 6);
      expect(actual.z).toBeCloseTo(expected.z, 6);
    }
  }
  const front = { ...defaultSpatialView, yaw: 0, pitch: 0 };
  expect(
    spatialSegment([0, 0, -5000], [100, 0, 5000], front, 800, 600),
  ).not.toBeNull();
  expect(
    spatialSegment([0, 0, -5000], [100, 0, -3000], front, 800, 600),
  ).toBeNull();
});

it('主预览打开旁侧空间视图不改工程；辅助入口复用关闭行为与可见反馈', () => {
  const { store, layers } = fixture();
  toggleLayer3D(store, [layers[0]!.id]);
  render(<Canvas store={store} />);
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  expect(screen.getAllByLabelText('三维 XYZ 操控手柄')).toHaveLength(1);
  fireEvent.click(screen.getByLabelText('三维图层查看工具'));
  expect(screen.getByLabelText('三维空间预览')).toBeVisible();
  expect(screen.getAllByLabelText('三维 XYZ 操控手柄')).toHaveLength(2);
  expect(screen.getByLabelText('三维图层渲染预览')).toBeInTheDocument();
  const summary = screen.getByText('辅助', { selector: 'summary' });
  fireEvent.click(summary);
  fireEvent.click(screen.getByLabelText('网格', { selector: 'input' }));
  fireEvent.click(screen.getByLabelText('标尺', { selector: 'input' }));
  expect(screen.getByLabelText('合成像素网格')).toBeInTheDocument();
  expect(screen.getByLabelText('像素标尺')).toBeInTheDocument();
  fireEvent.keyDown(summary, { key: 'Escape' });
  expect(summary.closest('details')).not.toHaveAttribute('open');
  fireEvent.click(screen.getByLabelText('关闭三维空间预览'));
  expect(screen.queryByLabelText('三维空间预览')).toBeNull();
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(count);
});

it('触控板双指绕转、Shift双指屏幕等距平移、捏合高响应缩放，均不混淆', () => {
  const wheel = {
    deltaX: 20,
    deltaY: 10,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
  };
  const orbit = navigateSpatialWheel(defaultSpatialView, wheel, 800, 600);
  expect(orbit.yaw).toBeCloseTo(defaultSpatialView.yaw - 0.12);
  expect(orbit.distance).toBe(defaultSpatialView.distance);
  expect(orbit.target).toEqual([0, 0, 0]);
  const pan = navigateSpatialWheel(
    defaultSpatialView,
    { ...wheel, shiftKey: true },
    800,
    600,
  );
  expect(pan.yaw).toBe(defaultSpatialView.yaw);
  const before = spatialProject([0, 0, 0], defaultSpatialView, 800, 600)!,
    after = spatialProject([0, 0, 0], pan, 800, 600)!;
  expect(after.x - before.x).toBeCloseTo(-20);
  expect(after.y - before.y).toBeCloseTo(-10);
  const zoom = navigateSpatialWheel(
    defaultSpatialView,
    { ...wheel, deltaX: 0, deltaY: -20, ctrlKey: true },
    800,
    600,
  );
  expect(zoom.distance / defaultSpatialView.distance).toBeCloseTo(
    Math.exp(-0.36),
  );
  expect(zoom.yaw).toBe(defaultSpatialView.yaw);
  const reverse = navigateSpatialWheel(
    zoom,
    { ...wheel, deltaX: 0, deltaY: 20, ctrlKey: true },
    800,
    600,
  );
  expect(reverse.distance).toBeCloseTo(defaultSpatialView.distance);
  const mouse = navigateSpatialWheel(
    defaultSpatialView,
    { ...wheel, deltaX: 0, deltaY: 100 },
    800,
    600,
  );
  expect(mouse.distance).toBeGreaterThan(defaultSpatialView.distance);
});
it('平移后双指仍围绕原点，指向的原点屏幕位置保持稳定', () => {
  const panned = { ...defaultSpatialView, target: [400, -100, 50] as const };
  const before = spatialProject([0, 0, 0], panned, 800, 600)!;
  const after = spatialProject(
    [0, 0, 0],
    orbitSpatialView(panned, 0.3, 0.2),
    800,
    600,
  )!;
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
  expect(unwrapAngle(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2);
});
it('旋转环连续预览、松手重采样一次提交，取消不残留，支持跨越正负180度', () => {
  const { store, layers, current } = fixture();
  toggleLayer3D(store, [layers[0]!.id]);
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  const snapshot = createRenderSnapshot(
    activeComposition(before),
    0,
    [layers[0]!.id],
    undefined,
    before,
  );
  render(
    <ThreeDGizmo
      mode="rotate"
      store={store}
      snapshot={snapshot}
      project={(p) => ({ x: 300 + p[0], y: 200 + p[1], z: 1000 + p[2] })}
      width={600}
      height={400}
    />,
  );
  const root = screen.getByLabelText('三维 XYZ 操控手柄');
  rect(root);
  const center = root.querySelector('circle')!,
    x = Number(center.getAttribute('cx')),
    y = Number(center.getAttribute('cy'));
  const z = screen.getByLabelText('旋转三维 Z 轴');
  fireEvent.pointerDown(z, { button: 0, clientX: x + 66, clientY: y });
  fireEvent.pointerMove(window, { clientX: x, clientY: y + 66 });
  expect(store.getSnapshot().project).toBe(before);
  expect(store.getSnapshot().propertyPreview!.property.baseValue).toEqual([
    0, 0, 90,
  ]);
  fireEvent.pointerUp(window, { clientX: x - 66, clientY: y });
  expect(current().editor!.properties.rotation3D!.baseValue).toEqual([
    0, 0, 180,
  ]);
  expect(store.commands.undoStack).toHaveLength(count + 1);
  act(() => store.undo());
  fireEvent.pointerDown(z, { button: 0, clientX: x + 66, clientY: y });
  fireEvent.pointerMove(window, { clientX: x, clientY: y + 66 });
  fireEvent.pointerCancel(window);
  expect(store.getSnapshot().propertyPreview).toBeUndefined();
  expect(store.getSnapshot().project).toEqual(before);
});
it('旋转环支持Shift十五度吸附、键盘独立改轴，切回移动不残留预览', () => {
  const { store, layers, current } = fixture();
  toggleLayer3D(store, [layers[0]!.id]);
  const snapshot = createRenderSnapshot(
    activeComposition(store.getSnapshot().project),
    0,
    [layers[0]!.id],
    undefined,
    store.getSnapshot().project,
  );
  const props = {
    store,
    snapshot,
    project: (p: readonly [number, number, number]) => ({
      x: 300 + p[0],
      y: 200 + p[1],
      z: 1000 + p[2],
    }),
    width: 600,
    height: 400,
  };
  const ui = render(<ThreeDGizmo {...props} mode="rotate" />);
  const svg = screen.getByLabelText('三维 XYZ 操控手柄');
  rect(svg);
  const c = svg.querySelector('circle')!,
    x = Number(c.getAttribute('cx')),
    y = Number(c.getAttribute('cy'));
  const z = screen.getByLabelText('旋转三维 Z 轴'),
    angle = (38 * Math.PI) / 180;
  fireEvent.pointerDown(z, { button: 0, clientX: x + 66, clientY: y });
  fireEvent.pointerUp(window, {
    clientX: x + 66 * Math.cos(angle),
    clientY: y + 66 * Math.sin(angle),
    shiftKey: true,
  });
  expect(current().editor!.properties.rotation3D!.baseValue).toEqual([
    0, 0, 45,
  ]);
  fireEvent.keyDown(screen.getByLabelText('旋转三维 X 轴'), {
    key: 'ArrowUp',
    shiftKey: true,
  });
  expect(current().editor!.properties.rotation3D!.baseValue).toEqual([
    10, 0, 45,
  ]);
  fireEvent.pointerDown(z, { button: 0, clientX: x + 66, clientY: y });
  fireEvent.pointerMove(window, { clientX: x, clientY: y + 66 });
  ui.rerender(<ThreeDGizmo {...props} mode="translate" />);
  expect(store.getSnapshot().propertyPreview).toBeUndefined();
  expect(screen.getByLabelText('移动三维 X 轴')).toBeInTheDocument();
});
it('主预览的操控方式切换同步两视图且不写工程', () => {
  const { store, layers } = fixture();
  toggleLayer3D(store, [layers[0]!.id]);
  render(<Canvas store={store} />);
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  fireEvent.click(screen.getByLabelText('三维图层查看工具'));
  fireEvent.change(screen.getByLabelText('三维操控方式'), {
    target: { value: 'rotate' },
  });
  expect(screen.getAllByLabelText('旋转三维 X 轴')).toHaveLength(2);
  expect(screen.queryByLabelText('移动三维 X 轴')).toBeNull();
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(count);
});
