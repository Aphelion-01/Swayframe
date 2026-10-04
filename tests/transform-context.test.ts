import { expect, it } from 'vitest';
import { createLayer, createComposition } from '../src/core/project-model';
import type { Layer } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import {
  createTransformContext,
  resolveTransformBasis,
  orientationDelta,
} from '../src/core/transform-resolvers';
import { transformItems } from '../src/core/transform-operations';
import { transformPreviewComposition } from '../src/core/transform-editing';
import { getWorldBounds, boundsCenter } from '../src/core/layer-bounds';
import { layerToWorld } from '../src/core/transform-geometry';
import type { TransformPivotMode } from '../src/core/transform-context';
const rect = (x = 200, y = 200) =>
  createLayer('rectangle', { position: { x, y }, width: 100, height: 60 });
const snapshot = (layers: readonly Layer[]) =>
  createRenderSnapshot(
    { ...createComposition(), layers },
    0,
    layers.map((l) => l.id),
  );
function scale(layers: readonly Layer[], pivotMode: TransformPivotMode) {
  const s = snapshot(layers),
    context = createTransformContext(s, s.selection, {
      orientation: 'local',
      pivotMode,
    });
  return createRenderSnapshot(
    transformPreviewComposition(
      { ...createComposition(), layers },
      s,
      transformItems(context, { kind: 'scale', factor: { x: 2, y: 2 } }),
    ),
    0,
    [],
  );
}
it('A1/A2：左上锚点缩放固定锚点，几何中心缩放固定中心且不修改anchor', () => {
  const r = rect(),
    l = {
      ...r,
      editor: {
        ...r.editor!,
        properties: {
          ...r.editor!.properties,
          anchor: {
            ...r.editor!.properties.anchor!,
            baseValue: { x: -50, y: -30 },
          },
        },
      },
    };
  const before = snapshot([l]).layers[0]!;
  const anchor = scale([l], 'anchor').layers[0]!,
    center = scale([l], 'object-center').layers[0]!;
  expect(layerToWorld(anchor, { x: -50, y: -30 })).toEqual(
    layerToWorld(before, { x: -50, y: -30 }),
  );
  expect(layerToWorld(center, { x: 0, y: 0 })).toEqual(
    layerToWorld(before, { x: 0, y: 0 }),
  );
  expect(center.anchor).toEqual(before.anchor);
  expect(center.scale).toEqual({ x: 2, y: 2 });
});
it('A3/A4：Selection Bounds union而非position平均，多选布局缩放与各自中心缩放不同', () => {
  const a = rect(100, 200),
    b = { ...rect(500, 200), width: 200 };
  const s = snapshot([a, b]),
    ctx = createTransformContext(s, s.selection, {
      orientation: 'global',
      pivotMode: 'selection-center',
    });
  expect(ctx.pivot).toEqual({ x: 325, y: 200 });
  const group = scale([a, b], 'selection-center'),
    individual = scale([a, b], 'individual-origins');
  expect(group.layers[1]!.position.x - group.layers[0]!.position.x).toBe(800);
  expect(
    individual.layers.map((l) => boundsCenter(getWorldBounds(l, 0))),
  ).toEqual(s.layers.map((l) => boundsCenter(getWorldBounds(l, 0))));
});
it('A5/A6/A7：Global/Local X不同，嵌套Parent basis含祖先旋转缩放；无Parent fallback', () => {
  const raw = rect(),
    l = {
      ...raw,
      transform: {
        ...raw.transform,
        rotation: { ...raw.transform.rotation, baseValue: 45 },
      },
    };
  const s = snapshot([l]),
    global = orientationDelta(
      resolveTransformBasis(s, 'global', s.layers[0]),
      { x: 100, y: 100 },
      'x',
    ),
    local = orientationDelta(
      resolveTransformBasis(s, 'local', s.layers[0]),
      { x: 100, y: 100 },
      'x',
    );
  expect(global).toEqual({ x: 100, y: 0 });
  expect(local.x).toBeCloseTo(100);
  expect(local.y).toBeCloseTo(100);
  const gp = { ...l, id: crypto.randomUUID() },
    p = { ...rect(), editor: { ...raw.editor!, parentId: gp.id } },
    ch = { ...rect(), editor: { ...raw.editor!, parentId: p.id } };
  const nested = snapshot([gp, p, ch]),
    basis = resolveTransformBasis(nested, 'parent', nested.layers[2]);
  expect(basis.x.x).toBeCloseTo(Math.SQRT1_2);
  expect(basis.x.y).toBeCloseTo(Math.SQRT1_2);
  expect(resolveTransformBasis(s, 'parent', s.layers[0]).x).toEqual({
    x: 1,
    y: 0,
  });
});
it('A8：自定义支点旋转使位置绕共同世界支点移动，Anchor不变', () => {
  const s = snapshot([rect(100, 0)]),
    ctx = createTransformContext(s, s.selection, {
      orientation: 'global',
      pivotMode: 'custom',
      customPivot: { x: 0, y: 0 },
    });
  const item = transformItems(ctx, { kind: 'rotate', angle: 90 })[0]!;
  expect(item.localTransform!.position.x).toBeCloseTo(0);
  expect(item.localTransform!.position.y).toBeCloseTo(100);
  expect(item.localTransform!.rotation).toBeCloseTo(90);
  expect(item.anchor).toEqual(s.layers[0]!.anchor);
});
it('选中父子时共同世界变换只执行一次，负scale符号保留；不支持的剪切明确拒绝', () => {
  const p = rect(100, 100),
    raw = rect(150, 0),
    ch = {
      ...raw,
      editor: { ...raw.editor!, parentId: p.id },
      transform: {
        ...raw.transform,
        scale: { ...raw.transform.scale, baseValue: { x: -2, y: 1 } },
      },
    };
  const s = snapshot([p, ch]),
    ctx = createTransformContext(s, s.selection, {
      orientation: 'global',
      pivotMode: 'selection-center',
    }),
    items = transformItems(ctx, { kind: 'scale', factor: { x: 2, y: 2 } });
  expect(items[1]!.localTransform!.scale).toEqual({ x: -2, y: 1 });
  const l = {
      ...raw,
      transform: {
        ...raw.transform,
        rotation: { ...raw.transform.rotation, baseValue: 45 },
      },
    },
    r = snapshot([l]);
  expect(() =>
    transformItems(
      createTransformContext(r, r.selection, {
        orientation: 'global',
        pivotMode: 'anchor',
      }),
      { kind: 'scale', factor: { x: 2, y: 1 } },
    ),
  ).toThrow(/剪切/);
});
it('Text测量、Path曲线极值、Image/Precomp外部Bounds共用世界矩阵，View保持屏幕轴并预留相机3D基', () => {
  const text = createLayer('text', {
    position: { x: 100, y: 100 },
    width: 500,
    height: 100,
  });
  const t = snapshot([text]).layers[0]!,
    b = getWorldBounds(t, 0, () => ({
      width: 10,
      left: 0,
      right: 10,
      ascent: 8,
      descent: 2,
    }));
  expect(b.maxX - b.minX).toBe(
    Array.from(text.type === 'text' ? text.text : '').length * 10,
  );
  expect(b.maxY - b.minY).toBe(10);
  const path = createLayer('path', {
    width: 100,
    height: 100,
    position: { x: 0, y: 0 },
  });
  const curve = {
    ...path,
    editor: {
      ...path.editor!,
      pathClosed: false,
      properties: {
        ...path.editor!.properties,
        strokeWidth: { ...path.editor!.properties.strokeWidth!, baseValue: 0 },
        path: {
          ...path.editor!.properties.path!,
          baseValue: [0, 0, 0, 0, 0, 100, 100, 0, 100, 100, 100, 0],
        },
      },
    },
  };
  const curveBounds = getWorldBounds(snapshot([curve]).layers[0]!, 0);
  expect(curveBounds.maxY).toBeCloseTo(75);
  expect(curveBounds.minX).toBeCloseTo(0);
  expect(curveBounds.maxX).toBeCloseTo(100);
  for (const item of [
    createLayer('image', {
      assetId: 'asset',
      width: 240,
      height: 80,
      position: { x: 300, y: 200 },
    }),
    createLayer('precomp', {
      compositionId: 'nested',
      width: 240,
      height: 80,
      position: { x: 300, y: 200 },
    }),
  ]) {
    expect(getWorldBounds(snapshot([item]).layers[0]!, 0)).toEqual({
      minX: 180,
      maxX: 420,
      minY: 160,
      maxY: 240,
    });
  }
  const s = snapshot([rect()]);
  expect(resolveTransformBasis(s, 'view', s.layers[0]).x).toEqual({
    x: 1,
    y: 0,
  });
  expect(resolveTransformBasis(s, 'view', s.layers[0]).axes3D!.z.z).toBe(1);
});
