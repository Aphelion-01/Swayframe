import type { TextMeasure } from './text-geometry';
import type { Vec2 } from './core-types';
import type { TransformContext } from './transform-context';
import type { RenderSnapshot, RenderLayer } from './renderer-core';
import { apply2D, inverse2D, identity2D } from './matrix2d';
import {
  boundsCenter,
  boundsCorners,
  getLocalBounds,
  boundsFromPoints,
} from './layer-bounds';
import { layerToWorld } from './transform-geometry';
import { transformItems } from './transform-operations';
export type GuideProperty =
  'position' | 'scale' | 'rotation' | 'anchor' | 'size';
export interface GuideActivity {
  readonly property: GuideProperty;
  readonly axis?: 'x' | 'y';
  readonly phase: 'hover' | 'active';
}
export interface GuideArrow {
  readonly start: Vec2;
  readonly end: Vec2;
  readonly axis?: 'x' | 'y';
}
export interface TransformGuideModel {
  readonly property: GuideProperty;
  readonly active: boolean;
  readonly activeAxis?: 'x' | 'y';
  readonly fixedPoints: readonly Vec2[];
  readonly axes: readonly GuideArrow[];
  readonly scaleDirections: readonly GuideArrow[];
  readonly rotationArcs: readonly {
    pivot: Vec2;
    radius: number;
    angle: number;
    sweepDegrees: number;
  }[];
  readonly anchors: readonly Vec2[];
  readonly connectionLines: readonly { start: Vec2; end: Vec2 }[];
  readonly ghostPreview: readonly (readonly Vec2[])[];
}
const outline = (l: RenderLayer, time: number, measure?: TextMeasure) =>
  boundsCorners(getLocalBounds(l, time, measure)).map((p) =>
    layerToWorld(l, p),
  );
/** Read-only geometry derived from the same context and affine engine used by edits. */
export function createTransformGuideModel(
  context: TransformContext,
  live: RenderSnapshot,
  activity: GuideActivity = { property: 'position', phase: 'hover' },
  uiScale = 1,
  ghost = false,
  measure?: TextMeasure,
): TransformGuideModel {
  const items = [...context.initialTransforms.values()];
  const property = activity.property;
  const displayItems =
    activity.phase === 'active'
      ? items.map(
          (l) =>
            live.layers.find((item) => item.source.id === l.source.id) ?? l,
        )
      : items;
  const displayContext = {
    ...context,
    snapshot: live,
    initialTransforms: new Map(displayItems.map((l) => [l.source.id, l])),
  };
  const fixedPoints = !items.length
    ? []
    : property === 'size'
      ? items.map((l) => l.position)
      : context.settings.pivotMode === 'individual-origins'
        ? [...context.pivots.values()]
        : [context.pivot];
  const axes =
    property === 'position'
      ? (['x', 'y'] as const).map((axis) => ({
          axis,
          start: context.pivot,
          end: {
            x: context.pivot.x + context.basis[axis].x * 40 * uiScale,
            y: context.pivot.y + context.basis[axis].y * 40 * uiScale,
          },
        }))
      : [];
  const anchors =
    property === 'anchor'
      ? items.map(
          (l) =>
            live.layers.find((item) => item.source.id === l.source.id)
              ?.position ?? l.position,
        )
      : [];
  const connectionLines = displayItems.flatMap((l) => {
    const start =
      property === 'anchor'
        ? l.position
        : layerToWorld(
            l,
            boundsCenter(getLocalBounds(l, context.snapshot.time, measure)),
          );
    const end = context.pivots.get(l.source.id) ?? context.pivot;
    return Math.hypot(start.x - end.x, start.y - end.y) > uiScale
      ? [{ start, end }]
      : [];
  });
  let future: readonly RenderLayer[] = [];
  if (property === 'scale' || ghost) {
    try {
      future = transformItems(
        displayContext,
        property === 'rotation'
          ? { kind: 'rotate', angle: 18 }
          : {
              kind: 'scale',
              factor: {
                x: activity.axis === 'y' ? 1 : 1.15,
                y: activity.axis === 'x' ? 1 : 1.15,
              },
            },
      );
    } catch {
      /* A singular or unsupported affine transform must never fake a preview. */
    }
  }
  if (property === 'size')
    future = displayItems.map((l) => ({
      ...l,
      source: {
        ...l.source,
        width: l.source.width * (activity.axis === 'y' ? 1 : 1.15),
        height: l.source.height * (activity.axis === 'x' ? 1 : 1.15),
      },
    }));
  const combined = (shapes: readonly (readonly Vec2[])[]) => {
    const inverse = inverse2D(context.basis.matrix) ?? identity2D;
    return boundsCorners(
      boundsFromPoints(shapes.flat().map((p) => apply2D(inverse, p))),
    ).map((p) => apply2D(context.basis.matrix, p));
  };
  const beforeShapes = displayItems.map((l) =>
    outline(l, context.snapshot.time, measure),
  );
  const afterShapes = future.map((l) =>
    outline(l, context.snapshot.time, measure),
  );
  const group =
    items.length > 1 &&
    context.settings.pivotMode !== 'individual-origins' &&
    afterShapes.length > 0;
  const starts = group ? [combined(beforeShapes)] : beforeShapes;
  const ends = group ? [combined(afterShapes)] : afterShapes;
  const scaleDirections =
    property === 'scale' || property === 'size'
      ? starts.flatMap((corners, i) => {
          const after = ends[i] ?? [];
          if (!after.length) return [];
          const mid = (a: Vec2, b: Vec2) => ({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
          });
          const indices =
            context.settings.pivotMode === 'bottom' && !activity.axis
              ? [0, 1, 2, 3, 4]
              : [0, 1, 2, 3];
          return indices.flatMap((j) => {
            const start =
              j === 4
                ? mid(corners[0]!, corners[1]!)
                : activity.axis
                  ? mid(corners[j]!, corners[(j + 1) % 4]!)
                  : corners[j]!;
            const target =
              j === 4
                ? mid(after[0]!, after[1]!)
                : activity.axis
                  ? mid(after[j]!, after[(j + 1) % 4]!)
                  : after[j]!;
            const clean = (n: number) => (Math.abs(n) < 1e-7 ? 0 : n);
            const dx = clean(target.x - start.x),
              dy = clean(target.y - start.y),
              length = Math.hypot(dx, dy);
            if (length < 1e-7) return [];
            return [
              {
                start: {
                  x: start.x + (dx / length) * 7 * uiScale,
                  y: start.y + (dy / length) * 7 * uiScale,
                },
                end: {
                  x: start.x + (dx / length) * 30 * uiScale,
                  y: start.y + (dy / length) * 30 * uiScale,
                },
                axis: activity.axis,
              },
            ];
          });
        })
      : [];
  const angle =
    property === 'rotation' && activity.phase === 'active' && items[0]
      ? (live.layers.find((l) => l.source.id === items[0]!.source.id)
          ?.rotation ?? items[0]!.rotation) - items[0]!.rotation
      : 0;
  return {
    property,
    active: activity.phase === 'active',
    activeAxis: activity.axis,
    fixedPoints,
    axes,
    scaleDirections,
    rotationArcs:
      property === 'rotation'
        ? fixedPoints.map((pivot) => ({
            pivot,
            radius: (fixedPoints.length > 1 ? 26 : 38) * uiScale,
            angle,
            sweepDegrees: 140,
          }))
        : [],
    anchors,
    connectionLines,
    ghostPreview: ghost
      ? future.map((l) => outline(l, context.snapshot.time, measure))
      : [],
  };
}

/** Hit the visible short rotation arc, including its arrow, never an invisible full ring. */
export function hitTransformRotationGuide(
  model: TransformGuideModel,
  point: Vec2,
  tolerance: number,
): boolean {
  return model.rotationArcs.some((arc) => {
    if (
      Math.abs(
        Math.hypot(point.x - arc.pivot.x, point.y - arc.pivot.y) - arc.radius,
      ) > tolerance
    )
      return false;
    const sign = model.active && arc.angle < 0 ? -1 : 1;
    const start = arc.angle - sign * arc.sweepDegrees;
    const theta =
      (Math.atan2(point.y - arc.pivot.y, point.x - arc.pivot.x) * 180) /
      Math.PI;
    const offset = (((sign * (theta - start)) % 360) + 360) % 360;
    return offset <= arc.sweepDegrees + 5 || offset >= 355;
  });
}
