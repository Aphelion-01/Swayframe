import type { Vec2 } from './core-types';
import type { RenderLayer, RenderSnapshot } from './renderer-core';
import { layerToWorld } from './transform-geometry';

export interface SnapGuide {
  readonly axis: 'x' | 'y';
  readonly value: number;
}
export interface CanvasSnapContext {
  readonly moving: {
    readonly x: readonly number[];
    readonly y: readonly number[];
  };
  readonly targets: {
    readonly x: readonly number[];
    readonly y: readonly number[];
  };
}
function bounds(layers: readonly RenderLayer[]) {
  const points = layers.flatMap<Vec2>(
    (item) =>
      item.quad ??
      [
        { x: -item.source.width / 2, y: -item.source.height / 2 },
        { x: item.source.width / 2, y: -item.source.height / 2 },
        { x: item.source.width / 2, y: item.source.height / 2 },
        { x: -item.source.width / 2, y: item.source.height / 2 },
      ].map((p) => layerToWorld(item, p)),
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
    !['null', 'camera'].includes(l.source.type);
  const candidates = snapshot.layers
    .filter((l) => usable(l) && !carried(l))
    .map((l) => bounds([l]));
  return {
    moving: bounds(
      snapshot.layers.filter(
        (l) => usable(l) && ids.has(l.source.id) && !l.source.locked,
      ),
    ),
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
    if (correction !== undefined) {
      result[key] += correction;
      guides.push({ axis: key, value: guide });
    }
  }
  return { delta: result, guides };
}
