import { describe, expect, it } from 'vitest';
import { EditorStore } from '../src/ui/editor-store';
import { command } from '../src/core/command-system';
import { evaluateProperty } from '../src/core/animation-engine';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';

function setup(count = 1) {
  const project = createDefaultProject(),
    store = new EditorStore(project);
  const layers = Array.from({ length: count }, (_, i) =>
    createLayer('rectangle', { position: { x: 100 + i * 200, y: 100 } }),
  );
  store.run(
    '创建',
    layers.map((layer) =>
      command({
        type: 'layer.create',
        compositionId: project.activeCompositionId,
        layer,
      }),
    ),
  );
  store.select(layers[0]!.id);
  return {
    store,
    layers,
    c: () => activeComposition(store.getSnapshot().project),
  };
}
describe('基础编辑与自动关键帧', () => {
  it('第一次在后续时间拖动保留零秒起点，重复拖动更新同一帧，整体撤销', () => {
    const { store, layers, c } = setup();
    const before = store.commands.getSnapshot();
    store.setTime(1);
    store.beginDrag(layers[0]!.id, { x: 100, y: 100 });
    store.moveDrag({ x: 200, y: 100 });
    store.endDrag();
    expect(
      c().layers[0]!.transform.position.keyframes.map((k) => k.time),
    ).toEqual([0, 1]);
    expect(evaluateProperty(c().layers[0]!.transform.position, 0)).toEqual({
      x: 100,
      y: 100,
    });
    store.beginDrag(layers[0]!.id, { x: 200, y: 100 });
    store.moveDrag({ x: 250, y: 100 });
    store.endDrag();
    expect(c().layers[0]!.transform.position.keyframes).toHaveLength(2);
    expect(evaluateProperty(c().layers[0]!.transform.position, 1)).toEqual({
      x: 250,
      y: 100,
    });
    store.undo();
    store.undo();
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('关闭自动记录保持静态编辑；属性秒表开关保留当前求值且可撤销', () => {
    const { store, c } = setup();
    store.setAutoKeyframes(false);
    store.nudge(5, 0);
    const p = c().layers[0]!.transform.position;
    expect(p.keyframes).toHaveLength(0);
    expect(p.baseValue.x).toBe(105);
    store.togglePropertyAnimation(p.id);
    store.setTime(1);
    store.run('位置', [store.valueCommand(p.id, { x: 205, y: 100 })]);
    store.setTime(0.5);
    const before = store.commands.getSnapshot();
    store.togglePropertyAnimation(p.id);
    expect(c().layers[0]!.transform.position.keyframes).toHaveLength(0);
    expect(c().layers[0]!.transform.position.baseValue.x).toBe(155);
    store.undo();
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('多图层拖动预览不写 Scene，松手一笔事务，锁定图层保持', () => {
    const { store, layers, c } = setup(3);
    store.selectAll();
    store.run('锁定', [
      command({
        type: 'layer.patch',
        compositionId: c().id,
        layerId: layers[2]!.id,
        patch: { locked: true },
      }),
    ]);
    const before = store.commands.getSnapshot(),
      count = store.commands.undoStack.length;
    store.beginDrag(layers[0]!.id, { x: 100, y: 100 });
    store.moveDrag({ x: 120, y: 110 });
    expect(store.commands.getSnapshot()).toBe(before);
    expect(store.getSnapshot().preview?.others).toHaveLength(1);
    store.endDrag();
    expect(
      c().layers.map((l) => evaluateProperty(l.transform.position, 0).x),
    ).toEqual([120, 320, 500]);
    expect(store.commands.undoStack).toHaveLength(count + 1);
    store.undo();
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('复制图层重新生成所有实体 ID 并保留关键帧与 Undo', () => {
    const { store, c } = setup();
    store.nudge(1, 0);
    const original = c().layers[0]!;
    store.duplicateSelection();
    const copy = c().layers[1]!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.transform.position.id).not.toBe(original.transform.position.id);
    expect(copy.transform.position.keyframes[0]!.id).not.toBe(
      original.transform.position.keyframes[0]!.id,
    );
    expect(copy.transform.position.keyframes[0]!.value).toEqual(
      original.transform.position.keyframes[0]!.value,
    );
    store.undo();
    expect(c().layers).toHaveLength(1);
    store.redo();
    expect(c().layers).toHaveLength(2);
  });
  it('关键帧批量移动吸附时间，冲突或越界均不改工程与历史', () => {
    const { store, c } = setup();
    store.nudge(1, 0);
    store.setTime(1);
    store.nudge(1, 0);
    const p = c().layers[0]!.transform.position;
    store.selectFrame({ propertyId: p.id, keyframeId: p.keyframes[0]!.id });
    const before = store.commands.getSnapshot(),
      count = store.commands.undoStack.length;
    store.moveSelectedFrames(1);
    expect(store.commands.getSnapshot()).toBe(before);
    expect(store.getSnapshot().status).toContain('已有');
    store.moveSelectedFrames(-1);
    expect(store.commands.getSnapshot()).toBe(before);
    expect(store.commands.undoStack).toHaveLength(count);
    store.selectFrame(
      { propertyId: p.id, keyframeId: p.keyframes[1]!.id },
      true,
    );
    store.moveSelectedFrames(0.5);
    expect(
      c().layers[0]!.transform.position.keyframes.map((k) => k.time),
    ).toEqual([0.5, 1.5]);
    store.undo();
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('复制多帧保留相对间隔和插值，粘贴覆盖同一时间并可撤销', () => {
    const { store, c } = setup(2);
    store.nudge(1, 0);
    store.setTime(1);
    store.nudge(1, 0);
    const source = c().layers[0]!.transform.position;
    for (const k of source.keyframes)
      store.selectFrame({ propertyId: source.id, keyframeId: k.id }, true);
    store.copySelection();
    store.select(c().layers[1]!.id);
    store.setTime(2);
    store.pasteSelection();
    expect(
      c().layers[1]!.transform.position.keyframes.map((k) => k.time),
    ).toEqual([2, 3]);
    const before = store.commands.getSnapshot();
    store.pasteSelection();
    expect(c().layers[1]!.transform.position.keyframes).toHaveLength(2);
    store.undo();
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('图层多选对齐分布一笔历史，旋转边界和锁定限制有效', () => {
    const { store, c } = setup(3);
    store.selectAll();
    store.align('center');
    expect(
      c().layers.map((l) => evaluateProperty(l.transform.position, 0).x),
    ).toEqual([960, 960, 960]);
    store.undo();
    store.run('旋转', [
      store.valueCommand(c().layers[0]!.transform.rotation.id, 90),
    ]);
    store.align('left');
    const l = c().layers[0]!;
    expect(evaluateProperty(l.transform.position, 0).x).toBeCloseTo(
      l.height / 2,
    );
    store.undo();
    store.align('horizontal');
    expect(
      c().layers.map((l) => evaluateProperty(l.transform.position, 0).x),
    ).toEqual([100, 300, 500]);
  });
  it('删除选中关键帧优先于图层，前后关键帧导航不修改工程', () => {
    const { store, c } = setup();
    store.nudge(1, 0);
    store.setTime(1);
    store.nudge(1, 0);
    const p = c().layers[0]!.transform.position,
      before = store.commands.getSnapshot();
    store.setTime(0.5);
    store.jumpFrame(1);
    expect(store.getSnapshot().time).toBe(1);
    store.jumpFrame(-1);
    expect(store.getSnapshot().time).toBe(0);
    expect(store.commands.getSnapshot()).toBe(before);
    store.selectFrame({ propertyId: p.id, keyframeId: p.keyframes[0]!.id });
    store.deleteSelected();
    expect(c().layers).toHaveLength(1);
    expect(c().layers[0]!.transform.position.keyframes).toHaveLength(1);
    store.undo();
    expect(store.commands.getSnapshot()).toEqual(before);
  });
});

it('复制图片到新工程同时带入素材；整个粘贴可以一次撤销', () => {
  const project = createDefaultProject(),
    store = new EditorStore(project),
    asset = {
      id: crypto.randomUUID(),
      name: 'image.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AA==',
    },
    layer = createLayer('image', { assetId: asset.id });
  store.run('图片', [
    command({ type: 'asset.add', asset }),
    command({
      type: 'layer.create',
      compositionId: project.activeCompositionId,
      layer,
    }),
  ]);
  store.select(layer.id);
  store.copySelection();
  store.commands.replaceProject(createDefaultProject());
  const before = store.commands.getSnapshot();
  store.pasteSelection();
  expect(store.getSnapshot().project.assets).toHaveLength(1);
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(1);
  store.undo();
  expect(store.commands.getSnapshot()).toEqual(before);
});
