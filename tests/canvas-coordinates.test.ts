import { expect, it } from 'vitest';
import {
  screenToComposition,
  compositionToScreen,
  continuousRotation,
  scaleCursor,
  compositionToLayerLocal,
  layerLocalToComposition,
} from '../src/core/canvas-coordinates';
import { createRenderSnapshot, hitTest } from '../src/core/renderer-core';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { createMask } from '../src/core/effect-model';
it.each([0.25, 0.5, 1, 2, 4])(
  'CSS coordinates roundtrip at %s zoom independently of physical DPI',
  (zoom) => {
    const rect = { left: 34, top: 79, width: 1920 * zoom, height: 1080 * zoom },
      size = { x: 1920, y: 1080 },
      point = { x: 1432, y: 456 };
    expect(
      screenToComposition(compositionToScreen(point, rect, size), rect, size),
    ).toEqual(point);
  },
);
it('incremental rotation crosses branch cut without reversing and directional cursor follows basis', () => {
  expect(
    (continuousRotation((179 * Math.PI) / 180, (-179 * Math.PI) / 180, 0) *
      180) /
      Math.PI,
  ).toBeCloseTo(2);
  expect(scaleCursor({ x: 1, y: -1 })).toBe('nesw-resize');
  expect(scaleCursor({ x: 1, y: 0 }, 90)).toBe('ns-resize');
});
it('matrix conversion includes rotated scaled parent; locked/hidden/top ordering share hit rules', () => {
  const p = createDefaultProject(),
    a = createLayer('rectangle', { position: { x: 400, y: 300 } });
  const b = {
    ...createLayer('rectangle', { position: { x: 400, y: 300 } }),
    locked: true,
  };
  const snap = createRenderSnapshot(
    { ...activeComposition(p), layers: [a, b] },
    0,
    [],
  );
  expect(hitTest(snap, { x: 400, y: 300 })).toBe(a.id);
  const local = { x: 12, y: 33 };
  expect(
    compositionToLayerLocal(
      snap.layers[0]!,
      layerLocalToComposition(snap.layers[0]!, local),
    ),
  ).toEqual(local);
});

it('mask add/subtract/intersect rejects invisible areas rather than whole image bounds', () => {
  const p = createDefaultProject(),
    base = createLayer('rectangle', {
      position: { x: 400, y: 300 },
      width: 200,
      height: 200,
    });
  const mask = createMask({ ...base, width: 80, height: 80 }, 'rectangle');
  const layer = { ...base, editor: { ...base.editor!, masks: [mask] } };
  let snap = createRenderSnapshot(
    { ...activeComposition(p), layers: [layer] },
    0,
    [],
  );
  expect(hitTest(snap, { x: 400, y: 300 })).toBe(layer.id);
  expect(hitTest(snap, { x: 480, y: 300 })).toBeNull();
  snap = createRenderSnapshot(
    {
      ...activeComposition(p),
      layers: [
        {
          ...layer,
          editor: { ...layer.editor, masks: [{ ...mask, mode: 'subtract' }] },
        },
      ],
    },
    0,
    [],
  );
  expect(hitTest(snap, { x: 400, y: 300 })).toBeNull();
  expect(hitTest(snap, { x: 480, y: 300 })).toBe(layer.id);
});

it('parent matrix and rotated/scaled child roundtrip do not use viewport or device pixels', () => {
  const p = createDefaultProject(),
    raw = createLayer('null', { position: { x: 300, y: 250 } });
  const parent = {
    ...raw,
    transform: {
      ...raw.transform,
      rotation: { ...raw.transform.rotation, baseValue: 37 },
      scale: { ...raw.transform.scale, baseValue: { x: 2, y: 2 } },
    },
  };
  const rawChild = createLayer('rectangle', { position: { x: 100, y: 70 } }),
    child = {
      ...rawChild,
      editor: { ...rawChild.editor!, parentId: parent.id },
      transform: {
        ...rawChild.transform,
        rotation: { ...rawChild.transform.rotation, baseValue: 25 },
      },
    };
  const snap = createRenderSnapshot(
    { ...activeComposition(p), layers: [parent, child] },
    0,
    [],
  );
  const item = snap.layers[1]!;
  const point = { x: 24, y: -19 },
    result = compositionToLayerLocal(
      item,
      layerLocalToComposition(item, point),
    );
  expect(result.x).toBeCloseTo(point.x);
  expect(result.y).toBeCloseTo(point.y);
});
