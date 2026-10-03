import { cubicBezier } from './cubic-bezier';
import { spatialPoint } from './spatial-path';
import { z } from 'zod';
import type { AnimValue, Seconds, Vec2 } from './core-types';
import type { Interpolation, Property, Keyframe } from './project-model';

export const curvePointSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(-10).max(10) })
  .strict();
export const interpolationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('linear') }).strict(),
  z.object({ type: z.literal('hold') }).strict(),
  z
    .object({
      type: z.literal('bezier'),
      out: curvePointSchema,
      in: curvePointSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('spring'),
      stiffness: z.number().min(0.001).max(10000),
      damping: z.number().min(0.001).max(10000),
      mass: z.number().min(0.001).max(10000),
    })
    .strict(),
]);
// Analytical unit-step response; no simulation state or frame-rate dependency.
function springResponse(
  time: number,
  spring: Extract<Interpolation, { type: 'spring' }>,
): number {
  const w = Math.sqrt(spring.stiffness / spring.mass);
  const ratio =
    spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
  if (ratio < 1 - 1e-6) {
    const wd = w * Math.sqrt(1 - ratio ** 2);
    return (
      1 -
      Math.exp(-ratio * w * time) *
        (Math.cos(wd * time) + ((ratio * w) / wd) * Math.sin(wd * time))
    );
  }
  if (ratio > 1 + 1e-6) {
    const root = Math.sqrt(ratio ** 2 - 1);
    const r1 = -w / (ratio + root);
    const r2 = -w * (ratio + root);
    return (
      1 - (r2 * Math.exp(r1 * time) - r1 * Math.exp(r2 * time)) / (r2 - r1)
    );
  }
  return 1 - Math.exp(-w * time) * (1 + w * time);
}
export function interpolationProgress(
  interpolation: Interpolation,
  elapsed: number,
  duration: number,
): number {
  interpolationSchema.parse(interpolation);
  const u = elapsed / duration;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (interpolation.type === 'hold') return 0;
  if (interpolation.type === 'linear') return u;
  if (interpolation.type === 'bezier')
    return cubicBezier({
      x1: interpolation.out.x,
      y1: interpolation.out.y,
      x2: interpolation.in.x,
      y2: interpolation.in.y,
    })(u);
  const endpoint = springResponse(duration, interpolation);
  // Normalization gives exact endpoints; near-zero denominator falls back to linear.
  const value =
    Math.abs(endpoint) < 1e-8
      ? u
      : springResponse(elapsed, interpolation) / endpoint;
  if (!Number.isFinite(value)) throw new Error('弹簧插值求值溢出');
  return value;
}
const sortedCache = new WeakMap<
  Property<AnimValue>,
  readonly Keyframe<AnimValue>[]
>();
export function evaluateProperty<T extends AnimValue>(
  property: Property<T>,
  time: Seconds,
): T;
export function evaluateProperty(
  property: Property<AnimValue>,
  time: Seconds,
): AnimValue {
  if (!Number.isFinite(time)) throw new Error('时间必须为有限秒数');
  let frames = sortedCache.get(property);
  if (!frames) {
    frames = [...property.keyframes].sort((a, b) => a.time - b.time);
    if (Object.isFrozen(property)) sortedCache.set(property, frames);
  }
  if (frames.length === 0) return property.baseValue;
  const first = frames[0]!;
  const last = frames[frames.length - 1]!;
  if (time <= first.time) return first.value;
  if (time >= last.time) return last.value;
  let lo = 1,
    hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (frames[mid]!.time > time) hi = mid;
    else lo = mid + 1;
  }
  const rightIndex = lo;
  const left = frames[rightIndex - 1]!;
  const right = frames[rightIndex]!;
  const progress = interpolationProgress(
    left.interpolation.type === 'bezier'
      ? {
          ...left.interpolation,
          out: left.outgoing ?? left.interpolation.out,
          in: right.incoming ?? left.interpolation.in,
        }
      : left.interpolation,
    time - left.time,
    right.time - left.time,
  );
  const mix = (from: number, to: number): number => {
    const value = from * (1 - progress) + to * progress;
    if (!Number.isFinite(value)) throw new Error('动画求值超出有限数值范围');
    return value;
  };
  if (typeof left.value === 'number' && typeof right.value === 'number')
    return mix(left.value, right.value);
  if (Array.isArray(left.value) && Array.isArray(right.value)) {
    if (left.value.length !== right.value.length) return left.value;
    const target = right.value;
    return left.value.map((v, i) => mix(v, target[i]!));
  }
  if (
    !Array.isArray(left.value) &&
    !Array.isArray(right.value) &&
    typeof left.value !== 'number' &&
    typeof right.value !== 'number'
  )
    if (left.spatialOutgoing || right.spatialIncoming)
      return spatialPoint(left, right, progress);
    else
      return {
        x: mix((left.value as Vec2).x, (right.value as Vec2).x),
        y: mix((left.value as Vec2).y, (right.value as Vec2).y),
      };
  throw new Error('关键帧值类型不一致');
}
