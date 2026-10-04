import { apply2D, inverse2D, identity2D } from './matrix2d';
import {
  getWorldBounds,
  getLocalBounds,
  boundsCorners,
  boundsFromPoints,
} from './layer-bounds';
import { layerToWorld } from './transform-geometry';
import type { Vec2 } from './core-types';
import type { TextMeasure } from './text-geometry';
import type { TransformContext } from './transform-context';
import { orientationDelta } from './transform-resolvers';
export interface GizmoHandle {
  readonly kind: 'scale' | 'rotate' | 'move';
  readonly point: Vec2;
  readonly direction?: Vec2;
  readonly axis?: 'x' | 'y';
}
export function transformGizmo(
  context: TransformContext,
  uiScale = 1,
  measure?: TextMeasure,
) {
  const items = [...context.initialTransforms.values()],
    inverse = inverse2D(context.basis.matrix) ?? identity2D;
  const points = items.flatMap((l) =>
    items.length === 1 && !l.quad
      ? boundsCorners(getLocalBounds(l, context.snapshot.time, measure)).map(
          (p) => layerToWorld(l, p),
        )
      : boundsCorners(getWorldBounds(l, context.snapshot.time, measure)),
  );
  const bounds = points.length
    ? boundsFromPoints(points.map((p) => apply2D(inverse, p)))
    : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const middle = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const project = (p: Vec2) => apply2D(context.basis.matrix, p);
  const box = boundsCorners(bounds).map(project);
  const directions = [
    { x: 1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const handles: GizmoHandle[] = directions.map((direction) => ({
    kind: 'scale',
    direction,
    point: project({
      x:
        direction.x < 0
          ? bounds.minX
          : direction.x > 0
            ? bounds.maxX
            : middle.x,
      y:
        direction.y < 0
          ? bounds.minY
          : direction.y > 0
            ? bounds.maxY
            : middle.y,
    }),
  }));
  const top = project({ x: middle.x, y: bounds.minY });
  handles.push({
    kind: 'rotate',
    point: {
      x: top.x - context.basis.y.x * 45 * uiScale,
      y: top.y - context.basis.y.y * 45 * uiScale,
    },
  });
  for (const axis of ['x', 'y'] as const)
    handles.push({
      kind: 'move',
      axis,
      point: {
        x: context.pivot.x + context.basis[axis].x * 40 * uiScale,
        y: context.pivot.y + context.basis[axis].y * 40 * uiScale,
      },
    });
  return { box, handles };
}
export function constrainedMove(
  context: TransformContext,
  delta: Vec2,
  lock: boolean,
  axis?: 'x' | 'y',
) {
  if (!axis && lock)
    axis =
      Math.abs(delta.x * context.basis.x.x + delta.y * context.basis.x.y) >=
      Math.abs(delta.x * context.basis.y.x + delta.y * context.basis.y.y)
        ? 'x'
        : 'y';
  const constrained = orientationDelta(context.basis, delta, axis);
  const unit = axis ? context.basis[axis] : undefined;
  const worldAxis: 'x' | 'y' | undefined = unit
    ? Math.abs(unit.y) < 1e-8
      ? 'x'
      : Math.abs(unit.x) < 1e-8
        ? 'y'
        : undefined
    : undefined;
  return { delta: constrained, axis, worldAxis };
}
