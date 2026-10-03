import { expect, it } from 'vitest';
import { createLayer, createComposition } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { transformHandles, layerToWorld } from '../src/core/transform-geometry';
import { resizeLayer } from '../src/core/resize-geometry';
import { transformPreviewComposition } from '../src/core/transform-editing';
it('八个角/边手柄；相对边固定，单轴、链接比例与 Alt 锚点缩放正确', () => {
  const layer = createLayer('rectangle', {
    position: { x: 400, y: 200 },
    width: 100,
    height: 100,
  });
  const snapshot = createRenderSnapshot(
      { ...createComposition(), layers: [layer] },
      0,
      [],
    ),
    item = snapshot.layers[0]!;
  expect(transformHandles(item).filter((h) => h.kind === 'scale')).toHaveLength(
    8,
  );
  const side = resizeLayer(
    item,
    { x: 450, y: 200 },
    { x: 550, y: 200 },
    { x: 1, y: 0 },
    false,
  );
  expect(side.scale).toEqual({ x: 2, y: 1 });
  expect(side.position).toEqual({ x: 450, y: 200 });
  const linked = resizeLayer(
    item,
    { x: 450, y: 200 },
    { x: 550, y: 200 },
    { x: 1, y: 0 },
    true,
  );
  expect(linked.scale).toEqual({ x: 2, y: 2 });
  const centered = resizeLayer(
    item,
    { x: 450, y: 200 },
    { x: 550, y: 200 },
    { x: 1, y: 0 },
    false,
    true,
  );
  expect(centered.scale.x).toBe(3);
  expect(centered.position).toEqual(item.position);
});
it('旋转、负缩放和父级下固定角不漂移，临时预览走现有局部/世界坐标转换', () => {
  const parent = createLayer('null', { position: { x: 400, y: 200 } }),
    raw = createLayer('rectangle', {
      position: { x: 200, y: 80 },
      width: 100,
      height: 100,
    });
  const child = {
    ...raw,
    editor: { ...raw.editor!, parentId: parent.id },
    transform: {
      ...raw.transform,
      rotation: { ...raw.transform.rotation, baseValue: 30 },
      scale: { ...raw.transform.scale, baseValue: { x: -2, y: 0.5 } },
    },
  };
  const c = { ...createComposition(), layers: [parent, child] },
    snapshot = createRenderSnapshot(c, 0, []),
    item = snapshot.layers[1]!;
  const start = layerToWorld(item, { x: 50, y: 50 }),
    end = layerToWorld(item, { x: 100, y: 100 });
  const preview = resizeLayer(item, start, end, { x: 1, y: 1 }, true);
  const edited = transformPreviewComposition(c, snapshot, [preview]);
  const result = createRenderSnapshot(edited, 0, []).layers[1]!;
  const fixedBefore = layerToWorld(item, { x: -50, y: -50 }),
    fixedAfter = layerToWorld(result, { x: -50, y: -50 });
  expect(fixedAfter.x).toBeCloseTo(fixedBefore.x);
  expect(fixedAfter.y).toBeCloseTo(fixedBefore.y);
  expect(edited.layers[1]!.transform.scale.baseValue.x).toBeCloseTo(-3);
  const top = layerToWorld(item, { x: 0, y: -50 }),
    rotate = transformHandles(item, 3).find((h) => h.kind === 'rotate')!.point;
  expect(Math.hypot(rotate.x - top.x, rotate.y - top.y)).toBeCloseTo(135);
});
