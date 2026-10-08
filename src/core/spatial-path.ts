import type { AnimValue, Vec2 } from './core-types';
import type { Keyframe } from './project-model';
/** Absolute local position controls, independent of temporal easing. */
export function spatialControls(
  left: Keyframe<AnimValue>,
  right: Keyframe<AnimValue>,
): { out: Vec2; in: Vec2 } {
  const a = left.value as Vec2,
    b = right.value as Vec2;
  return {
    out: (left.spatialOutgoing as Vec2 | undefined) ?? {
      x: a.x + (b.x - a.x) / 3,
      y: a.y + (b.y - a.y) / 3,
    },
    in: (right.spatialIncoming as Vec2 | undefined) ?? {
      x: a.x + (2 * (b.x - a.x)) / 3,
      y: a.y + (2 * (b.y - a.y)) / 3,
    },
  };
}
export function spatialPoint(
  left: Keyframe<AnimValue>,
  right: Keyframe<AnimValue>,
  progress: number,
): Vec2 {
  const a = left.value as Vec2,
    b = right.value as Vec2,
    c = spatialControls(left, right),
    t = progress,
    s = 1 - t;
  const axis = (key: 'x' | 'y') =>
    s ** 3 * a[key] +
    3 * s * s * t * c.out[key] +
    3 * s * t * t * c.in[key] +
    t ** 3 * b[key];
  return { x: axis('x'), y: axis('y') };
}

export function spatialControls3(
  left: Keyframe<AnimValue>,
  right: Keyframe<AnimValue>,
) {
  const a = left.value as readonly number[],
    b = right.value as readonly number[];
  return {
    out:
      (left.spatialOutgoing as readonly number[] | undefined) ??
      a.map((n, i) => n + (b[i]! - n) / 3),
    in:
      (right.spatialIncoming as readonly number[] | undefined) ??
      a.map((n, i) => n + (2 * (b[i]! - n)) / 3),
  };
}
export function spatialPoint3(
  left: Keyframe<AnimValue>,
  right: Keyframe<AnimValue>,
  t: number,
): readonly number[] {
  const a = left.value as readonly number[],
    b = right.value as readonly number[],
    c = spatialControls3(left, right),
    s = 1 - t;
  return a.map(
    (n, i) =>
      s ** 3 * n +
      3 * s * s * t * c.out[i]! +
      3 * s * t * t * c.in[i]! +
      t ** 3 * b[i]!,
  );
}
