import { evaluateProperty } from './animation-engine';
import type { AnimValue, Vec2 } from './core-types';
import type { Property } from './project-model';
import type { RenderLayer, RenderSnapshot } from './renderer-core';
import { point4, type Point3 } from './perspective';
import { apply2D } from './matrix2d';
/** Project a position value at the current parent pose; this does not change Scene. */
export function motionPathPoint(
  frame: RenderLayer,
  property: Property<AnimValue>,
  value: AnimValue,
  snapshot: RenderSnapshot,
): Point3 {
  const current = evaluateProperty(property, snapshot.time),
    parent = snapshot.layers.find(
      (l) => l.source.id === frame.source.editor?.parentId,
    );
  if (Array.isArray(value) && Array.isArray(current)) {
    const delta = value.map((n, i) => n - current[i]!) as unknown as Point3;
    const anchor = frame.source.editor?.properties.anchor3D
      ? (evaluateProperty(
          frame.source.editor.properties.anchor3D,
          snapshot.time,
        ) as readonly number[])
      : [0, 0, 0];
    const origin = point4(
      frame.world3D!,
      frame.source.type === 'camera'
        ? [0, 0, 0]
        : [
            (frame.anchor?.x ?? 0) + anchor[0]!,
            (frame.anchor?.y ?? 0) + anchor[1]!,
            anchor[2]!,
          ],
    );
    const zero = parent?.world3D
      ? point4(parent.world3D, [0, 0, 0])
      : [0, 0, 0];
    const d = parent?.world3D ? point4(parent.world3D, delta) : delta;
    return origin.map((n, i) => n + d[i]! - zero[i]!) as unknown as Point3;
  }
  const a = current as Vec2,
    b = value as Vec2;
  if (frame.source.editor?.is3D && frame.world3D) {
    const anchor = evaluateProperty(
      frame.source.editor.properties.anchor3D!,
      snapshot.time,
    ) as readonly number[];
    const origin = point4(frame.world3D, [
      (frame.anchor?.x ?? 0) + anchor[0]!,
      (frame.anchor?.y ?? 0) + anchor[1]!,
      anchor[2]!,
    ]);
    const delta: Point3 = [b.x - a.x, b.y - a.y, 0],
      zero = parent?.world3D ? point4(parent.world3D, [0, 0, 0]) : [0, 0, 0],
      d = parent?.world3D ? point4(parent.world3D, delta) : delta;
    return origin.map((n, i) => n + d[i]! - zero[i]!) as unknown as Point3;
  }
  const p = parent?.matrix ? apply2D(parent.matrix, b) : b;
  return [p.x, p.y, 0];
}
/** Least squares inverse of a local-to-screen Jacobian. Keeps the screen-normal component fixed. */
export function screenPathDelta(
  vectors: readonly { x: number; y: number }[],
  dx: number,
  dy: number,
): number[] | null {
  const xx = vectors.reduce((s, v) => s + v.x * v.x, 0),
    xy = vectors.reduce((s, v) => s + v.x * v.y, 0),
    yy = vectors.reduce((s, v) => s + v.y * v.y, 0),
    det = xx * yy - xy * xy;
  if (Math.abs(det) < 1e-10) return null;
  const a = (yy * dx - xy * dy) / det,
    b = (xx * dy - xy * dx) / det;
  return vectors.map((v) => v.x * a + v.y * b);
}
