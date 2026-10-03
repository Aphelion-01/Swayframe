import { expect, it } from 'vitest';
import { createLayer, createComposition } from '../src/core/project-model';
import { createRenderSnapshot, hitTest } from '../src/core/renderer-core';
import {
  layerToWorld,
  worldToLayer,
  handleHit,
  transformHandles,
} from '../src/core/transform-geometry';
it('锚点、旋转和负缩放变换可逆，手柄使用同一世界坐标', () => {
  const l = createLayer('rectangle');
  const layer = {
    ...l,
    transform: {
      ...l.transform,
      rotation: { ...l.transform.rotation, baseValue: 33 },
      scale: { ...l.transform.scale, baseValue: { x: -2, y: 0.5 } },
    },
    editor: {
      ...l.editor!,
      properties: {
        ...l.editor!.properties,
        anchor: {
          ...l.editor!.properties.anchor!,
          baseValue: { x: 30, y: 20 },
        },
      },
    },
  };
  const input = createRenderSnapshot(
      { ...createComposition(), layers: [layer] },
      0,
      [layer.id],
    ),
    item = input.layers[0]!;
  const p = { x: 25, y: -40 },
    back = worldToLayer(item, layerToWorld(item, p));
  expect(back.x).toBeCloseTo(p.x);
  expect(back.y).toBeCloseTo(p.y);
  expect(hitTest(input, layerToWorld(item, { x: 0, y: 0 }))).toBe(layer.id);
  expect(handleHit(item, transformHandles(item)[0]!.point, 10)).toBe('scale');
  expect(handleHit(item, item.position, 10)).toBeUndefined();
  expect(handleHit(item, item.position, 10, true)).toBe('anchor');
});
