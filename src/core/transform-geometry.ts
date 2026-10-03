import { apply2D, inverse2D } from './matrix2d';
import type { Vec2 } from './core-types';
import type { RenderLayer } from './renderer-core';
export function layerToWorld(item: RenderLayer, point: Vec2): Vec2 {
  if (item.matrix) return apply2D(item.matrix, point);
  const anchor = item.anchor ?? { x: 0, y: 0 },
    r = (item.rotation * Math.PI) / 180;
  const x = (point.x - anchor.x) * item.scale.x,
    y = (point.y - anchor.y) * item.scale.y;
  return {
    x: item.position.x + x * Math.cos(r) - y * Math.sin(r),
    y: item.position.y + x * Math.sin(r) + y * Math.cos(r),
  };
}
export function worldToLayer(item: RenderLayer, point: Vec2): Vec2 {
  const inverse = item.matrix ? inverse2D(item.matrix) : null;
  if (inverse) return apply2D(inverse, point);
  const r = (-item.rotation * Math.PI) / 180,
    dx = point.x - item.position.x,
    dy = point.y - item.position.y;
  return {
    x:
      (dx * Math.cos(r) - dy * Math.sin(r)) / (item.scale.x || 1e-9) +
      (item.anchor?.x ?? 0),
    y:
      (dx * Math.sin(r) + dy * Math.cos(r)) / (item.scale.y || 1e-9) +
      (item.anchor?.y ?? 0),
  };
}
export type HandleKind = 'scale' | 'rotate' | 'anchor';
export interface TransformHandle {
  readonly kind: HandleKind;
  readonly point: Vec2;
  readonly direction?: Vec2;
}
export function transformHandles(
  item: RenderLayer,
  uiScale = 1,
): readonly TransformHandle[] {
  if (item.quad) {
    const q = item.quad,
      center = {
        x: q.reduce((s, p) => s + p.x, 0) / 4,
        y: q.reduce((s, p) => s + p.y, 0) / 4,
      };
    return [
      { kind: 'scale', point: q[2]! },
      {
        kind: 'rotate',
        point: {
          x: (q[0]!.x + q[1]!.x) / 2,
          y: (q[0]!.y + q[1]!.y) / 2 - 45 * uiScale,
        },
      },
      { kind: 'anchor', point: center },
    ];
  }
  return [
    ...[
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ].map((direction) => ({
      kind: 'scale' as const,
      direction,
      point: layerToWorld(item, {
        x: (direction.x * item.source.width) / 2,
        y: (direction.y * item.source.height) / 2,
      }),
    })),
    {
      kind: 'rotate',
      point: (() => {
        const top = layerToWorld(item, { x: 0, y: -item.source.height / 2 });
        const middle = layerToWorld(item, { x: 0, y: 0 });
        const distance = Math.hypot(top.x - middle.x, top.y - middle.y) || 1;
        return {
          x: top.x + ((top.x - middle.x) / distance) * 45 * uiScale,
          y: top.y + ((top.y - middle.y) / distance) * 45 * uiScale,
        };
      })(),
    },
    { kind: 'anchor', point: item.position },
  ];
}
export function handleHit(
  item: RenderLayer,
  point: Vec2,
  radius: number,
  includeAnchor = false,
): HandleKind | undefined {
  return hitTransformHandle(item, point, radius, includeAnchor)?.kind;
}
export function hitTransformHandle(
  item: RenderLayer,
  point: Vec2,
  radius: number,
  includeAnchor = false,
  uiScale = 1,
): TransformHandle | undefined {
  return transformHandles(item, uiScale)
    .filter(
      (h) =>
        (h.kind !== 'anchor' || includeAnchor) &&
        Math.hypot(h.point.x - point.x, h.point.y - point.y) <= radius,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.point.x - point.x, a.point.y - point.y) -
        Math.hypot(b.point.x - point.x, b.point.y - point.y),
    )[0];
}
