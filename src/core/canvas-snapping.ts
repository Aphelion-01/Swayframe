import type { Vec2 } from './core-types';
import type { RenderLayer, RenderSnapshot } from './renderer-core';
import { getWorldBounds, boundsCorners } from './layer-bounds';
import type { TextMeasure } from './text-geometry';

export interface SnapGuide {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly spacing?: {
    readonly spans: readonly (readonly [number, number])[];
    readonly cross: number;
    readonly distance: number;
  };
}
interface SpacingTarget {
  axis: 'x' | 'y';
  start: number;
  end: number;
  crossMin: number;
  crossMax: number;
  delta: number;
}
export interface CanvasSnapContext {
  readonly spacing?: readonly SpacingTarget[];
  readonly moving: {
    readonly x: readonly number[];
    readonly y: readonly number[];
  };
  readonly targets: {
    readonly x: readonly number[];
    readonly y: readonly number[];
  };
}
function bounds(
  layers: readonly RenderLayer[],
  time: number,
  measure?: TextMeasure,
) {
  const points = layers.flatMap<Vec2>((item) =>
    boundsCorners(getWorldBounds(item, time, measure)),
  );
  if (!points.length) return { x: [], y: [] };
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  return {
    x: [left, (left + right) / 2, right],
    y: [top, (top + bottom) / 2, bottom],
  };
}
/** Freeze guide candidates at pointerDown; excludes children carried by selected parents. */
export function canvasSnapContext(
  snapshot: RenderSnapshot,
  selection: readonly string[],
  measure?: TextMeasure,
): CanvasSnapContext {
  const ids = new Set(selection),
    byId = new Map(snapshot.layers.map((l) => [l.source.id, l]));
  const carried = (item: RenderLayer) => {
    let id: string | null | undefined = item.source.id;
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      if (ids.has(id)) return true;
      visited.add(id);
      id = byId.get(id)?.source.editor?.parentId;
    }
    return false;
  };
  const usable = (l: RenderLayer) =>
    l.source.visible &&
    l.active !== false &&
    l.opacity > 0 &&
    !['null', 'camera'].includes(l.source.type);
  const candidates = snapshot.layers
    .filter((l) => usable(l) && !carried(l))
    .map((l) => bounds([l], snapshot.time, measure));
  const moving = bounds(
    snapshot.layers.filter(
      (l) => usable(l) && ids.has(l.source.id) && !l.source.locked,
    ),
    snapshot.time,
    measure,
  );
  const spacing: SpacingTarget[] = [];
  for (const axis of ['x', 'y'] as const) {
    const cross = axis === 'x' ? 'y' : 'x';
    const sorted = candidates
      .filter((b) => b[axis].length)
      .sort((a, b) => a[axis][0]! - b[axis][0]!);
    const size = moving[axis][2]! - moving[axis][0]!;
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!,
        b = sorted[i]!;
      const start = a[axis][2]!,
        end = b[axis][0]!;
      const crossMin = Math.max(a[cross][0]!, b[cross][0]!),
        crossMax = Math.min(a[cross][2]!, b[cross][2]!);
      if (end - start >= size && crossMin <= crossMax)
        spacing.push({
          axis,
          start,
          end,
          crossMin,
          crossMax,
          delta: (start + end - size) / 2 - moving[axis][0]!,
        });
    }
  }
  return {
    moving,
    spacing,
    targets: {
      x: [
        0,
        snapshot.width / 2,
        snapshot.width,
        ...candidates.flatMap((b) => b.x),
      ],
      y: [
        0,
        snapshot.height / 2,
        snapshot.height,
        ...candidates.flatMap((b) => b.y),
      ],
    },
  };
}
/** tolerance is in composition pixels; caller converts a fixed screen-pixel distance. */
export function snapCanvasDelta(
  context: CanvasSnapContext,
  delta: Vec2,
  tolerance: number,
  axis?: 'x' | 'y',
) {
  const result = { ...delta },
    guides: SnapGuide[] = [];
  for (const key of ['x', 'y'] as const) {
    if (axis && key !== axis) {
      result[key] = 0;
      continue;
    }
    let correction: number | undefined,
      guide = 0;
    for (const moving of context.moving[key])
      for (const target of context.targets[key]) {
        const distance = target - moving - result[key];
        if (
          Math.abs(distance) <= tolerance &&
          (correction === undefined ||
            Math.abs(distance) < Math.abs(correction))
        ) {
          correction = distance;
          guide = target;
        }
      }
    let equal: SpacingTarget | undefined;
    const cross = key === 'x' ? 'y' : 'x';
    for (const target of context.spacing ?? []) {
      if (
        target.axis !== key ||
        context.moving[cross][2]! + delta[cross] < target.crossMin ||
        context.moving[cross][0]! + delta[cross] > target.crossMax
      )
        continue;
      const distance = target.delta - result[key];
      if (
        Math.abs(distance) <= tolerance &&
        (correction === undefined || Math.abs(distance) < Math.abs(correction))
      ) {
        correction = distance;
        equal = target;
      }
    }
    if (correction !== undefined) {
      result[key] += correction;
      if (equal) {
        const start = context.moving[key][0]! + result[key],
          end = context.moving[key][2]! + result[key];
        guides.push({
          axis: key,
          value: (start + end) / 2,
          spacing: {
            spans: [
              [equal.start, start],
              [end, equal.end],
            ],
            cross: context.moving[cross][1]! + result[cross],
            distance: start - equal.start,
          },
        });
      } else guides.push({ axis: key, value: guide });
    }
  }
  return { delta: result, guides };
}
