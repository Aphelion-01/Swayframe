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
export function transformHandles(
  item: RenderLayer,
): readonly { kind: HandleKind; point: Vec2 }[] {
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
        point: { x: (q[0]!.x + q[1]!.x) / 2, y: (q[0]!.y + q[1]!.y) / 2 - 45 },
      },
      { kind: 'anchor', point: center },
    ];
  }
  return [
    {
      kind: 'scale',
      point: layerToWorld(item, {
        x: item.source.width / 2,
        y: item.source.height / 2,
      }),
    },
    {
      kind: 'rotate',
      point: layerToWorld(item, { x: 0, y: -item.source.height / 2 - 45 }),
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
  return transformHandles(item).find(
    (h) =>
      (h.kind !== 'anchor' || includeAnchor) &&
      Math.hypot(h.point.x - point.x, h.point.y - point.y) <= radius,
  )?.kind;
}
