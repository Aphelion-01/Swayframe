import type { Vec2 } from './core-types';
import type { RenderLayer } from './renderer-core';
import { apply2D, inverse2D } from './matrix2d';
export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** DOM coordinates are CSS pixels, independent of devicePixelRatio. */
export function screenToComposition(
  point: Vec2,
  rect: CanvasRect,
  size: Vec2,
): Vec2 {
  return {
    x: ((point.x - rect.left) * size.x) / Math.max(1e-9, rect.width),
    y: ((point.y - rect.top) * size.y) / Math.max(1e-9, rect.height),
  };
}
export function compositionToScreen(
  point: Vec2,
  rect: CanvasRect,
  size: Vec2,
): Vec2 {
  return {
    x: rect.left + (point.x * rect.width) / size.x,
    y: rect.top + (point.y * rect.height) / size.y,
  };
}
export function compositionToLayerLocal(item: RenderLayer, point: Vec2): Vec2 {
  const inverse = item.matrix && inverse2D(item.matrix);
  if (!inverse) throw Error('图层变换不可逆');
  return apply2D(inverse, point);
}
export function layerLocalToComposition(item: RenderLayer, point: Vec2): Vec2 {
  if (!item.matrix) throw Error('图层缺少二维变换');
  return apply2D(item.matrix, point);
}
/** Accumulate incremental angles instead of wrapping the whole gesture at ±180°. */
export function continuousRotation(
  previous: number,
  current: number,
  accumulated: number,
): number {
  let delta = current - previous;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return accumulated + delta;
}
export function scaleCursor(direction: Vec2, basisAngle = 0): string {
  const angle =
    ((Math.atan2(direction.y, direction.x) * 180) / Math.PI +
      basisAngle +
      180) %
    180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][
    Math.round(angle / 45) % 4
  ]!;
}
