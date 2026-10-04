import { apply2D, inverse2D, identity2D } from './matrix2d';
import { transform4 } from './perspective';
import { layerToWorld } from './transform-geometry';
import {
  boundsCenter,
  getWorldBounds,
  getLocalBounds,
  unionBounds,
} from './layer-bounds';
import type { RenderSnapshot, RenderLayer } from './renderer-core';
import type { Vec2 } from './core-types';
import type { TextMeasure } from './text-geometry';
import type {
  TransformBasis,
  TransformContext,
  TransformInteractionSettings,
  TransformPivotMode,
  TransformOrientation,
} from './transform-context';
const origin = { x: 0, y: 0 };
const basisResolvers: Record<
  TransformOrientation,
  (s: RenderSnapshot, l?: RenderLayer) => TransformBasis['matrix']
> = {
  global: () => identity2D,
  local: (_s, l) => l?.matrix ?? identity2D,
  parent: (s, l) =>
    s.layers.find((p) => p.source.id === l?.source.editor?.parentId)?.matrix ??
    identity2D,
  view: () => identity2D,
};
export function resolveTransformBasis(
  snapshot: RenderSnapshot,
  orientation: TransformOrientation,
  primary?: RenderLayer,
): TransformBasis {
  const m = basisResolvers[orientation](snapshot, primary),
    matrix = [m[0], m[1], m[2], m[3], 0, 0] as const;
  const nx = Math.hypot(m[0], m[1]) || 1,
    ny = Math.hypot(m[2], m[3]) || 1;
  const camera =
    orientation === 'view' && snapshot.camera
      ? transform4([0, 0, 0], snapshot.camera.rotation)
      : undefined;
  return {
    matrix: inverse2D(matrix) ? matrix : identity2D,
    x: { x: m[0] / nx, y: m[1] / nx },
    y: { x: m[2] / ny, y: m[3] / ny },
    ...(camera
      ? {
          axes3D: {
            x: { x: camera[0]!, y: camera[4]!, z: camera[8]! },
            y: { x: camera[1]!, y: camera[5]!, z: camera[9]! },
            z: { x: camera[2]!, y: camera[6]!, z: camera[10]! },
          },
        }
      : {}),
  };
}
export function resolveTransformPivot(
  snapshot: RenderSnapshot,
  items: readonly RenderLayer[],
  settings: TransformInteractionSettings,
  measure?: TextMeasure,
): { pivot: Vec2; pivots: ReadonlyMap<string, Vec2> } {
  const selection = boundsCenter(
    unionBounds(items.map((l) => getWorldBounds(l, snapshot.time, measure))),
  );
  const objectCenter = (l: RenderLayer) =>
    layerToWorld(l, boundsCenter(getLocalBounds(l, snapshot.time, measure)));
  const resolvers: Record<TransformPivotMode, (l: RenderLayer) => Vec2> = {
    anchor: (l) => l.position,
    'object-center': objectCenter,
    'bounds-center': (l) =>
      boundsCenter(getWorldBounds(l, snapshot.time, measure)),
    'selection-center': () => selection,
    'individual-origins': objectCenter,
    custom: () => settings.customPivot ?? selection,
  };
  const primary = items[0],
    pivot = primary
      ? resolvers[settings.pivotMode](primary)
      : (settings.customPivot ?? origin);
  return {
    pivot,
    pivots: new Map(
      items.map((l) => [
        l.source.id,
        settings.pivotMode === 'individual-origins' ? objectCenter(l) : pivot,
      ]),
    ),
  };
}
export function createTransformContext(
  snapshot: RenderSnapshot,
  selectedLayerIds: readonly string[],
  settings: TransformInteractionSettings,
  measure?: TextMeasure,
): TransformContext {
  const items = selectedLayerIds
    .map((id) => snapshot.layers.find((l) => l.source.id === id))
    .filter((l): l is RenderLayer => !!l && !l.source.locked);
  return {
    snapshot,
    selectedLayerIds: items.map((l) => l.source.id),
    settings: { ...settings },
    basis: resolveTransformBasis(snapshot, settings.orientation, items[0]),
    ...resolveTransformPivot(snapshot, items, settings, measure),
    initialTransforms: new Map(items.map((l) => [l.source.id, l])),
  };
}
export function orientationDelta(
  basis: TransformBasis,
  delta: Vec2,
  axis?: 'x' | 'y',
): Vec2 {
  if (!axis) return delta;
  const unit = basis[axis],
    length = delta.x * unit.x + delta.y * unit.y;
  return { x: unit.x * length, y: unit.y * length };
}
export function deltaInBasis(basis: TransformBasis, delta: Vec2): Vec2 {
  return apply2D(inverse2D(basis.matrix) ?? identity2D, delta);
}
