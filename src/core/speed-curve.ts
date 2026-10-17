import { z } from 'zod';

export interface SpeedPoint {
  readonly t: number;
  readonly speed: number;
}
export interface CustomSpeedInterpolation {
  readonly type: 'custom-speed';
  readonly points: readonly SpeedPoint[];
}
export const MAX_SPEED_POINTS = 128;
export const MAX_SPEED = 16;
export const speedInterpolationSchema = z
  .object({
    type: z.literal('custom-speed'),
    points: z
      .array(
        z
          .object({
            t: z.number().finite().min(0).max(1),
            speed: z.number().finite().min(0).max(MAX_SPEED),
          })
          .strict(),
      )
      .min(2)
      .max(MAX_SPEED_POINTS),
  })
  .strict()
  .superRefine((curve, ctx) => {
    const p = curve.points;
    if (p.length < 2) return;
    if (p[0]!.t !== 0 || p.at(-1)!.t !== 1)
      ctx.addIssue({ code: 'custom', message: '速度曲线必须包含 0 和 1 端点' });
    let area = 0;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1]!,
        b = p[i]!;
      if (b.t <= a.t)
        ctx.addIssue({ code: 'custom', message: '时间点必须严格递增' });
      area += ((b.t - a.t) * (a.speed + b.speed)) / 2;
    }
    if (!(area > 0))
      ctx.addIssue({ code: 'custom', message: '速度曲线不能全部为零' });
  });
interface Integral {
  points: readonly SpeedPoint[];
  areas: number[];
  total: number;
}
// Only immutable project data is cached; editable preview objects are never cached stale.
const cache = new WeakMap<CustomSpeedInterpolation, Integral>();
function integral(curve: CustomSpeedInterpolation): Integral | undefined {
  const found = cache.get(curve);
  if (found) return found;
  const parsed = speedInterpolationSchema.safeParse(curve);
  if (!parsed.success) return undefined;
  const points = parsed.data.points,
    areas = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!;
    areas.push(areas[i - 1]! + ((b.t - a.t) * (a.speed + b.speed)) / 2);
  }
  const result = { points, areas, total: areas.at(-1)! };
  if (
    Object.isFrozen(curve) &&
    Object.isFrozen(curve.points) &&
    curve.points.every(Object.isFrozen)
  )
    cache.set(curve, result);
  return result;
}
function interval(points: readonly SpeedPoint[], u: number): number {
  let lo = 1,
    hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid]!.t < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
/** Exact integral of piecewise-linear relative speed. No previous-frame state. */
export function speedProgress(
  curve: CustomSpeedInterpolation,
  time: number,
): number {
  const u = Number.isFinite(time) ? Math.max(0, Math.min(1, time)) : 0;
  if (u === 0 || u === 1) return u;
  const data = integral(curve);
  if (!data) return u; // Defensive renderer fallback; commands remain strict.
  const i = interval(data.points, u),
    a = data.points[i - 1]!,
    b = data.points[i]!,
    dt = u - a.t;
  if (u === b.t) return data.areas[i]! / data.total;
  return Math.max(
    0,
    Math.min(
      1,
      (data.areas[i - 1]! +
        a.speed * dt +
        ((b.speed - a.speed) * dt * dt) / (2 * (b.t - a.t))) /
        data.total,
    ),
  );
}
export function speedWeight(
  curve: CustomSpeedInterpolation,
  u: number,
): number {
  const data = integral(curve);
  if (!data) return 1;
  const t = Math.max(0, Math.min(1, u)),
    i = interval(data.points, t),
    a = data.points[i - 1]!,
    b = data.points[i]!;
  return (
    (a.speed + ((b.speed - a.speed) * (t - a.t)) / (b.t - a.t)) / data.total
  );
}
export const speedPresets: Readonly<Record<string, CustomSpeedInterpolation>> =
  {
    uniform: {
      type: 'custom-speed',
      points: [
        { t: 0, speed: 1 },
        { t: 1, speed: 1 },
      ],
    },
    accelerate: {
      type: 'custom-speed',
      points: [
        { t: 0, speed: 0 },
        { t: 1, speed: 2 },
      ],
    },
    decelerate: {
      type: 'custom-speed',
      points: [
        { t: 0, speed: 2 },
        { t: 1, speed: 0 },
      ],
    },
    ease: {
      type: 'custom-speed',
      points: [
        { t: 0, speed: 0 },
        { t: 0.5, speed: 2 },
        { t: 1, speed: 0 },
      ],
    },
    pause: {
      type: 'custom-speed',
      points: [
        { t: 0, speed: 1 },
        { t: 0.3, speed: 1 },
        { t: 0.4, speed: 0 },
        { t: 0.6, speed: 0 },
        { t: 0.7, speed: 1 },
        { t: 1, speed: 1 },
      ],
    },
  };
/** Deterministic error-priority simplification; zero-run boundaries are mandatory. */
export function simplifySpeedStroke(
  input: readonly SpeedPoint[],
): CustomSpeedInterpolation {
  const unique = new Map<number, SpeedPoint>();
  for (const p of input)
    if (Number.isFinite(p.t) && Number.isFinite(p.speed)) {
      const t = Math.max(0, Math.min(1, p.t));
      unique.set(t, { t, speed: Math.max(0, Math.min(MAX_SPEED, p.speed)) });
    }
  const points = [...unique.values()].sort((a, b) => a.t - b.t);
  if (!points.length) throw new Error('请绘制有效速度曲线');
  if (points[0]!.t !== 0) points.unshift({ ...points[0]!, t: 0 });
  if (points.at(-1)!.t !== 1) points.push({ ...points.at(-1)!, t: 1 });
  const keep = new Set([0, points.length - 1]);
  points.forEach((p, i) => {
    if (
      p.speed === 0 &&
      (points[i - 1]?.speed !== 0 || points[i + 1]?.speed !== 0)
    )
      keep.add(i);
  });
  if (keep.size > MAX_SPEED_POINTS)
    throw new Error('停顿区间过多，请减少笔迹复杂度');
  while (keep.size < MAX_SPEED_POINTS) {
    const ids = [...keep].sort((a, b) => a - b);
    let worst = 0.005,
      chosen = -1;
    for (let n = 1; n < ids.length; n++) {
      const l = ids[n - 1]!,
        r = ids[n]!,
        a = points[l]!,
        b = points[r]!;
      for (let i = l + 1; i < r; i++) {
        const p = points[i]!,
          error = Math.abs(
            p.speed -
              (a.speed + ((b.speed - a.speed) * (p.t - a.t)) / (b.t - a.t)),
          );
        if (error > worst) {
          worst = error;
          chosen = i;
        }
      }
    }
    if (chosen < 0) break;
    keep.add(chosen);
  }
  return speedInterpolationSchema.parse({
    type: 'custom-speed',
    points: [...keep].sort((a, b) => a - b).map((i) => points[i]!),
  });
}
