import { expect, it } from 'vitest';
import { EditorStore } from '../src/ui/editor-store';
import { command } from '../src/core/command-system';
import {
  createDefaultProject,
  createComposition,
  createLayer,
  activeComposition,
  findProperty,
  layerProperties,
} from '../src/core/project-model';
import { loadProject, saveProject } from '../src/core/project-io';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { evaluateProperty } from '../src/core/animation-engine';
import { newId } from '../src/core/core-types';
import {
  MotionCurveAPI,
  applyMotionCurveCommands,
} from '../src/core/motion-curve-commands';
import { motionSegments } from '../src/core/motion-curve';
import {
  parentCommands,
  precomposeCommands,
} from '../src/core/composition-editing';
import { createEffect, createMask } from '../src/core/effect-model';
import { migrateLayerGraph } from '../src/core/compositing-migration';
import { transformPropertyEdit } from '../src/ui/transform-property-edit';
import { getWorldBounds } from '../src/core/layer-bounds';

function setup() {
  const store = new EditorStore(createDefaultProject());
  const layer = createLayer('rectangle', { position: { x: 200, y: 540 } });
  expect(
    store.run('创建', [
      command({
        type: 'layer.create',
        compositionId: store.getSnapshot().project.activeCompositionId,
        layer,
      }),
    ]).ok,
  ).toBe(true);
  store.select(layer.id);
  return { store, layer };
}
function frame(store: EditorStore, time: number) {
  const project = store.getSnapshot().project;
  return createRenderSnapshot(
    activeComposition(project),
    time,
    [],
    undefined,
    project,
  );
}
it('FLOW-01 新工程→命名合成→Shape→Save→Load，完整清理旧编辑状态', () => {
  const { store, layer } = setup();
  store.togglePropertyAnimation(layer.transform.position.id);
  const key = activeComposition(store.getSnapshot().project).layers[0]!
    .transform.position.keyframes[0]!;
  store.selectFrame({
    propertyId: layer.transform.position.id,
    keyframeId: key.id,
  });
  store.setTime(3);
  store.setPlaying(true);
  store.setTimelineZoom(3);
  expect(store.load(saveProject(createDefaultProject()))).toBe(true);
  expect(store.commands.undoStack).toHaveLength(0);
  expect(store.commands.redoStack).toHaveLength(0);
  expect(store.getSnapshot()).toMatchObject({
    selection: [],
    frames: [],
    time: 0,
    playing: false,
    timelineZoom: 1,
  });
  const composition = createComposition({
    name: 'FLOW-01',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  });
  expect(
    store.run('合成', [
      command({ type: 'composition.add', composition }),
      command({ type: 'project.activate', compositionId: composition.id }),
      command({
        type: 'layer.create',
        compositionId: composition.id,
        layer: createLayer('ellipse'),
      }),
    ]).ok,
  ).toBe(true);
  const before = store.getSnapshot().project;
  expect(loadProject(store.save())).toEqual(before);
  expect(activeComposition(loadProject(store.save())).name).toBe('FLOW-01');
});
it('FLOW-02 静态移动不写关键帧；秒表→Canvas连续拖动→0/0.5/1秒正确求值，一次撤销', () => {
  const { store, layer } = setup();
  store.setTime(1);
  store.beginDrag(layer.id, { x: 200, y: 540 });
  store.moveDrag({ x: 220, y: 540 });
  store.endDrag();
  expect(
    findProperty(store.getSnapshot().project, layer.transform.position.id)
      .property.keyframes,
  ).toHaveLength(0);
  store.undo();
  store.setTime(0);
  store.togglePropertyAnimation(layer.transform.position.id);
  store.setTime(1);
  const before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  store.beginDrag(layer.id, { x: 200, y: 540 });
  for (let i = 1; i <= 100; i++) store.moveDrag({ x: 200 + 7.6 * i, y: 540 });
  expect(store.getSnapshot().project).toBe(before);
  store.endDrag();
  expect(store.commands.undoStack).toHaveLength(count + 1);
  expect([0, 0.5, 1].map((t) => frame(store, t).layers[0]!.position.x)).toEqual(
    [200, 580, 960],
  );
  const after = store.getSnapshot().project;
  store.undo();
  expect(store.getSnapshot().project).toEqual(before);
  store.redo();
  expect(store.getSnapshot().project).toEqual(after);
});
it('FLOW-03 Motion Curve改变求值，Undo/Redo精确恢复曲线与结果', () => {
  const { store, layer } = setup();
  store.togglePropertyAnimation(layer.transform.position.id);
  store.setTime(1);
  store.run('移动', [
    store.valueCommand(layer.transform.position.id, { x: 960, y: 540 }),
  ]);
  const property = findProperty(
    store.getSnapshot().project,
    layer.transform.position.id,
  ).property;
  const id = motionSegments(property)[0]!.id,
    before = store.getSnapshot().project;
  const api = new MotionCurveAPI(store.commands);
  expect(
    api.applyMotionCurve([id], {
      type: 'cubic-bezier',
      x1: 0,
      y1: 0,
      x2: 0.58,
      y2: 1,
    }).ok,
  ).toBe(true);
  expect(frame(store, 0.5).layers[0]!.position.x).toBeGreaterThan(580);
  const after = store.getSnapshot().project;
  store.undo();
  expect(store.getSnapshot().project).toEqual(before);
  expect(frame(store, 0.5).layers[0]!.position.x).toBe(580);
  store.redo();
  expect(store.getSnapshot().project).toEqual(after);
});
it('FLOW-04 图片/Mask/Exposure/Blur动画、父级、预合成与3D数据完整往返', () => {
  const store = new EditorStore(createDefaultProject()),
    c = activeComposition(store.getSnapshot().project);
  const asset = {
    id: newId(),
    name: 'fixture.png',
    mimeType: 'image/png',
    dataUrl: 'data:image/png;base64,AA==',
  };
  const image = createLayer('image', { assetId: asset.id }),
    mask = createMask(image, 'path'),
    blur = createEffect('gaussianBlur'),
    exposure = createEffect('exposure');
  const layer = migrateLayerGraph({
    ...image,
    editor: {
      ...image.editor!,
      graph: undefined,
      masks: [mask],
      effects: [exposure, blur],
      is3D: true,
    },
  });
  expect(
    store.run('图片效果', [
      command({ type: 'asset.add', asset }),
      command({ type: 'layer.create', compositionId: c.id, layer }),
      ...([0, 1, 2] as const).map((time) =>
        command({
          type: 'keyframe.add',
          propertyId: blur.parameters.radius!.id,
          keyframe: {
            id: newId(),
            time,
            value: time === 1 ? 20 : 0,
            interpolation: { type: 'linear' },
          },
        }),
      ),
    ]).ok,
  ).toBe(true);
  const before = store.getSnapshot().project;
  const loaded = loadProject(store.save());
  expect(loaded).toEqual(before);
  const radius = layerProperties(activeComposition(loaded).layers[0]!).find(
    (p) => p.key.endsWith('.radius'),
  )?.property;
  expect(radius).toBeDefined();
  expect(evaluateProperty(radius!, 1)).toBe(20);
  const pre = precomposeCommands(before, [layer.id]);
  expect(store.run('预合成', pre.commands).ok).toBe(true);
  expect(loadProject(store.save())).toEqual(store.getSnapshot().project);
  store.undo();
  expect(store.getSnapshot().project).toEqual(before);
  store.redo();
  expect(activeComposition(store.getSnapshot().project).layers[0]!.type).toBe(
    'precomp',
  );
});
it('FLOW-05 Parent动画影响Child；位置/旋转/缩放继承与Undo准确', () => {
  const { store, layer } = setup(),
    parent = createLayer('null', { position: { x: 0, y: 0 } });
  store.run('父级', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer: parent,
    }),
    ...parentCommands(
      {
        ...store.getSnapshot().project,
        compositions: store.getSnapshot().project.compositions.map((c) => ({
          ...c,
          layers: [...c.layers, parent],
        })),
      },
      layer.id,
      parent.id,
      0,
    ),
  ]);
  store.togglePropertyAnimation(parent.transform.position.id);
  store.setTime(1);
  expect(
    store.run('父级动画', [
      store.valueCommand(parent.transform.position.id, { x: 300, y: 0 }),
      store.valueCommand(parent.transform.rotation.id, 90),
      store.valueCommand(parent.transform.scale.id, { x: 2, y: 2 }),
    ]).ok,
  ).toBe(true);
  const child = frame(store, 1).layers.find((l) => l.source.id === layer.id)!;
  expect(child.position.x).toBeCloseTo(300 - 1080);
  expect(child.position.y).toBeCloseTo(400);
  const loaded = loadProject(store.save());
  expect(loaded).toEqual(store.getSnapshot().project);
  store.undo();
  expect(
    frame(store, 1).layers.find((l) => l.source.id === layer.id)!.position,
  ).toEqual({ x: 200, y: 540 });
});
it('BENCH-A Scale 0→115→100从Inspector变换命令记录，不产生额外Position动画', () => {
  const { store, layer } = setup();
  store.setTransformSettings(
    { orientation: 'local', pivotMode: 'object-center' },
    false,
  );
  transformPropertyEdit(store, layer.transform.scale.id, { x: 0, y: 0 }, true);
  expect(store.getSnapshot().error).toBe(false);
  store.togglePropertyAnimation(layer.transform.scale.id);
  store.setTime(0.5);
  transformPropertyEdit(
    store,
    layer.transform.scale.id,
    { x: 1.15, y: 1.15 },
    false,
  );
  expect(frame(store, 0.5).layers[0]!.scale).toEqual({ x: 0, y: 0 });
  transformPropertyEdit(
    store,
    layer.transform.scale.id,
    { x: 1.15, y: 1.15 },
    true,
  );
  store.setTime(1);
  transformPropertyEdit(store, layer.transform.scale.id, { x: 1, y: 1 }, true);
  const scale = findProperty(
    store.getSnapshot().project,
    layer.transform.scale.id,
  ).property;
  expect(scale.keyframes.map((k) => k.value)).toEqual([
    { x: 0, y: 0 },
    { x: 1.15, y: 1.15 },
    { x: 1, y: 1 },
  ]);
  expect(
    findProperty(store.getSnapshot().project, layer.transform.position.id)
      .property.keyframes,
  ).toHaveLength(0);
  expect(store.getSnapshot().error).toBe(false);
});
it('零缩放恢复保留底部支点、单轴塌缩和负缩放；预览不写Scene，一次Undo恢复', () => {
  const { store, layer } = setup();
  store.setTransformSettings(
    { orientation: 'local', pivotMode: 'bottom' },
    false,
  );
  const oldBounds = getWorldBounds(frame(store, 0).layers[0]!, 0);
  transformPropertyEdit(store, layer.transform.scale.id, { x: 0, y: 0 }, true);
  const collapsed = store.getSnapshot().project;
  transformPropertyEdit(
    store,
    layer.transform.scale.id,
    { x: -1, y: 1 },
    false,
  );
  expect(store.getSnapshot().project).toBe(collapsed);
  transformPropertyEdit(store, layer.transform.scale.id, { x: -1, y: 1 }, true);
  expect(getWorldBounds(frame(store, 0).layers[0]!, 0).maxY).toBeCloseTo(
    oldBounds.maxY,
  );
  expect(frame(store, 0).layers[0]!.scale).toEqual({ x: -1, y: 1 });
  store.undo();
  expect(store.getSnapshot().project).toEqual(collapsed);
  transformPropertyEdit(store, layer.transform.scale.id, { x: 0, y: 1 }, true);
  transformPropertyEdit(store, layer.transform.scale.id, { x: 1, y: 1 }, true);
  expect(store.getSnapshot().error).toBe(false);
});
it('损坏文件、非法时间、缺失引用与循环不会替换当前工程或损坏历史', () => {
  const { store } = setup(),
    before = store.getSnapshot().project,
    count = store.commands.undoStack.length;
  for (const bad of [
    '{',
    JSON.stringify({ ...before, compositions: [] }),
    JSON.stringify({ ...before, activeCompositionId: newId() }),
  ]) {
    expect(store.load(bad)).toBe(false);
    expect(store.getSnapshot().project).toBe(before);
    expect(store.commands.undoStack).toHaveLength(count);
  }
  expect(
    store.run('坏时间', [
      command({
        type: 'keyframe.add',
        propertyId: activeComposition(before).layers[0]!.transform.position.id,
        keyframe: {
          id: newId(),
          time: -1,
          value: { x: 0, y: 0 },
          interpolation: { type: 'linear' },
        },
      }),
    ]).ok,
  ).toBe(false);
  expect(store.getSnapshot().project).toBe(before);
});
it('零缩放时旋转仍可编辑，恢复尺寸后保留角度并精确撤销', () => {
  const { store, layer } = setup();
  store.setTransformSettings(
    { orientation: 'local', pivotMode: 'anchor' },
    false,
  );
  transformPropertyEdit(store, layer.transform.scale.id, { x: 0, y: 0 }, true);
  transformPropertyEdit(store, layer.transform.rotation.id, 45, true);
  expect(frame(store, 0).layers[0]!.rotation).toBe(45);
  const collapsed = store.getSnapshot().project;
  transformPropertyEdit(store, layer.transform.scale.id, { x: 1, y: 1 }, true);
  expect(frame(store, 0).layers[0]!.rotation).toBe(45);
  store.undo();
  expect(store.getSnapshot().project).toEqual(collapsed);
});
it('BENCH-C 三张图片 Z=0/-500/-1000 与摄像机推进，投影和工程往返一致', () => {
  const store = new EditorStore(createDefaultProject());
  const c = activeComposition(store.getSnapshot().project);
  const asset = {
    id: newId(),
    name: 'depth.png',
    mimeType: 'image/png',
    dataUrl: 'data:image/png;base64,AA==',
  };
  const layers = [0, -500, -1000].map((z) => {
    const layer = createLayer('image', {
      assetId: asset.id,
      width: 600,
      height: 337.5,
    });
    return {
      ...layer,
      editor: {
        ...layer.editor!,
        is3D: true,
        properties: {
          ...layer.editor!.properties,
          position3D: {
            ...layer.editor!.properties.position3D!,
            baseValue: [0, 0, z],
          },
        },
      },
    };
  });
  const camera = createLayer('camera');
  expect(
    store.run('创建2.5D', [
      command({ type: 'asset.add', asset }),
      ...[...layers, camera].map((layer) =>
        command({ type: 'layer.create', compositionId: c.id, layer }),
      ),
    ]).ok,
  ).toBe(true);
  const position = camera.editor!.properties.cameraPosition!;
  store.run('设置摄像机', [store.valueCommand(position.id, [0, 0, -2000])]);
  store.togglePropertyAnimation(position.id);
  store.setTime(2);
  store.run('推进摄像机', [store.valueCommand(position.id, [0, 0, -1500])]);
  const width = (time: number, id: string) => {
    const quad = frame(store, time).layers.find(
      (l) => l.source.id === id,
    )!.quad!;
    return quad[1]!.x - quad[0]!.x;
  };
  for (const [index, layer] of layers.entries()) {
    const z = [0, -500, -1000][index]!;
    expect(width(0, layer.id)).toBeCloseTo((600 * 1000) / (2000 + z));
    expect(width(1, layer.id)).toBeCloseTo((600 * 1000) / (1750 + z));
    expect(width(2, layer.id)).toBeCloseTo((600 * 1000) / (1500 + z));
  }
  expect(loadProject(store.save())).toEqual(store.getSnapshot().project);
});
it('整条创作历史逐步Undo/Redo恢复：变换、关键帧、曲线、效果、遮罩、父级、预合成和删除', () => {
  const store = new EditorStore(createDefaultProject());
  const c = activeComposition(store.getSnapshot().project),
    layer = createLayer('rectangle'),
    parent = createLayer('null');
  const states = [store.getSnapshot().project];
  const record = (
    label: string,
    commands: Parameters<EditorStore['run']>[1],
  ) => {
    expect(store.run(label, commands).ok).toBe(true);
    states.push(store.getSnapshot().project);
  };
  record('创建', [
    command({ type: 'layer.create', compositionId: c.id, layer }),
  ]);
  store.select(layer.id);
  record('移动', [
    store.valueCommand(layer.transform.position.id, { x: 200, y: 540 }),
  ]);
  record('缩放旋转属性', [
    store.valueCommand(layer.transform.scale.id, { x: 1.2, y: 1.2 }),
    store.valueCommand(layer.transform.rotation.id, 25),
    store.valueCommand(layer.transform.opacity.id, 0.8),
  ]);
  const keys = [0, 1].map((time) => ({
    id: newId(),
    time,
    value: { x: time ? 960 : 200, y: 540 },
    interpolation: { type: 'linear' as const },
  }));
  record(
    '添加关键帧',
    keys.map((keyframe) =>
      command({
        type: 'keyframe.add',
        propertyId: layer.transform.position.id,
        keyframe,
      }),
    ),
  );
  record('移动关键帧', [
    command({
      type: 'keyframe.update',
      propertyId: layer.transform.position.id,
      keyframeId: keys[1]!.id,
      patch: { time: 2 },
    }),
  ]);
  record(
    '曲线',
    applyMotionCurveCommands(
      store.getSnapshot().project,
      [
        motionSegments(
          findProperty(store.getSnapshot().project, layer.transform.position.id)
            .property,
        )[0]!.id,
      ],
      { type: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 },
    ),
  );
  record('删除关键帧', [
    command({
      type: 'keyframe.delete',
      propertyId: layer.transform.position.id,
      keyframeId: keys[1]!.id,
    }),
  ]);
  const current = activeComposition(store.getSnapshot().project).layers[0]!,
    blur = createEffect('gaussianBlur'),
    mask = createMask(current, 'rectangle');
  record('添加效果遮罩', [
    command({
      type: 'layer.replace',
      compositionId: c.id,
      layer: migrateLayerGraph({
        ...current,
        editor: {
          ...current.editor!,
          graph: undefined,
          effects: [blur],
          masks: [mask],
        },
      }),
    }),
  ]);
  record('修改效果', [store.valueCommand(blur.parameters.radius!.id, 20)]);
  record('创建父级', [
    command({ type: 'layer.create', compositionId: c.id, layer: parent }),
  ]);
  record(
    '父级',
    parentCommands(store.getSnapshot().project, layer.id, parent.id, 0),
  );
  const pre = precomposeCommands(store.getSnapshot().project, [
    layer.id,
    parent.id,
  ]);
  record('预合成', pre.commands);
  record('删除图层', [
    command({
      type: 'layer.delete',
      compositionId: c.id,
      layerId: activeComposition(store.getSnapshot().project).layers[0]!.id,
    }),
  ]);
  for (let i = states.length - 2; i >= 0; i--) {
    store.undo();
    expect(store.getSnapshot().project).toEqual(states[i]);
    expect(loadProject(store.save())).toEqual(states[i]);
  }
  for (let i = 1; i < states.length; i++) {
    store.redo();
    expect(store.getSnapshot().project).toEqual(states[i]);
  }
  expect(
    store
      .getSnapshot()
      .selection.every((id) =>
        activeComposition(store.getSnapshot().project).layers.some(
          (l) => l.id === id,
        ),
      ),
  ).toBe(true);
});
