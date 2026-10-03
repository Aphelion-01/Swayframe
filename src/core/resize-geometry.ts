import type { Vec2 } from './core-types';
import type { RenderLayer } from './renderer-core';
import { worldToLayer, layerToWorld } from './transform-geometry';

/** Resize around the opposite edge/corner (Alt: anchor), using the original inverse world matrix. */
export function resizeLayer(
  item: RenderLayer,
  start: Vec2,
  end: Vec2,
  direction: Vec2,
  uniform: boolean,
  fromAnchor = false,
): RenderLayer {
  const anchor = item.anchor ?? { x: 0, y: 0 };
  const fixed = fromAnchor
    ? anchor
    : {
        x: direction.x ? (-direction.x * item.source.width) / 2 : anchor.x,
        y: direction.y ? (-direction.y * item.source.height) / 2 : anchor.y,
      };
  const a = worldToLayer(item, start),
    b = worldToLayer(item, end);
  const ratio = (axis: 'x' | 'y') => {
    if (!direction[axis] || Math.abs(a[axis] - fixed[axis]) < 1e-8) return 1;
    const value = (b[axis] - fixed[axis]) / (a[axis] - fixed[axis]);
    return Math.abs(value) < 0.001 ? (value < 0 ? -0.001 : 0.001) : value;
  };
  let x = ratio('x'),
    y = ratio('y');
  if (uniform) {
    const factor =
      direction.x && direction.y
        ? Math.abs(x - 1) >= Math.abs(y - 1)
          ? x
          : y
        : direction.x
          ? x
          : y;
    x = factor;
    y = factor;
  }
  const oldFixed = layerToWorld(item, fixed),
    scaledFixed = layerToWorld(item, {
      x: anchor.x + (fixed.x - anchor.x) * x,
      y: anchor.y + (fixed.y - anchor.y) * y,
    });
  return {
    ...item,
    scale: { x: item.scale.x * x, y: item.scale.y * y },
    position: {
      x: item.position.x + oldFixed.x - scaledFixed.x,
      y: item.position.y + oldFixed.y - scaledFixed.y,
    },
  };
}
