import { expect, it } from 'vitest';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { parentCommands } from '../src/core/composition-editing';
import { createRenderSnapshot } from '../src/core/renderer-core';
import {
  transformEditCommands,
  transformPreviewComposition,
} from '../src/core/transform-editing';
import { evaluateProperty } from '../src/core/animation-engine';
function setup() {
  const p = createDefaultProject(),
    store = new EditorStore(p),
    parent = createLayer('null', { position: { x: 400, y: 400 } }),
    child = createLayer('rectangle', { position: { x: 600, y: 400 } });
  store.run(
    '创建',
    [parent, child].map((layer) =>
      command({
        type: 'layer.create',
        compositionId: p.activeCompositionId,
        layer,
      }),
    ),
  );
  store.run(
    '父级',
    parentCommands(store.getSnapshot().project, child.id, parent.id, 0),
  );
  return { store, parent, child };
}
it('100 次移动仅提交一次；播放头或工程变化取消过期手势，不在其他时间写关键帧', () => {
  const { store, child } = setup();
  store.select(child.id);
  const before = store.getSnapshot().project;
  const count = store.commands.undoStack.length;
  store.beginDrag(child.id, { x: 0, y: 0 });
  for (let i = 1; i <= 100; i++) store.moveDrag({ x: i, y: 0 });
  expect(store.getSnapshot().project).toBe(before);
  store.endDrag();
  expect(store.commands.undoStack).toHaveLength(count + 1);
  store.undo();
  expect(store.getSnapshot().project).toEqual(before);
  store.beginDrag(child.id, { x: 0, y: 0 });
  store.moveDrag({ x: 100, y: 0 });
  store.setTime(1);
  store.endDrag();
  expect(store.getSnapshot().project).toEqual(before);
  expect(store.commands.undoStack).toHaveLength(count);
  expect(store.getSnapshot().preview).toBeUndefined();
  store.beginDrag(child.id, { x: 0, y: 0 });
  store.setTime(2);
  store.moveDrag({ x: 100, y: 0 });
  store.endDrag();
  expect(store.getSnapshot().project).toEqual(before);
});
it('旋转父级下的拖动使用逆变换；父子多选不产生双重位移，复制重连父级', () => {
  const { store, parent, child } = setup();
  store.run('转父级', [store.valueCommand(parent.transform.rotation.id, 90)]);
  store.select(child.id);
  store.setAutoKeyframes(false);
  const c = () => activeComposition(store.getSnapshot().project);
  store.beginDrag(child.id, { x: 0, y: 0 });
  store.moveDrag({ x: 100, y: 0 });
  store.endDrag();
  const pos = evaluateProperty(c().layers[1]!.transform.position, 0);
  expect(pos.x).toBeCloseTo(200);
  expect(pos.y).toBeCloseTo(-100);
  store.undo();
  store.selectAll();
  const before = createRenderSnapshot(c(), 0, []).layers[1]!.position;
  store.beginDrag(child.id, { x: 0, y: 0 });
  store.moveDrag({ x: 100, y: 0 });
  store.endDrag();
  const after = createRenderSnapshot(c(), 0, []).layers[1]!.position;
  expect(after.x - before.x).toBeCloseTo(100);
  expect(after.y - before.y).toBeCloseTo(0);
  store.duplicateSelection();
  expect(c().layers[3]!.editor!.parentId).toBe(c().layers[2]!.id);
});
it('父级删除保持子级及动画，撤销恢复全部；三维手柄预览参与真实投影', () => {
  const { store, parent, child } = setup(),
    c = () => activeComposition(store.getSnapshot().project);
  store.select(parent.id);
  const before = store.commands.getSnapshot();
  store.deleteLayers();
  expect(c().layers).toHaveLength(1);
  expect(c().layers[0]!.editor!.parentId).toBeNull();
  expect(evaluateProperty(c().layers[0]!.transform.position, 0)).toEqual({
    x: 600,
    y: 400,
  });
  store.undo();
  expect(store.commands.getSnapshot()).toEqual(before);
  store.run('三维', [
    command({
      type: 'layer.replace',
      compositionId: c().id,
      layer: {
        ...c().layers[1]!,
        editor: { ...c().layers[1]!.editor!, is3D: true },
      },
    }),
  ]);
  const snapshot = createRenderSnapshot(c(), 0, []),
    item = snapshot.layers.find((l) => l.source.id === child.id)!,
    changed = { ...item, scale: { x: item.scale.x * 2, y: item.scale.y * 2 } };
  const preview = createRenderSnapshot(
      transformPreviewComposition(c(), snapshot, [changed]),
      0,
      [],
    ),
    quad = preview.layers.find((l) => l.source.id === child.id)!.quad!;
  expect(quad[1]!.x - quad[0]!.x).toBeCloseTo(
    (item.quad![1]!.x - item.quad![0]!.x) * 2,
  );
  const commands = transformEditCommands(
    store.getSnapshot().project,
    snapshot,
    [changed],
    'scale',
    0,
    false,
  );
  const count = store.commands.undoStack.length;
  store.run('缩放', commands);
  expect(store.commands.undoStack).toHaveLength(count + 1);
  store.undo();
  expect(c().layers[1]!.transform.scale.baseValue).toEqual({ x: 1, y: 1 });
});
