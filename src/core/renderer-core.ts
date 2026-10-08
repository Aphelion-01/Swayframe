import { cameraForLayer } from './camera-optics';
import { getLocalBounds } from './layer-bounds';
import type { TextMeasure } from './text-geometry';
import { maskHit } from './mask-hit';
import {
  transform4,
  multiply4,
  point4,
  cameraView,
  projectPoint,
  pointInQuad,
} from './perspective';
import type {
  Matrix4,
  CameraSnapshot,
  Point3,
  ProjectedPoint,
} from './perspective';
import { apply2D, inverse2D, multiply2D, transform2D } from './matrix2d';
import type { Matrix2D } from './matrix2d';
import type { ID, Seconds, Vec2, Color } from './core-types';
import type { Composition, Layer, Project } from './project-model';
import { evaluateProperty } from './animation-engine';

export interface PositionPreview {
  readonly layerId: ID;
  readonly position: Vec2;
  readonly others?: readonly {
    readonly layerId: ID;
    readonly position: Vec2;
  }[];
}
export interface RenderLayer {
  readonly source: Layer;
  readonly localTransform?: {
    readonly position: Vec2;
    readonly scale: Vec2;
    readonly rotation: number;
  };
  readonly position: Vec2;
  readonly anchor?: Vec2;
  readonly matrix?: Matrix2D;
  readonly world3D?: Matrix4;
  readonly quad?: readonly ProjectedPoint[];
  readonly active?: boolean;
  readonly localTime?: number;
  readonly scale: Vec2;
  readonly rotation: number;
  readonly opacity: number;
}
export interface RenderSnapshot {
  readonly compositionId: ID;
  readonly backgroundColor?: Color;
  readonly project?: Project;
  readonly camera?: CameraSnapshot;
  readonly width: number;
  readonly height: number;
  readonly time: Seconds;
  readonly layers: readonly RenderLayer[];
  readonly selection: readonly ID[];
}
export interface RendererAdapter<Target> {
  render(input: RenderSnapshot, target: Target): void;
}
const frameCache = new WeakMap<
  Composition,
  { project?: Project; frames: Map<string, RenderSnapshot> }
>();
const layerFrameCache = new WeakMap<Layer, Map<number, RenderLayer>>();
export function createRenderSnapshot(
  composition: Composition,
  time: Seconds,
  selection: readonly ID[],
  preview?: PositionPreview,
  project?: Project,
): RenderSnapshot {
  const key = String(time);
  let cache = frameCache.get(composition);
  const canCache = !preview && Object.isFrozen(composition);
  if (canCache) {
    if (!cache || cache.project !== project) {
      cache = { project, frames: new Map() };
      frameCache.set(composition, cache);
    }
    const found = cache.frames.get(key);
    if (found) {
      if (
        found.selection === selection ||
        (found.selection.length === selection.length &&
          found.selection.every((id, i) => id === selection[i]))
      )
        return found;
      const selected = { ...found, selection };
      cache!.frames.set(key, selected);
      return selected;
    }
  }
  const previewPositions = new Map<string, Vec2>(
    preview
      ? [
          [preview.layerId, preview.position],
          ...(preview.others ?? []).map(
            (item) => [item.layerId, item.position] as [string, Vec2],
          ),
        ]
      : [],
  );
  const raw: RenderLayer[] = composition.layers.map((source) => {
    const layerCanCache =
      !previewPositions.has(source.id) && Object.isFrozen(source);
    const cached = layerCanCache
      ? layerFrameCache.get(source)?.get(time)
      : undefined;
    if (cached) return cached;
    const position =
      previewPositions.get(source.id) ??
      evaluateProperty(source.transform.position, time);
    const anchor = source.editor?.properties.anchor
        ? (evaluateProperty(source.editor.properties.anchor, time) as Vec2)
        : { x: 0, y: 0 },
      scale = evaluateProperty(source.transform.scale, time),
      rotation = evaluateProperty(source.transform.rotation, time);
    const item: RenderLayer = {
      source,
      position,
      anchor,
      scale,
      rotation,
      opacity: Math.max(
        0,
        Math.min(1, evaluateProperty(source.transform.opacity, time)),
      ),
      matrix: transform2D(position, scale, rotation, anchor),
      active:
        time >= (source.editor?.inPoint ?? 0) &&
        time < (source.editor?.outPoint ?? 3600),
      localTime: time - (source.editor?.startTime ?? 0),
    };
    if (layerCanCache) {
      let frames = layerFrameCache.get(source);
      if (!frames) {
        frames = new Map();
        layerFrameCache.set(source, frames);
      }
      frames.set(time, item);
      if (frames.size > 16) frames.delete(frames.keys().next().value!);
    }
    return item;
  });
  const cameras = [...composition.layers]
    .reverse()
    .filter(
      (l) =>
        l.type === 'camera' &&
        l.visible &&
        time >= (l.editor?.inPoint ?? 0) &&
        time < (l.editor?.outPoint ?? 3600),
    );
  const cameraLayer = cameras[0],
    value3 = (source: Layer, key: string, fallback: Point3) =>
      source.editor?.properties[key]
        ? (evaluateProperty(source.editor.properties[key]!, time) as Point3)
        : fallback;
  let camera: CameraSnapshot = cameraLayer
    ? cameraForLayer(cameraLayer, time, composition.width, composition.height)
    : {
        position: [0, 0, -1000],
        rotation: [0, 0, 0],
        zoom: 1000,
        width: composition.width,
        height: composition.height,
      };
  const rawById = new Map(raw.map((item) => [item.source.id, item]));
  const needs3D = new Set<string>();
  for (const item of raw.filter(
    (item) => item.source.editor?.is3D || item.source.type === 'camera',
  )) {
    let current: RenderLayer | undefined = item;
    while (current && !needs3D.has(current.source.id)) {
      needs3D.add(current.source.id);
      const parentId: string | null | undefined =
        current.source.editor?.parentId;
      current = parentId ? rawById.get(parentId) : undefined;
    }
  }
  const resolved = new Map<string, RenderLayer>();
  const resolve = (
    item: RenderLayer,
    seen = new Set<string>(),
  ): RenderLayer => {
    if (resolved.has(item.source.id)) return resolved.get(item.source.id)!;
    if (seen.has(item.source.id)) throw new Error('Parent cycle');
    seen.add(item.source.id);
    const parent = item.source.editor?.parentId
      ? rawById.get(item.source.editor.parentId)
      : undefined;
    const resolvedParent = parent ? resolve(parent, seen) : undefined;
    let world3D: Matrix4 | undefined;
    if (needs3D.has(item.source.id)) {
      const offset = value3(item.source, 'position3D', [0, 0, 0]),
        rotation3 = value3(item.source, 'rotation3D', [0, 0, 0]),
        scale3 = value3(item.source, 'scale3D', [1, 1, 1]),
        anchor3 = value3(item.source, 'anchor3D', [0, 0, 0]);
      world3D = transform4(
        [
          item.position.x - (parent ? 0 : composition.width / 2) + offset[0],
          item.position.y - (parent ? 0 : composition.height / 2) + offset[1],
          offset[2],
        ],
        [rotation3[0], rotation3[1], rotation3[2] + item.rotation],
        [item.scale.x * scale3[0], item.scale.y * scale3[1], scale3[2]],
        [
          (item.anchor?.x ?? 0) + anchor3[0],
          (item.anchor?.y ?? 0) + anchor3[1],
          anchor3[2],
        ],
      );
    }
    if (item.source.type === 'camera') {
      const camera = cameraForLayer(
        item.source,
        time,
        composition.width,
        composition.height,
      );
      world3D = transform4(camera.position, camera.rotation);
    }
    let next = item;
    if (parent) {
      const p = resolvedParent!,
        matrix = multiply2D(p.matrix!, item.matrix!),
        position = apply2D(p.matrix!, item.position);
      next = {
        ...item,
        matrix,
        position,
        rotation: (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
        scale: {
          x: Math.hypot(matrix[0], matrix[1]),
          y:
            (matrix[0] * matrix[3] - matrix[1] * matrix[2]) /
            Math.max(1e-12, Math.hypot(matrix[0], matrix[1])),
        },
      };
    }
    if (world3D && resolvedParent?.world3D)
      world3D = multiply4(resolvedParent.world3D, world3D);
    next = { ...next, world3D };
    resolved.set(item.source.id, next);
    return next;
  };
  const worldLayers = raw.map((item) => resolve(item));
  const cameraFrame = worldLayers.find(
    (item) => item.source.id === cameraLayer?.id,
  );
  if (cameraLayer && cameraFrame?.world3D)
    camera = cameraForLayer(
      cameraLayer,
      time,
      composition.width,
      composition.height,
      cameraFrame.world3D,
    );
  const projectionView = needs3D.size ? cameraView(camera) : undefined;
  const projectedLayers = worldLayers.map((item) => {
    const quad = item.source.editor?.is3D
      ? (
          [
            [-item.source.width / 2, -item.source.height / 2, 0],
            [item.source.width / 2, -item.source.height / 2, 0],
            [item.source.width / 2, item.source.height / 2, 0],
            [-item.source.width / 2, item.source.height / 2, 0],
          ] as Point3[]
        ).map((p) =>
          projectPoint(point4(item.world3D!, p), camera, projectionView),
        )
      : undefined;
    return {
      ...item,
      quad: quad?.every(Boolean) ? (quad as ProjectedPoint[]) : undefined,
      active:
        item.active &&
        (item.source.type === 'model' ||
          !item.source.editor?.is3D ||
          quad?.every(Boolean)),
    };
  });
  const snapshot: RenderSnapshot = {
    project,
    camera,
    compositionId: composition.id,
    backgroundColor: composition.backgroundColor,
    width: composition.width,
    height: composition.height,
    time,
    selection,
    layers: (() => {
      const all = projectedLayers,
        planes = all
          .filter((l) => l.source.editor?.is3D)
          .sort(
            (a, b) =>
              (b.quad?.reduce((s, p) => s + p.z, 0) ?? 0) -
              (a.quad?.reduce((s, p) => s + p.z, 0) ?? 0),
          );
      let index = 0;
      return all.map((l) => (l.source.editor?.is3D ? planes[index++]! : l));
    })(),
  };
  if (canCache && cache) {
    cache.frames.set(key, snapshot);
    if (cache.frames.size > 16)
      cache.frames.delete(cache.frames.keys().next().value!);
  }
  return snapshot;
}
export function hitTest(
  snapshot: RenderSnapshot,
  point: Vec2,
  measure?: TextMeasure,
): ID | null {
  for (const layer of [...snapshot.layers].reverse()) {
    if (
      !layer.source.visible ||
      layer.source.locked ||
      layer.active === false ||
      layer.source.type === 'camera' ||
      layer.opacity === 0 ||
      Math.abs(layer.scale.x) < 1e-9 ||
      Math.abs(layer.scale.y) < 1e-9
    )
      continue;
    if (layer.quad) {
      if (pointInQuad(layer.quad, point)) return layer.source.id;
      continue;
    }
    const inverse = layer.matrix ? inverse2D(layer.matrix) : null;
    if (!inverse) continue;
    const { x, y } = apply2D(inverse, point);
    const bounds = getLocalBounds(layer, snapshot.time, measure);
    const inside =
      layer.source.type === 'shape' && layer.source.shapeKind === 'ellipse'
        ? (x / (layer.source.width / 2)) ** 2 +
            (y / (layer.source.height / 2)) ** 2 <=
          1
        : x >= bounds.minX &&
          x <= bounds.maxX &&
          y >= bounds.minY &&
          y <= bounds.maxY;
    if (
      inside &&
      maskHit(layer.source.editor?.masks ?? [], { x, y }, snapshot.time)
    )
      return layer.source.id;
  }
  return null;
}
