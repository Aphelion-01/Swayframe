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
import {
  createDefaultProject,
  createLayer,
  activeComposition,
  type Property,
} from '../src/core/project-model';
import type { AnimValue } from '../src/core/core-types';
import { evaluateProperty } from '../src/core/animation-engine';
import {
  cameraForLayer,
  cameraFrustum,
  cameraBlur,
} from '../src/core/camera-optics';
import { createRenderSnapshot } from '../src/core/renderer-core';
import {
  motionPathPoint,
  screenPathDelta,
} from '../src/core/motion-path-projection';
import { spatialPoint3 } from '../src/core/spatial-path';
import { loadProject, saveProject } from '../src/core/project-io';
import { EditorStore } from '../src/ui/editor-store';
import { Inspector } from '../src/ui/Inspector';
import { CameraSpaceOverlay } from '../src/ui/CameraSpaceOverlay';
import { MotionPathOverlay } from '../src/ui/MotionPathOverlay';
import { useEditorSlice } from '../src/ui/use-editor-slice';
const frame = (time: number, value: AnimValue) => ({
  id: crypto.randomUUID(),
  time,
  value,
  interpolation: { type: 'linear' } as const,
});
function fixture(three = false, camera = false) {
  const p = createDefaultProject(),
    l = createLayer(camera ? 'camera' : 'rectangle', {
      position: { x: 300, y: 200 },
    });
  const prop: Property<AnimValue> = three
    ? l.editor!.properties.position3D!
    : l.transform.position;
  const property = {
    ...prop,
    keyframes: [
      frame(0, three ? [0, 0, 0] : { x: 300, y: 200 }),
      frame(2, three ? [100, 100, 60] : { x: 500, y: 400 }),
    ],
  };
  const layer = three
    ? {
        ...l,
        editor: {
          ...l.editor!,
          is3D: true,
          properties: { ...l.editor!.properties, position3D: property },
        },
      }
    : {
        ...l,
        transform: {
          ...l.transform,
          position: property as typeof l.transform.position,
        },
      };
  const store = new EditorStore({
    ...p,
    compositions: [{ ...p.compositions[0]!, layers: [layer] }],
  });
  store.select(layer.id);
  return { store, layer, property };
}
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  Element.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('摄像机范围随姿态、焦距和对焦距离变化，景深在焦平面为零且光圈有实际作用', () => {
  const camera = cameraForLayer(createLayer('camera'), 0, 1920, 1080),
    corners = cameraFrustum(camera);
  expect(corners[0]).toEqual([-960, -540, 0]);
  expect(cameraFrustum({ ...camera, zoom: 2000 })[0]).toEqual([-480, -270, 0]);
  const rotated = cameraFrustum({
    ...camera,
    position: [100, 0, 0],
    rotation: [0, 90, 0],
  });
  expect(rotated[0]![0]).toBeCloseTo(1100);
  const optics = { ...camera, depthOfField: true };
  expect(cameraBlur(optics, [0, 0, 0])).toBe(0);
  expect(cameraBlur({ ...optics, aperture: 1.4 }, [0, 0, 500])).toBeGreaterThan(
    cameraBlur({ ...optics, aperture: 8 }, [0, 0, 500]),
  );
  expect(cameraBlur({ ...optics, depthOfField: false }, [0, 0, 500])).toBe(0);
});
it('旧工程补齐摄像机参数；非法光圈、维度和素材数据被拒绝', () => {
  const p = createDefaultProject(),
    l = createLayer('camera'),
    props = { ...l.editor!.properties };
  for (const k of [
    'cameraDepthOfField',
    'cameraFocusDistance',
    'cameraAperture',
    'cameraExposure',
  ])
    delete props[k];
  const raw = {
    ...p,
    schemaVersion: '0.6.0',
    compositions: [
      {
        ...p.compositions[0]!,
        layers: [{ ...l, editor: { ...l.editor!, properties: props } }],
      },
    ],
  };
  const loaded = loadProject(JSON.stringify(raw));
  expect(
    activeComposition(loaded).layers[0]!.editor!.properties.cameraAperture!
      .baseValue,
  ).toBe(2.8);
  const malformed = { ...raw, compositions: [{ layers: null }] };
  expect(() => loadProject(JSON.stringify(malformed))).toThrow('工程结构无效');
  const bad = {
    ...l,
    editor: {
      ...l.editor!,
      properties: {
        ...l.editor!.properties,
        cameraAperture: {
          ...l.editor!.properties.cameraAperture!,
          baseValue: 0,
        },
      },
    },
  };
  expect(() =>
    saveProject({
      ...p,
      compositions: [{ ...p.compositions[0]!, layers: [bad] }],
    }),
  ).toThrow();
});
it('摄像机位置可选择；范围开关仅更改视图，参数通过命令支持撤销', () => {
  const { store } = fixture(false, true);
  render(<Inspector store={store} />);
  const before = store.getSnapshot().project;
  fireEvent.click(screen.getByRole('button', { name: '拍摄范围 已隐藏' }));
  expect(store.getSnapshot().project).toEqual(before);
  expect(store.getSnapshot().showCameraFrustum).toBe(true);
  fireEvent.click(screen.getByLabelText('摄像机景深'));
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.properties
      .cameraDepthOfField!.baseValue,
  ).toBe(1);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  cleanup();
  const snapshot = createRenderSnapshot(
    activeComposition(before),
    0,
    [],
    undefined,
    before,
  );
  render(
    <CameraSpaceOverlay
      store={store}
      snapshot={snapshot}
      width={600}
      height={400}
      project={(p) => ({ x: p[0] + 300, y: p[1] + 200, z: 1000 })}
    />,
  );
  expect(screen.getByText(/对焦平面/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /空间选择/ })).toBeInTheDocument();
});
function Overlay({
  store,
  space = false,
}: {
  store: EditorStore;
  space?: boolean;
}) {
  const v = useEditorSlice(store, [
    'project',
    'time',
    'selection',
    'propertyPreview',
  ]);
  const p = store.getRenderProject();
  const snapshot = createRenderSnapshot(
    activeComposition(p),
    v.time,
    v.selection,
    undefined,
    p,
  );
  return (
    <MotionPathOverlay
      store={store}
      snapshot={snapshot}
      width={1920}
      height={1080}
      project={
        space ? (p) => ({ x: p[0] + 960, y: p[1] + 540, z: 1000 }) : undefined
      }
    />
  );
}
it.each([false, true])(
  '二维/三维路径实时预览、窗口松手提交最终坐标、撤销与 Escape 不反弹（3D=%s）',
  (three) => {
    const { store, property } = fixture(three);
    render(<Overlay store={store} space={three} />);
    const before = store.getSnapshot().project,
      handle = screen.getByRole('slider', { name: '路径 K1 出控制点' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 150 });
    expect(store.getSnapshot().project).toEqual(before);
    expect(store.getSnapshot().propertyPreview).toBeDefined();
    fireEvent.pointerUp(window, { clientX: 140, clientY: 160 });
    expect(store.getSnapshot().propertyPreview).toBeUndefined();
    expect(store.commands.undoStack).toHaveLength(1);
    const updated = activeComposition(store.getSnapshot().project).layers[0]!,
      prop = three
        ? updated.editor!.properties.position3D!
        : updated.transform.position;
    const control = prop.keyframes[0]!.spatialOutgoing!;
    expect(
      Array.isArray(control) ? control[0] : (control as { x: number }).x,
    ).toBeCloseTo((three ? 100 / 3 : 300 + 200 / 3) + 40);
    expect(screen.getByLabelText('最终位置')).toBeInTheDocument();
    expect(
      screen.getByLabelText('最终位置').querySelector('polygon'),
    ).not.toBeNull();
    expect(evaluateProperty(prop, 1)).not.toEqual(
      evaluateProperty(property, 1),
    );
    expect(loadProject(saveProject(store.getSnapshot().project))).toEqual(
      store.getSnapshot().project,
    );
    act(() => store.undo());
    expect(store.getSnapshot().project).toEqual(before);
    const h = screen.getByRole('slider', { name: '路径 K1 出控制点' });
    fireEvent.pointerDown(h, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 20, clientY: 20 });
    fireEvent.keyDown(h, { key: 'Escape' });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 50 });
    expect(store.getSnapshot().project).toEqual(before);
    expect(store.getSnapshot().propertyPreview).toBeUndefined();
  },
);
it('三维贝塞尔插值保持端点；屏幕逆映射与父级旋转一致', () => {
  const a = { ...frame(0, [0, 0, 0]), spatialOutgoing: [0, 100, 20] },
    b = { ...frame(2, [100, 0, 100]), spatialIncoming: [100, 100, 80] };
  expect(spatialPoint3(a, b, 0)).toEqual([0, 0, 0]);
  expect(spatialPoint3(a, b, 1)).toEqual([100, 0, 100]);
  expect(spatialPoint3(a, b, 0.5)).toEqual([50, 75, 50]);
  expect(
    screenPathDelta(
      [
        { x: 0, y: 2 },
        { x: -3, y: 0 },
        { x: 0, y: 0 },
      ],
      6,
      4,
    ),
  ).toEqual([2, -2, 0]);
  const { store, layer, property } = fixture(true);
  const parent = createLayer('null', { position: { x: 960, y: 540 } });
  const p = store.getSnapshot().project;
  const rotated = {
    ...parent,
    editor: {
      ...parent.editor!,
      is3D: true,
      properties: {
        ...parent.editor!.properties,
        rotation3D: {
          ...parent.editor!.properties.rotation3D!,
          baseValue: [0, 0, 90],
        },
      },
    },
  };
  const child = { ...layer, editor: { ...layer.editor!, parentId: parent.id } };
  const c = { ...activeComposition(p), layers: [rotated, child] },
    snap = createRenderSnapshot(c, 0, [], undefined, {
      ...p,
      compositions: [c],
    });
  const item = snap.layers.find((l) => l.source.id === child.id)!;
  const start = motionPathPoint(item, property, [0, 0, 0], snap),
    end = motionPathPoint(item, property, [100, 0, 0], snap);
  expect(end[0] - start[0]).toBeCloseTo(0);
  expect(end[1] - start[1]).toBeCloseTo(100);
});
it('父级摄像机的实际拍摄位置和空间标记使用同一个世界变换', () => {
  const p = createDefaultProject(),
    camera = createLayer('camera'),
    parent = createLayer('null', { position: { x: 1060, y: 540 } });
  const c = {
    ...p.compositions[0]!,
    layers: [
      parent,
      { ...camera, editor: { ...camera.editor!, parentId: parent.id } },
    ],
  };
  const snapshot = createRenderSnapshot(c, 0, [], undefined, {
      ...p,
      compositions: [c],
    }),
    f = snapshot.layers.find((l) => l.source.id === camera.id)!;
  expect(snapshot.camera!.position).toEqual([100, 0, -1000]);
  expect(cameraForLayer(f.source, 0, 1920, 1080, f.world3D).position).toEqual(
    snapshot.camera!.position,
  );
});
it('透视预览中的三维控制点长距离拖动仍跟随指针，键盘微调走相同命令', () => {
  const { store } = fixture(true);
  render(<Overlay store={store} />);
  const h = screen.getByRole('slider', { name: '路径 K1 出控制点' }),
    x = Number(h.getAttribute('cx')),
    y = Number(h.getAttribute('cy'));
  fireEvent.pointerDown(h, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(window, { clientX: 260, clientY: 210 });
  const moved = screen.getByRole('slider', { name: '路径 K1 出控制点' });
  expect(Number(moved.getAttribute('cx'))).toBeCloseTo(x + 160, 1);
  expect(Number(moved.getAttribute('cy'))).toBeCloseTo(y + 110, 1);
  fireEvent.pointerUp(window, { clientX: 260, clientY: 210 });
  expect(store.commands.undoStack).toHaveLength(1);
  const before = Number(
    screen
      .getByRole('slider', { name: '路径 K1 出控制点' })
      .getAttribute('aria-valuenow'),
  );
  fireEvent.keyDown(screen.getByRole('slider', { name: '路径 K1 出控制点' }), {
    key: 'ArrowRight',
    shiftKey: true,
  });
  expect(
    Number(
      screen
        .getByRole('slider', { name: '路径 K1 出控制点' })
        .getAttribute('aria-valuenow'),
    ),
  ).toBeCloseTo(before + 10);
});
